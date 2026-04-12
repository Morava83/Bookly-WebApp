from flask import Blueprint, request, current_app, jsonify
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# Blueprint

type1_blueprint = Blueprint('type1', __name__)

DB_PATH = "bookly.db"



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



# DB HELPERS

def get_user_id(email):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT userID FROM User WHERE email=?", (email,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

@type1_blueprint.route("/create_meeting", methods=["POST"])
def create_meeting(student_id, owner_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO Meeting (date, start_time, end_time, status)
        VALUES (DATE('now'), '00:00', '00:00', 'pending')
    """)

    #Access the last inserted meeting
    meeting_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO RequestMeeting (meetingID, ownerID, studentID, message)
        VALUES (?, ?, ?, '')
    """, (meeting_id, owner_id, student_id))

    cursor.execute("""
        INSERT INTO Booking1 (studentID, ownerID, meetingID)
        VALUES (?, ?, ?)
    """, (student_id, owner_id, meeting_id))

    conn.commit()
    conn.close()

    return meeting_id



# TYPE 1 - REQUEST MEETING

@type1_blueprint.route('/request_meeting', methods=['POST'])
def request_meeting():
    user_email = request.form.get('student_email')
    owner_email = request.form.get('owner_email')
    message = request.form.get('message')

    if not user_email or not owner_email or not message:
        return jsonify({"error": "Missing required fields"}), 400

    student_id = get_user_id(user_email)
    owner_id = get_user_id(owner_email)

    if not student_id or not owner_id:
        return jsonify({"error": "Invalid user"}), 400

    # Create meeting request
    meeting_id = create_meeting(student_id, owner_id)

    # Update message in RequestMeeting (since insert used empty string earlier)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE RequestMeeting
        SET message = ?
        WHERE meetingID = ?
    """, (message, meeting_id))
    conn.commit()
    conn.close()

    # Email owner
    config = current_app.config

    send_email(
        subject="New Meeting Request",
        body=f"New request from {user_email}:\n\n{message}",
        to_email=owner_email,
        from_email=config.get("FROM_EMAIL"),
        smtp_server=config.get("SMTP_SERVER"),
        smtp_port=config.get("SMTP_PORT"),
        username=config.get("FROM_EMAIL"),
        password=config.get("EMAIL_PASSWORD")
    )

    # Socket notification
    send_notification(f"New meeting request from {user_email}", owner_id)

    return jsonify({
        "success": True,
        "meetingID": meeting_id
    })



# GET PENDING REQUESTS (OWNER DASHBOARD)

@type1_blueprint.route('/pending/<owner_email>', methods=['GET'])
def get_pending(owner_email):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            m.meetingID,
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
            "meetingID": r[0],
            "student_email": r[1],
            "message": r[2],
            "status": r[3]
        }
        for r in rows
    ])



# ACCEPT MEETING

@type1_blueprint.route('/accept', methods=['POST'])
def accept_meeting():
    data = request.get_json()
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE Meeting
        SET status = 'accepted'
        WHERE meetingID = ?
    """, (meeting_id,))

    # Get student email
    cursor.execute("""
        SELECT r.studentID, u.email
        FROM RequestMeeting r
        JOIN User u ON r.studentID = u.userID
        WHERE r.meetingID = ?
    """, (meeting_id,))

    row = cursor.fetchone()
    student_id = row[0]
    student_email = row[1]

    send_notification(
        f"Meeting accepted for {student_email}",
        student_id
)

    conn.commit()
    conn.close()

    student_email = row[0] if row else None

    # Notify student
    if student_email:
        config = current_app.config

        send_email(
            subject="Meeting Accepted",
            body="Your meeting request has been accepted.",
            to_email=student_email,
            from_email=config.get("FROM_EMAIL"),
            smtp_server=config.get("SMTP_SERVER"),
            smtp_port=config.get("SMTP_PORT"),
            username=config.get("FROM_EMAIL"),
            password=config.get("EMAIL_PASSWORD")
        )

        send_notification(f"Meeting accepted for {student_email}", student_id)

    return jsonify({"success": True})



# DECLINE MEETING

@type1_blueprint.route('/decline', methods=['POST'])
def decline_meeting():
    data = request.get_json()
    meeting_id = data.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE Meeting
        SET status = 'declined'
        WHERE meetingID = ?
    """, (meeting_id,))

    conn.commit()
    conn.close()

    cursor.execute("""
        SELECT r.studentID, u.email
        FROM RequestMeeting r
        JOIN User u ON r.studentID = u.userID
        WHERE r.meetingID = ?
    """, (meeting_id,))

    row = cursor.fetchone()

    student_id = row[0]
    student_email = row[1]  

    send_notification(f"Meeting declined (ID: {meeting_id})", student_id)

    return jsonify({"success": True})

    #TODO Send email to notify student (with Zoom link)

    #TODO Display on user dashboard
    

    #TODO Display on owner dashboard