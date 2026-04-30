# Contributers: 
# Brian Morava - 261032388
# Omer Ege Ozyaba - 261069925
# Hoi Kin Chiu - 261142005
# Enoch Chan - 261160969




#Type3: Recurring Office Hours
from flask import Blueprint, request, current_app, jsonify, session
import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, date

from notifications import create_notification

# Zoom utils
from zoom_utils import get_owner_zoom_link

type3_blueprint = Blueprint('Type3', __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")

# Database connection
def get_db_connection():

    db_path = DB_PATH

    #attempt to get DB_PATH from Flask app config, but fallback to default if not available 
    try:
        db_path = current_app.config.get("DB_PATH", DB_PATH)
    except RuntimeError:
        pass

    # Opens connection to SQLite database file at DB_PATH
    conn = sqlite3.connect(db_path)

    # returns DB with dictionary format -> row["slotID"]
    conn.row_factory = sqlite3.Row

    # Emnable SQLite foreign-key checks
    conn.execute("PRAGMA foreign_keys = ON")

    return conn

# Email function
def send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password):
    # Multipart email message container
    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
    except Exception as e:
        print("Email error:", e)

# Socket information
def send_notification(message, user_id):
    try:
        from app import socketio
        socketio.emit("notification", {"message": message}, to=str(user_id))
    except Exception as e:
        print("Socket error:", e)

