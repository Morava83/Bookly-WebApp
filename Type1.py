from flask import Blueprint
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

#Create Blueprint Object
type1_blueprint = Blueprint('Type1', __name__)

#Rout inside blueprint
@type1_blueprint.route('/process1/<data>')

def send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password):
    # Create the email
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))  # plain text

    # Connect to SMTP server and send
    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()  # secure the connection
        server.login(username, password)
        server.send_message(msg)
        print(f"Email sent to {to_email}")

#EXAMPLE CALL
# send_email(
#     subject="Test Plain Text Email",
#     body="Hello! This is a plain text email from Python.",
#     to_email="recipient@example.com",
#     from_email="you@example.com",
#     smtp_server="smtp.gmail.com",
#     smtp_port=587,
#     username="you@example.com",
#     password="your_app_password"
# )

def send_notification(msg):
    from app import socketio
    socketio.emit('notification', {'message': msg})

def request_meeting(msg):
    #Student sends Owner a message requesting meeting

    #Send email
    send_email(
    subject="Test Plain Text Email",
    body="Hello! This is a plain text email from Python.",
    to_email="recipient@example.com",
    from_email="you@example.com",
    smtp_server="smtp.gmail.com",
    smtp_port=587,
    username="you@example.com",
    password="your_app_password"
    )
    #Send Notification
    send_notification(msg)
