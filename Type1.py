from flask import Blueprint, request, current_app, jsonify
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

#Type1: Request Meeting

#Create Blueprint Object
type1_blueprint = Blueprint('Type1', __name__)

DB_PATH = "bookly.db"

def send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password):
    # Create the email
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    # Connect to SMTP server and send
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
            print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email: {e}")


def send_notification(msg):
    from app import socketio
    socketio.emit('notification', {'message': msg})

# Database helper
def insert_meeting_request(user_email, owner_email, message):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Booking (userID, slotID)
        VALUES (
            (SELECT userID FROM users WHERE email=?),
            (SELECT slotID FROM TimeSlot WHERE ownerID=(SELECT ownerID FROM Owners WHERE email=?) LIMIT 1)
        )
    """, (user_email, owner_email))
    conn.commit()
    conn.close()

# Flask route to request a meeting
@type1_blueprint.route('/request_meeting', methods=['POST'])
def request_meeting(msg):
    #Student sends Owner a message requesting meeting

    # Read form data
    user_email = request.form.get('student_email') #TODO find email via media query
    owner_email = request.form.get('owner_email') #Using media query
    message = request.form.get('message')

    if not user_email or not owner_email or not message:
        return "Missing required fields", 400

    # Get dynamic config from app.py
    FROM_EMAIL = current_app.config.get("FROM_EMAIL")
    EMAIL_PASSWORD = current_app.config.get("EMAIL_PASSWORD")
    SMTP_SERVER = current_app.config.get("SMTP_SERVER")
    SMTP_PORT = current_app.config.get("SMTP_PORT")

    # Save request in DB
    insert_meeting_request(user_email, owner_email, message)

    # Send email
    send_email(
        subject="New Meeting Request",
        body=f"Student {user_email} requests a meeting:\n\n{message}",
        to_email=owner_email,
        from_email=FROM_EMAIL,
        smtp_server=SMTP_SERVER,
        smtp_port=SMTP_PORT,
        username=FROM_EMAIL,
        password=EMAIL_PASSWORD
    )

    # Send dashboard notification
    send_notification(f"New meeting request from {user_email}")

    return "Meeting request submitted successfully"

#Function called on event where Owner presses on some accept button
#in home page to accept meeting
def approve_meeting(slotID, userID):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE Booking
        SET status = ?
        WHERE slotID = ? AND userID = ?
    """, (1, slotID, userID)) #Status changes from 0 to 1 as meeting request is now approved
    conn.commit()
    conn.close()
    #TODO Send email to notify student
    #TODO Display on user dashboard
    #TODO Display on owner dashboard