# Flask: only logged-in user can access
def login_required(fn):
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# Flask: restrict access to owners only
def owner_required(fn):
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        if session.get("role") != "owner":
            return jsonify({"error": "Owner access required"}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# Converts weekday name to weekday number
def weekday_name_to_index(name):
    mapping = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    return mapping.get((name or "").strip().lower())

# Generates recurring dates for one weekday accross serveral weeks
def generate_dates_for_weekday(start_date_str, weekday_index, num_weeks):
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()

    days_ahead = (weekday_index - start_dt.weekday()) % 7

    first_occurrence = start_dt + timedelta(days=days_ahead)

    dates = []
    for i in range(num_weeks):
        dates.append(first_occurrence + timedelta(weeks=i))
    return dates


SLOT_PRIVATE = 0
SLOT_ACTIVE = 1

def slot_status_from_row(row):
    if row["booking3ID"]:
        return "Booked"
    return "Active" if row["is_active"] == SLOT_ACTIVE else "Private"



def serialize_owner_slot(row):
    return {
        "slotID": row["slotID"],
        "meetingID": row["meetingID"],
        "date": row["start_date"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "status": slot_status_from_row(row),
        "student_name": row["student_name"],
        "student_email": row["student_email"]
    }






#---------Create Meeting---------
# owner creates recurring office hours
@type3_blueprint.route("/create_office_hours", methods=["POST"])
@owner_required
def create_office_hours():
    data = request.get_json() or {}

    start_date = data.get("start_date")
    num_weeks = int(data.get("num_weeks", 0))
    weekly_slots = data.get("weekly_slots", [])
    # e.g. {"weekday": "monday", "start_time": "10:00", "end_time": "10:15"}

    if not start_date or num_weeks <= 0 or not weekly_slots:
        return jsonify({"error": "Missing required fields"}), 400
    
    owner_id = session["user_id"]

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        zoom_link = None
        try:
            # Zoom meeting
            cur.execute("SELECT name FROM User WHERE userID = ?", (owner_id,))
            owner_row = cur.fetchone()

            zoom_data = get_owner_zoom_link(
                conn,
                current_app,
                owner_id,
                owner_row["name"]
            )
            zoom_link = zoom_data.get("zoom_link")
        except Exception as e:
            print("Zoom skipped:", e)

        cur.execute("""
            INSERT INTO Meeting (date, start_time, end_time, status, zoom_link)
            VALUES (?, ?, ?, 'pending', ?)
        """, (
            start_date,
            weekly_slots[0]["start_time"],
            weekly_slots[0]["end_time"],
            zoom_link,
        ))

        # stores ID of the newly inserted Meeting 
        meeting_id = cur.lastrowid

        # Creates link between the meeting and the owner in OfficeHour table
        cur.execute("""
            INSERT INTO OfficeHours (meetingID, ownerID)
            VALUES (?, ?)
        """, (meeting_id, owner_id))

        # Counts how many slots was created
        inserted_slots = 0

        for slot in weekly_slots:
            weekday_index = weekday_name_to_index(slot.get("weekday"))
            if weekday_index is None:
                continue

            start_time = slot.get("start_time")
            end_time = slot.get("end_time")

            if not start_time or not end_time:
                conn.rollback()
                return jsonify({"error": "Each weekly slot needs start_time and end_time"}), 400

            try:
                start_dt = datetime.strptime(start_time, "%H:%M")
                end_dt = datetime.strptime(end_time, "%H:%M")

                if end_dt <= start_dt:
                    conn.rollback()
                    return jsonify({"error": "Each office hours slot end time must be after start time"}), 400
                
                duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

                if duration_minutes % 15 != 0:
                    conn.rollback()
                    return jsonify({"error": "Office hours duration must be divisible by 15 minutes"}), 400

            except ValueError:
                conn.rollback()
                return jsonify({"error": "Invalid office hours time format"}), 400
            
            # Generate recurring calendar dates
            dates = generate_dates_for_weekday(start_date, weekday_index, num_weeks)

            fifteen_min_slots = generate_15_min_slots(start_time, end_time)

            if not fifteen_min_slots:
                conn.rollback()
                return jsonify({"error": "Office hours must be at least 15 minutes long"}), 400

            for d in dates:
                for mini_slot in fifteen_min_slots:
                    cur.execute("""
                        INSERT INTO TimeSlot (meetingID, start_date, end_date, start_time, end_time, is_active)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        meeting_id,
                        d.isoformat(),
                        d.isoformat(),
                        mini_slot["start_time"],
                        mini_slot["end_time"],
                        SLOT_PRIVATE
                    ))
                    inserted_slots += 1

            if inserted_slots == 0:
                conn.rollback()
                return jsonify({"error": "No valid office hour slots were created"}), 400
        
        conn.commit()

        return jsonify({
            "success": True,
            "meetingID": meeting_id,
            "slots_created": inserted_slots
        }), 201

    finally:
        conn.close() 


# Splitting it into 15-min slots
def generate_15_min_slots(start_time_str, end_time_str):
    start_dt = datetime.strptime(start_time_str, "%H:%M")
    end_dt = datetime.strptime(end_time_str, "%H:%M")

    slots = []

    current_start = start_dt
    while current_start + timedelta(minutes=15) <= end_dt:
        current_end = current_start + timedelta(minutes=15)

        slots.append({
            "start_time": current_start.strftime("%H:%M"),
            "end_time": current_end.strftime("%H:%M")
        })

        current_start = current_end

    return slots


# owner viewing slots created for their office hours
@type3_blueprint.route("/owner_slots", methods=["GET"])
@owner_required
def owner_slots():
    owner_id = session["user_id"]

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ts.slotID,
                ts.meetingID,
                ts.start_date,
                ts.start_time,
                ts.end_time,
                ts.is_active,
                b3.booking3ID,
                su.name AS student_name,
                su.email AS student_email
            FROM TimeSlot ts
            JOIN OfficeHours oh ON oh.meetingID = ts.meetingID
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            LEFT JOIN User su ON su.userID = b3.studentID
            WHERE oh.ownerID = ?
            ORDER BY ts.start_date, ts.start_time, ts.slotID
        """, (owner_id,))

        rows = cur.fetchall()

        return jsonify({
            "slots": [serialize_owner_slot(row) for row in rows]
        }), 200

    finally:
        conn.close()



@type3_blueprint.route("/set_slot_status", methods=["POST"])
@owner_required
def set_slot_status():
    data = request.get_json() or {}
    slot_id = data.get("slotID")
    is_active = data.get("is_active")

    if slot_id is None or is_active is None:
        return jsonify({"error": "Missing slotID or is_active"}), 400

    owner_id = session["user_id"]
    new_value = SLOT_ACTIVE if is_active else SLOT_PRIVATE

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ts.slotID,
                b3.booking3ID
            FROM TimeSlot ts
            JOIN OfficeHours oh ON oh.meetingID = ts.meetingID
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            WHERE ts.slotID = ?
              AND oh.ownerID = ?
        """, (slot_id, owner_id))

        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Slot not found"}), 404

        if row["booking3ID"]:
            return jsonify({"error": "Booked slots cannot be activated or deactivated"}), 409

        cur.execute("""
            UPDATE TimeSlot
            SET is_active = ?
            WHERE slotID = ?
        """, (new_value, slot_id))

        conn.commit()
        return jsonify({"success": True}), 200

    finally:
        conn.close()




@type3_blueprint.route("/set_all_slot_status", methods=["POST"])
@owner_required
def set_all_slot_status():
    data = request.get_json() or {}
    is_active = data.get("is_active")

    if is_active is None:
        return jsonify({"error": "Missing is_active"}), 400

    owner_id = session["user_id"]
    new_value = SLOT_ACTIVE if is_active else SLOT_PRIVATE

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE TimeSlot
            SET is_active = ?
            WHERE slotID IN (
                SELECT ts.slotID
                FROM TimeSlot ts
                JOIN OfficeHours oh ON oh.meetingID = ts.meetingID
                LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
                WHERE oh.ownerID = ?
                  AND b3.booking3ID IS NULL
            )
        """, (new_value, owner_id))

        conn.commit()
        return jsonify({"success": True}), 200

    finally:
        conn.close()



# Get avaliable slots for students
@type3_blueprint.route("/available_slots", methods=["GET"])
@login_required
def available_slots():
    owner_id = request.args.get("owner_id", type=int)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                ts.slotID,
                ts.meetingID,
                ts.start_date,
                ts.end_date,
                ts.start_time,
                ts.end_time,
                oh.ownerID,
                u.name AS owner_name,
                u.email AS owner_email,
                m.zoom_link
            FROM TimeSlot ts
            JOIN OfficeHours oh ON ts.meetingID = oh.meetingID
            JOIN Meeting m ON m.meetingID = oh.meetingID
            JOIN User u ON u.userID = oh.ownerID
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            WHERE b3.slotID IS NULL
              AND ts.is_active = 1
        """
        params = []

        if owner_id:
            query += " AND oh.ownerID = ?"
            params.append(owner_id)

        query += " ORDER BY ts.start_date, ts.start_time"

        cur.execute(query, params)
        rows = cur.fetchall()

        return jsonify({
            "slots": [
                {
                    "slotID": row["slotID"],
                    "meetingID": row["meetingID"],
                    "date": row["start_date"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "ownerID": row["ownerID"],
                    "owner_name": row["owner_name"],
                    "owner_email": row["owner_email"],
                    "zoom_link": row["zoom_link"]
                }
                for row in rows
            ]
        }), 200

    finally:
        conn.close()


#User picks slots to book appointment
@type3_blueprint.route("/book_slot", methods=["POST"])
@login_required
def book_slots():
    if session.get("role") not in ["user", "owner"]:
        return jsonify({"error": "Only McGill users can book office hours"}), 403
    
    data = request.get_json() or {}
    slot_id = data.get("slotID")

    if not slot_id:
        return jsonify({"error": "Missing slotID"}), 400 
    
    student_id = session["user_id"]

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ts.slotID,
                ts.meetingID,
                ts.start_date,
                ts.start_time,
                ts.end_time,
                oh.ownerID,
                u.email AS owner_email,
                su.email AS student_email,
                su.name AS student_name,
                m.zoom_link
            FROM TimeSlot ts
            JOIN OfficeHours oh ON ts.meetingID = oh.meetingID
            JOIN Meeting m ON m.meetingID = ts.meetingID
            JOIN User u ON u.userID = oh.ownerID
            JOIN User su ON su.userID = ?
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            WHERE ts.slotID = ?
            AND b3.slotID IS NULL
            AND ts.is_active = 1
        """, (student_id, slot_id))

        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Slot not found or already booked"}), 409

        if row["ownerID"] == student_id:
            return jsonify({"error": "You cannot book your own office hour slot"}), 400
        
        cur.execute("""
            INSERT INTO Booking3 (studentID, ownerID, meetingID, slotID)
            VALUES (?, ?, ?, ?)
        """, (student_id, row["ownerID"], row["meetingID"], row["slotID"]))

        conn.commit()

        config = current_app.config
        send_email(
            subject="Office Hours Slot Booked",
            body=(
                f"Your office hours slot has been booked.\n\n"
                f"Student: {row['student_name']} ({row['student_email']})\n"
                f"Date: {row['start_date']}\n"
                f"Time: {row['start_time']} - {row['end_time']}\n"
                f"Zoom Link: {row['zoom_link'] or 'Not provided'}\n"
            ),
            to_email=row["owner_email"],
            from_email=config.get("FROM_EMAIL"),
            smtp_server=config.get("SMTP_SERVER"),
            smtp_port=config.get("SMTP_PORT"),
            username=config.get("FROM_EMAIL"),
            password=config.get("EMAIL_PASSWORD")
        )

        create_notification(
            row["ownerID"],
            f"New office hours booking from {row['student_name']} on {row['start_date']} at {row['start_time']}."
        )

        return jsonify({"success": True}), 201

    finally:
        conn.close()


