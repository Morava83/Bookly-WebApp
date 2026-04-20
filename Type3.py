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
#User picks slots to book appointment
#Email is sent to owner
#Possibly include zoom link in email

#Booking must appear on user and owner dashboard

#----------Database------------
#Update Booking table with a modification (insert) command
