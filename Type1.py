# Contributers:
# Maxim Miladinov-Genov - 260989667
# Enoch Chan - 261160969


from flask import Blueprint, request, current_app, jsonify, session
import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

# Notification Feature
from notifications import create_notification

# Zoom Feature
from zoom_utils import create_type1_zoom_meeting


# Blueprint

type1_blueprint = Blueprint('type1', __name__)

BASE_DIR = os.path.dirname(__file__)
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")

def get_db_path():
    try:
        return current_app.config.get("DB_PATH") or os.environ.get("DB_PATH", DEFAULT_DB_PATH)
    except RuntimeError:
        return os.environ.get("DB_PATH", DEFAULT_DB_PATH)


# EMAIL FUNCTION

def send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password):
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
            print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Email error: {e}")

# DB HELPERS

def get_db_connection():
    conn = sqlite3.connect(get_db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn

def get_user_id(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT userID FROM User WHERE email=?", (email,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

def get_student_id(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.userID
        FROM Student s
        JOIN User u ON s.userID = u.userID
        WHERE u.email = ?
    """, (email,))
    row = cursor.fetchone()
    conn.close()
    return row["userID"] if row else None


def get_owner_id(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.userID
        FROM Owner o
        JOIN User u ON o.userID = u.userID
        WHERE u.email = ?
    """, (email,))
    row = cursor.fetchone()
    conn.close()
    return row["userID"] if row else None

def get_any_user_id(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT userID
        FROM User
        WHERE email = ?
    """, (email,))
    row = cursor.fetchone()
    conn.close()
    return row["userID"] if row else None

# @type1_blueprint.route("/create_meeting", methods=["POST"])
def create_meeting(student_id, owner_id, message, meeting_date, start_time, end_time, zoom_link):
    """
    Insert into Meeting + RequestMeeting 
    """

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO Meeting (date, start_time, end_time, status, zoom_link)
        VALUES (?, ?, ?, 'pending', ?)
    """, (meeting_date, start_time, end_time, zoom_link))

    #Access the last inserted meeting
    meeting_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO RequestMeeting (meetingID, ownerID, studentID, message)
        VALUES (?, ?, ?, ?)
    """, (meeting_id, owner_id, student_id, message))

    conn.commit()
    conn.close()

    

    return meeting_id



# TYPE 1 - REQUEST MEETING

@type1_blueprint.route('/request_meeting', methods=['POST'])
def request_meeting():
    data = request.get_json() or {}

    user_email = data.get('student_email')
    owner_email = data.get('owner_email')
    message = data.get('message')
    meeting_date = data.get('date')
    start_time = data.get('start_time')
    end_time = data.get('end_time')

    if not user_email or not owner_email or not message or not meeting_date or not start_time or not end_time:
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        start_dt = datetime.strptime(f"{meeting_date} {start_time}", "%Y-%m-%d %H:%M")
        end_dt = datetime.strptime(f"{meeting_date} {end_time}", "%Y-%m-%d %H:%M")

        if end_dt <= start_dt:
            return jsonify({"error": "End time must be after start time"}), 400

    except ValueError:
        return jsonify({"error": "Invalid date or time format"}), 400


    student_id = get_any_user_id(user_email)
    owner_id = get_owner_id(owner_email)

    if not student_id:
        return jsonify({"error": "Invalid user"}), 400
    
    if not owner_id:
        return jsonify({"error": "Selected owner is not a registered owner"}), 400
    
    if student_id == owner_id:
        return jsonify({"error": "You cannot request a meeting with yourself"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM User WHERE userID = ?", (owner_id,))
    owner_row = cursor.fetchone()
    conn.close()

    zoom_data = create_type1_zoom_meeting(
        current_app,
        owner_row["name"],
        user_email,
        meeting_date,
        start_time,
        end_time
    )

    zoom_link = zoom_data["zoom_link"]


    # Create meeting request
    meeting_id = create_meeting(
        student_id, 
        owner_id, 
        message,
        meeting_date,
        start_time,
        end_time,
        zoom_link
    )

    # Email owner
    config = current_app.config

    send_email(
        subject="New Meeting Request",
        body=(
            f"New individual meeting request from {user_email}.\n\n"
            f"Date: {meeting_date}\n"
            f"Time: {start_time} - {end_time}\n"
            f"Message:\n{message}\n\n"
            f"Zoom Link: {zoom_link}"
        ),
        to_email=owner_email,
        from_email=config.get("FROM_EMAIL"),
        smtp_server=config.get("SMTP_SERVER"),
        smtp_port=config.get("SMTP_PORT"),
        username=config.get("FROM_EMAIL"),
        password=config.get("EMAIL_PASSWORD")
    )

    create_notification(
        owner_id,
        f"New meeting request from {user_email} for {meeting_date} at {start_time}."
    )

    return jsonify({
        "success": True,
        "meetingID": meeting_id
    }), 201



# GET PENDING REQUESTS (OWNER DASHBOARD)

@type1_blueprint.route('/pending/<owner_email>', methods=['GET'])
def get_pending(owner_email):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            m.meetingID,
            m.date,
            m.start_time,
            m.end_time,
            u.email AS student_email,
            r.message,
            m.status
        FROM Meeting m
        JOIN RequestMeeting r ON m.meetingID = r.meetingID
        JOIN User u ON r.studentID = u.userID
        JOIN User o ON r.ownerID = o.userID
        WHERE o.email = ?
        AND m.status = 'pending'
    """, (owner_email,))

    rows = cursor.fetchall()
    conn.close()

    return jsonify([
        {
            "meetingID": row["meetingID"],
            "student_email": row["student_email"],
            "message": row["message"],
            "date": row["date"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "status": row["status"]
        }
        for row in rows
    ]), 200



# ACCEPT MEETING

@type1_blueprint.route('/accept', methods=['POST'])
def accept_meeting():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT r.studentID, r.ownerID, u.email AS student_email, m.zoom_link
        FROM RequestMeeting r
        JOIN User u ON r.studentID = u.userID
        JOIN Meeting m on m.meetingID = r.meetingID
        WHERE r.meetingID = ? AND r.ownerID = ?
    """, (meeting_id, session["user_id"]))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Meeting request not found"}), 404

    cursor.execute("""
        UPDATE Meeting
        SET status = 'accepted'
        WHERE meetingID = ?
    """, (meeting_id,))

    cursor.execute("""
        INSERT INTO Booking1 (studentID, ownerID, meetingID)
        VALUES (?, ?, ?)
    """, (row["studentID"], row["ownerID"], meeting_id))

    conn.commit()
    conn.close()

    student_id = row["studentID"]
    student_email = row["student_email"]

    # Notify student
    if student_email:
        config = current_app.config

        send_email(
            subject="Meeting Accepted",
            body=(
                "Your meeting request has been accepted.\n\n"
                f"Zoom Link: {row['zoom_link'] or 'Not provided'}"
            ),
            to_email=student_email,
            from_email=config.get("FROM_EMAIL"),
            smtp_server=config.get("SMTP_SERVER"),
            smtp_port=config.get("SMTP_PORT"),
            username=config.get("FROM_EMAIL"),
            password=config.get("EMAIL_PASSWORD")
        )

        create_notification(
            student_id,
            f"Your meeting request was accepted. Zoom link: {row['zoom_link'] or 'Not provided'}"
        )

    return jsonify({"success": True}), 200



# DECLINE MEETING

@type1_blueprint.route('/decline', methods=['POST'])
def decline_meeting():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Checks if there exist meeting requests
    cursor.execute("""
        SELECT r.studentID, u.email AS student_email
        FROM RequestMeeting r
        JOIN User u ON r.studentID = u.userID
        WHERE r.meetingID = ? AND r.ownerID = ?
    """, (meeting_id, session["user_id"]))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Meeting request not found"}), 404


    cursor.execute("""
        UPDATE Meeting
        SET status = 'declined'
        WHERE meetingID = ?
    """, (meeting_id,))

    conn.commit()
    conn.close()

    student_id = row["studentID"]
    student_email = row["student_email"]

    config = current_app.config
    send_email(
        subject="Meeting Declined",
        body="Your meeting request has been declined.",
        to_email=student_email,
        from_email=config.get("FROM_EMAIL"),
        smtp_server=config.get("SMTP_SERVER"),
        smtp_port=config.get("SMTP_PORT"),
        username=config.get("FROM_EMAIL"),
        password=config.get("EMAIL_PASSWORD")
    )

    create_notification(
        student_id,
        f"Your meeting request was declined."
    )

    return jsonify({"success": True}), 200

# Cancel individual meeting
@type1_blueprint.route('/cancel', methods=['POST'])
def cancel_individual_meeting():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    data = request.get_json() or {}
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT r.studentID, r.ownerID, m.status
            FROM RequestMeeting r
            JOIN Meeting m ON m.meetingID = r.meetingID
            WHERE r.meetingID = ?
        """, (meeting_id,))

        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Individual meeting not found"}), 404

        if session["user_id"] not in (row["studentID"], row["ownerID"]):
            return jsonify({"error": "Unauthorized"}), 403

        cursor.execute("""
            UPDATE Meeting
            SET status = 'cancelled'
            WHERE meetingID = ?
        """, (meeting_id,))

        conn.commit()

        if session["user_id"] == row["studentID"]:
            notify_user_id = row["ownerID"]
        else:
            notify_user_id = row["studentID"]

        create_notification(
            notify_user_id,
            f"An individual meeting was cancelled."
        )

        return jsonify({
            "success": True,
            "message": "Individual meeting cancelled successfully."
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

# Remove individual meeting permanently
@type1_blueprint.route('/delete', methods=['POST'])
def delete_individual_meeting():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    data = request.get_json() or {}
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT studentID, ownerID
            FROM RequestMeeting
            WHERE meetingID = ?
        """, (meeting_id,))

        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Individual meeting not found"}), 404

        if session["user_id"] not in (row["studentID"], row["ownerID"]):
            return jsonify({"error": "Unauthorized"}), 403

        cursor.execute("""
            DELETE FROM Meeting
            WHERE meetingID = ?
        """, (meeting_id,))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Individual meeting removed successfully."
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()
   
# Remove meeting when cancelled 
@type1_blueprint.route('/remove', methods=['POST'])
def remove_meeting():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    data = request.get_json() or {}
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT r.studentID, m.status
            FROM RequestMeeting r
            JOIN Meeting m ON m.meetingID = r.meetingID
            WHERE r.meetingID = ?
        """, (meeting_id,))

        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Meeting request not found"}), 404

        if row["studentID"] != session["user_id"]:
            return jsonify({"error": "You can only remove your own meeting requests"}), 403

        if row["status"] != "cancelled":
            return jsonify({"error": "Only cancelled meetings can be removed"}), 400

        cursor.execute("""
            DELETE FROM Meeting
            WHERE meetingID = ?
        """, (meeting_id,))

        conn.commit()
        return jsonify({"success": True}), 200

    finally:
        conn.close()


    #TODO Display on user dashboard
@type1_blueprint.route('/my_meetings', methods=['GET'])
def my_meetings():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401
    
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                m.meetingID,
                m.date,
                m.start_time,
                m.end_time,
                m.status,
                m.zoom_link,
                u.name AS owner_name,
                u.email AS owner_email
            FROM RequestMeeting r
            JOIN Meeting m ON m.meetingID = r.meetingID
            JOIN User u ON u.userID = r.ownerID
            WHERE r.studentID = ?
            ORDER BY m.date, m.start_time
        """, (session["user_id"],))

        rows = cursor.fetchall()

        return jsonify({
            "meetings": [
                {
                    "meetingID": row["meetingID"],
                    "owner_name": row["owner_name"],
                    "owner_email": row["owner_email"],
                    "date": row["date"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "zoom_link": row["zoom_link"],
                    "status": row["status"]
                }
                for row in rows
            ]
        }), 200
    finally:
        conn.close()


    #TODO Display on owner dashboard



@type1_blueprint.route('/owner_meetings', methods=['GET'])
def owner_meetings():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    if session.get("role") != "owner":
        return jsonify({"error": "Owner access required"}), 403

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                m.meetingID,
                m.date,
                m.start_time,
                m.end_time,
                m.status,
                m.zoom_link,
                u.name AS student_name,
                u.email AS student_email
            FROM RequestMeeting r
            JOIN Meeting m ON m.meetingID = r.meetingID
            JOIN User u ON u.userID = r.studentID
            WHERE r.ownerID = ?
              AND m.status IN ('accepted', 'cancelled')
            ORDER BY m.date, m.start_time
        """, (session["user_id"],))

        rows = cursor.fetchall()

        return jsonify({
            "meetings": [
                {
                    "meetingID": row["meetingID"],
                    "student_name": row["student_name"],
                    "student_email": row["student_email"],
                    "date": row["date"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "zoom_link": row["zoom_link"],
                    "status": row["status"]
                }
                for row in rows
            ]
        }), 200

    finally:
        conn.close()