# Viewing bookings
@type3_blueprint.route("/my_bookings", methods=["GET"])
@login_required
def my_bookings():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                b3.booking3ID,
                b3.slotID,
                ts.start_date,
                ts.start_time,
                ts.end_time,
                u.name AS owner_name,
                u.email AS owner_email,
                m.zoom_link
            FROM Booking3 b3
            JOIN TimeSlot ts ON ts.slotID = b3.slotID
            JOIN Meeting m ON m.meetingID = b3.meetingID
            JOIN User u ON u.userID = b3.ownerID
            WHERE b3.studentID = ?
            ORDER BY ts.start_date, ts.start_time
        """, (session["user_id"],))

        rows = cur.fetchall()

        return jsonify({"bookings": [dict(row) for row in rows]}), 200

    finally:
        conn.close()


# Cancels Booking
@type3_blueprint.route("/cancel_booking", methods=["POST"])
@login_required
def cancel_booking():
    data = request.get_json() or {}
    booking_id = data.get("booking3ID")

    if not booking_id:
        return jsonify({"error": "Missing booking3ID"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM Booking3
            WHERE booking3ID = ?
              AND (studentID = ? OR ownerID = ?)
        """, (booking_id, session["user_id"], session["user_id"]))

        if cur.rowcount == 0:
            return jsonify({"error": "Booking not found"}), 404

        conn.commit()
        return jsonify({"success": True}), 200

    finally:
        conn.close()

