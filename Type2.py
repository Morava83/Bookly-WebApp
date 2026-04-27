from flask import Blueprint, request, current_app, jsonify, session
import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
#-------Type 2: Group Meeting-------------

#=======Setup========
type2_blueprint = Blueprint('Type2', __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")

#--------Query----------

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def get_user_id(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT userID FROM User WHERE email=?", (email,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

#Get Owner Record by id
def get_owner(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
                   SELECT *
                   FROM User u 
                   JOIN Owner o ON u.userId = o.userId 
                   WHERE o.userId = ?
                   """, (id,))
    row = cursor.fetchone()
    conn.close()
    return row if row else None

# GET schedule: CORRECT IMPLEMENTATION
@type2_blueprint.route('/goup_meeting', methods=['GET'])
def get_schedule():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    meeting_id = request.args.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
                   SELECT DISTINCT gm.startDate, gm.endDate, a.start_time, a.end_time, a.day, a.count
                   FROM availability a 
                   JOIN GroupMeeting gm 
                   ON gm.meetingID = a.meetingID 
                   WHERE gm.meetingID = ?
                   """,
                   (meeting_id,))
    rows = cursor.fetchall()
    
    conn.close()

    availabilities = []
    for row in rows:
        availabilities.append({
            "start_date": row["startDate"],
            "end_date": row["endDate"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "day": row["day"],
            "count": row["count"]
        })
    return jsonify({
        "meetingID": meeting_id,
        "availabilities": availabilities
    })


# POST vote
@type2_blueprint.route('/group_meeting', methods=['POST'])
def create_group_meeting():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON received"}), 400

    title = data.get("title")
    description = data.get("description")
    slots = data.get("slots")
    invitees = data.get("invitees")

    if not title or not slots or not description:
        return jsonify({"error": "Missing required fields"}), 400

    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    owner_id = session["user_id"]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # ─────────────────────────────
        # 1. Create base Meeting record
        # ─────────────────────────────
        cursor.execute("""
            INSERT INTO Meeting (date, start_time, end_time, status)
            VALUES (?, ?, ?, 'open')
        """, (
            slots[0]["date"],          # temporary: first slot date
            slots[0]["start_time"],
            slots[0]["end_time"]
        ))

        meeting_id = cursor.lastrowid

        # ─────────────────────────────
        # 2. Create GroupMeeting record
        # ─────────────────────────────
        cursor.execute("""
            INSERT INTO GroupMeeting (
                meetingID, ownerID, title, description, startDate, endDate
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            meeting_id,
            owner_id,
            title,
            description,
            slots[0]["date"],   # startDate (simplified)
            slots[-1]["date"]   # endDate (simplified)
        ))

        # ─────────────────────────────
        # 3. Insert availability slots
        # ─────────────────────────────
        for slot in slots:
            cursor.execute("""
                INSERT INTO Availability (
                    meetingID, day, start_time, end_time, count
                )
                VALUES (?, ?, ?, ?, 0)
            """, (
                meeting_id,
                0,  # TODO: map real weekday if needed
                slot["start_time"],
                slot["end_time"]
            ))

        conn.commit()

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

    conn.close()

    # ─────────────────────────────
    # 4. Return meeting ID to frontend
    # ─────────────────────────────
    invite_url = f"/group/{meeting_id}"

    return jsonify({
        "status": "ok",
        "meetingID": meeting_id,
        "invite_url": invite_url
    })

#----------FORM TO DATABASE------------
#Student chooses most convenient dates & time slots out of those made available by the TA
@type2_blueprint.route('/group_meeting/vote', methods=['POST'])
def vote():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON received"}), 400

    title = data.get("title")
    description = data.get("description")
    date = data.get("date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    invitees = data.get("invitees")

    #N.B.: Recurring Meeting and recurring meetings combined

    if not date or not start_time or not end_time:
        return jsonify({"error": "Missing date/time"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT OR IGNORE INTO availability (title, description, date, start_time, end_time, invitees) VALUES (?, ?)",
        (title, description, date, start_time, end_time, invitees)
    )

    conn.commit()
    conn.close()

    return jsonify({"status": "ok"})

#Get list of invited users --> assumes students as a list of student ids --> list of integers
def get_guests(students):
    conn = get_db_connection()
    cursor = conn.cursor()
    for student in students:
        cursor.execute("""
                       SELECT *
                       FROM User u
                       JOIN Student s ON u.userId = s.userId
                       WHERE u.userId = ?
                       """, (student,))
    row = cursor.fetchone()
    conn.close()
    return row if row else None

#Get owner recurring time slots

#--------Schedule Meeting----------

#======Helper Functions==========
#TODO Add Zoom Link to notification email
def send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password, zoom):
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
            print(f"Email sent to {to_email}\nZoom Link: {zoom}")
    except Exception as e:
        print(f"Email error: {e}")

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

# SOCKET NOTIFICATION
def send_notification(message, user_id):
    try:
        from app import socketio

        socketio.emit(
            "notification",
            {"message": message},
            to=str(user_id)
        )

    except Exception as e:
        print("Socket error:", e)


#TODO Layout availabilities
#TODO Select availability for student
#TODO Owner creates meeting function


