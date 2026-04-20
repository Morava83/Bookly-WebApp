#Type3: Recurring Office Hours
from flask import Blueprint, request, current_app, jsonify, session
import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, date

type3_blueprint = Blueprint('Type3', __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")

# Database connection
def get_db_connection():
    # Opens connection to SQLite database file at DB_PATH
    conn = sqlite3.connect(DB_PATH)

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
    # Parse ipnut string into python "date" objects
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()

    # how many days forward to move from the start date
    days_ahead = (weekday_index - start_dt.weekday()) % 7

    # computes the first date of the requested weekday
    first_occurrence = start_dt + timedelta(days=days_ahead)

    # recurring date storage
    dates = []
    for i in range(num_weeks):
        dates.append(first_occurrence + timedelta(weeks=i))
    return dates


#---------Create Meeting---------
# owner creates recurring office hours
@type3_blueprint.route("/create_office_hours", methods=["POST"])
@owner_required
def create_office_hours():
    data = request.get_json() or {}

    # Pulls expected fields out the JSON
    start_date = data.get("start_date")
    num_weeks = int(data.get("num_weeks", 0))
    weekly_slots = data.get("weekly_slots", [])
    # e.g. {"weekday": "monday", "start_time": "10:00", "end_time": "10:15"}

    if not start_date or num_weeks <= 0 or not weekly_slots:
        return jsonify({"error": "Missing required fields"}), 400
    
    # Takes logged-in owner's user ID from session
    owner_id = session["user_id"]

    # Get database connection
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # insert one row into meeting using start date with status 'open'
        cur.execute("""
            INSERT INTO Meeting (date, start_time, end_time, status)
            VALUES (?, ?, ?, 'open')
        """, (start_date, weekly_slots[0]["start_time"], weekly_slots[0]["end_time"]))

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
            
            # Generate recurring calendar dates
            dates = generate_dates_for_weekday(start_date, weekday_index, num_weeks)

            for d in dates:
                # Inserts one TimeSlot row for each recurring date
                cur.execute("""
                    INSERT INTO TimeSlot (meetingID, start_date, end_date, start_time, end_time)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    meeting_id,
                    d.isoformat(),
                    d.isoformat(),
                    slot["start_time"],
                    slot["end_time"]
                ))
                inserted_slots += 1
        
        conn.commit()

        return jsonify({
            "success": True,
            "meetingID": meeting_id,
            "slots_created": inserted_slots
        }), 201

    finally:
        conn.close() 


# Get avaliable slots for students
@type3_blueprint.route("/available_slots", methods=["GET"])
@login_required
def available_slots():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Select slot details and owner information
        cur.execute("""
            SELECT
                ts.slotID,
                ts.meetingID,
                ts.start_date,
                ts.end_date,
                ts.start_time,
                ts.end_time,
                oh.ownerID,
                u.name AS owner_name,
                u.email AS owner_email
            FROM TimeSlot ts
            JOIN OfficeHours oh ON ts.meetingID = oh.meetingID
            JOIN Meeting m ON m.meetingID = oh.meetingID
            JOIN User u ON u.userID = oh.ownerID
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            WHERE b3.slotID IS NULL
            AND m.status IN ('open', 'booked')
            ORDER BY ts.start_date, ts.start_time
        """)

        rows = cur.fetchall()

        # returns a JSON response containing a list of available slots
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
                    "owner_email": row["owner_email"]
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
    if session.get("role") != "user":
        return jsonify({"error": "Only students can book office hours"}), 403
    
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
                su.name AS student_name   
            FROM TimeSlot ts
            JOIN OfficeHours oh ON ts.meetingID = oh.meetingID
            JOIN User u ON u.userID = oh.ownerID
            JOIN User su ON su.userID = ?
            LEFT JOIN Booking3 b3 ON b3.slotID = ts.slotID
            WHERE ts.slotID = ?
              AND b3.slotID IS NULL
        """, (student_id, slot_id,))

        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Slot not found or already booked"}), 409

        cur.execute("""
            INSERT INTO Booking3 (studentID, ownerID, meetingID, slotID)
            VALUES (?, ?, ?, ?)
        """, (student_id, row["ownerID"], row["meetingID"], row["slotID"]))

        cur.execute("""
            UPDATE Meeting
            SET status = 'booked'
            WHERE meetingID = ?
        """, (row["meetingID"],))

        conn.commit()

        config = current_app.config
        send_email(
            subject="Office Hours Slot Booked",
            body=(
                f"Your office hours slot has been booked.\n\n"
                f"Student: {row['student_name']} ({row['student_email']})\n"
                f"Date: {row['start_date']}\n"
                f"Time: {row['start_time']} - {row['end_time']}\n"
            ),
            to_email=row["owner_email"],
            from_email=config.get("FROM_EMAIL"),
            smtp_server=config.get("SMTP_SERVER"),
            smtp_port=config.get("SMTP_PORT"),
            username=config.get("FROM_EMAIL"),
            password=config.get("EMAIL_PASSWORD")
        )

        send_notification(
            f"New office hours booking on {row['start_date']} at {row['start_time']}",
            row["ownerID"]
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
        if session.get("role") == "user":
            cur.execute("""
                SELECT
                    b3.booking3ID,
                    b3.slotID,
                    ts.start_date,
                    ts.start_time,
                    ts.end_time,
                    u.name AS owner_name,
                    u.email AS owner_email
                FROM Booking3 b3
                JOIN TimeSlot ts ON ts.slotID = b3.slotID
                JOIN User u ON u.userID = b3.ownerID
                WHERE b3.studentID = ?
                ORDER BY ts.start_date, ts.start_time
            """, (session["user_id"],))
        else:
            cur.execute("""
                SELECT
                    b3.booking3ID,
                    b3.slotID,
                    ts.start_date,
                    ts.start_time,
                    ts.end_time,
                    su.name AS student_name,
                    su.email AS student_email
                FROM Booking3 b3
                JOIN TimeSlot ts ON ts.slotID = b3.slotID
                JOIN User su ON su.userID = b3.studentID
                WHERE b3.ownerID = ?
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
        if session.get("role") == "user":
            cur.execute("""
                DELETE FROM Booking3
                WHERE booking3ID = ? AND studentID = ?
            """, (booking_id, session["user_id"]))
        else:
            cur.execute("""
                DELETE FROM Booking3
                WHERE booking3ID = ? AND ownerID = ?
            """, (booking_id, session["user_id"]))

        if cur.rowcount == 0:
            return jsonify({"error": "Booking not found"}), 404

        conn.commit()
        return jsonify({"success": True}), 200

    finally:
        conn.close()


#Email is sent to owner


#Possibly include zoom link in email

#----------Database------------
#Update Booking table with a modification (insert) command