# Delete a booking slot
@type3_blueprint.route("/delete_slot", methods=["POST"])
@owner_required
def delete_slot():
    data = request.get_json() or {}
    slot_id = data.get("slotID")

    if not slot_id:
        return jsonify({"error": "Missing slotID"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ts.slotID,
                ts.meetingID,
                ts.start_date,
                ts.start_time,
                ts.end_time,
                oh.ownerID,
                ou.name AS owner_name,
                b3.booking3ID,
                b3.studentID,
                su.name AS student_name,
                su.email AS student_email
            FROM TimeSlot ts
            JOIN OfficeHours oh ON oh.meetingID = ts.meetingID
            JOIN User ou ON ou.userID = oh.ownerID
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            LEFT JOIN User su ON su.userID = b3.studentID
            WHERE ts.slotID = ? AND oh.ownerID = ?
        """, (slot_id, session["user_id"]))
        
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Slot not found"}), 404

        if row["booking3ID"]:
            cur.execute("DELETE FROM Booking3 WHERE booking3ID = ?", (row["booking3ID"],))

        cur.execute("DELETE FROM TimeSlot WHERE slotID = ?", (slot_id,))

        conn.commit()

        if row["booking3ID"] and row["studentID"]:
            create_notification(
                row["studentID"],
                f"Your office hours booking on {row['start_date']} at {row['start_time']} was cancelled by the owner."
            )

        return jsonify({
            "success": True,
            "deleted_slot_id": row["slotID"],
            "deleted_booking_id": row["booking3ID"],
        }), 200

    finally:
        conn.close()
