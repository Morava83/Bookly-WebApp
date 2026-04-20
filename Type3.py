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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foregin_keys = ON")


# Email function

def send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password):
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

def send_notification(message, user_id):
    try:
        from app import socketio
        socketio.emit("notification", {"message": message}, to=str(user_id))
    except Exception as e:
        print("Socket error:", e)


def login_required(fn):
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

def owner_requried(fn):
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        if session.get("role") != "owner":
            return jsonify({"error": "Owner access required"}), 403
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

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


def generate_dates_for_weekday(start_date_str, weekday_index, num_weeks):
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    days_ahead = (weekday_index - start_dt.weekday()) % 7
    first_occurrence = start_dt + timedelta(days=days_ahead)

    dates = []
    for i in range(num_weeks):
        dates.append(first_occurrence + timedelta(weeks=i))
    return dates

#---------Media Query-----------
#Get available slots from timeSlot table


#---------Create Meeting---------
# owner creates recurring office hours
@type3_blueprint.route("/create_office_hours", methods=["POST"])
@owner_requried
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
        cur.execute("""
            INSERT INTO Meeting (date, start_time, end_time, status)
            VALUES (?, ?, ?, 'open)
        """, (start_date, weekly_slots[0]["start_time"], weekly_slots[0]["end_time"]))

        meeting_id = cur.lastrowid

        cur.execute("""
            INSERT INTO OfficeHours (meetingID, ownerID)
            VALUES (?, ?)
        """, (meeting_id, owner_id))

        inserted_slots = 0

        for slot in weekly_slots:
            weekday_index = weekday_name_to_index(slot.get("weekday"))
            if weekday_index is None:
                continue
            
            dates = generate_dates_for_weekday(start_date, weekday_index, num_weeks)

            for d in dates:
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
        cur.execute("""
            SELECT
                ts.slotID,
                ts.meetingID
                ts.start_date,
                ts.end_date,
                ts.start_time,
                ts.end_time,
                ts.ownerID,
                u.name AS owner_name
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
#Email is sent to owner
#Possibly include zoom link in email

#Booking must appear on user and owner dashboard

#----------Database------------
#Update Booking table with a modification (insert) command
