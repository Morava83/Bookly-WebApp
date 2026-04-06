from flask import Flask, request, jsonify, session, render_template
import sqlite3 
from datetime import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash 
import uuid
from Type1 import type1_blueprint
import database.CreateTables
from flask_socketio import SocketIO

# from Type2 import type2_blueprint
# from Type3 import type3_blueprint

app = Flask(__name__)
socketio = SocketIO(app)
app.secret_key = "dev-secret-key" # Change later

# ======== Database =========

# Database = "bookly.db"

# def get_db_connection():
#     conn = sqlite3.connect(Database)
#     conn.row_factory = sqlite3.Row
#     return conn

# def init_db():
#     conn = get_db_connection()
#     cursor = conn.cursor()

#     cursor.execute('''
#         CREATE TABLE IF NOT EXISTS users (
#             userID INTEGER PRIMARY KEY AUTOINCREMENT,
#             email VARCHAR(100) NOT NULL UNIQUE,
#             password VARCHAR(100) NOT NULL,
#             name VARCHAR(100) NOT NULL
#             role TEXT CHECK(role IN ('owner', 'user')) NOT NULL
#         )
#     ''')

#     cursor.execute('''
#         CREATE TABLE IF NOT EXISTS Owners (
#             ownerID INTEGER PRIMARY KEY AUTOINCREMENT,
#             email VARCHAR(100) NOT NULL,
#             password VARCHAR(100) NOT NULL,
#             name VARCHAR(100) NOT NULL
#         )
#     ''')

#     cursor.execute('''
#         CREATE TABLE IF NOT EXISTS TimeSlot (
#             slotID INTEGER PRIMARY KEY AUTOINCREMENT,
#             ownerID INTEGER NOT NULL,
#             date DATE NOT NULL,
#             startTime TIME NOT NULL,
#             endTime TIME NOT NULL,
#             isActivated INTEGER NOT NULL CHECK (isActivated IN (0, 1)),
#             bookType INTEGER NOT NULL CHECK (bookType IN (1, 2, 3))
#             isRecurring INTEGER NOT NULL CHECK (isRecurring IN (0, 1)),
#             recurrenceType VARCHAR(10),
#             numOfRecurrences INTEGER,
#             FOREIGN KEY (ownerID) REFERENCES Owners(ownerID)
#         )
#     ''')

#     cursor.execute('''
#         CREATE TABLE IF NOT EXISTS Booking (
#             userID INTEGER NOT NULL,
#             slotID INTEGER NOT NULL,
#             PRIMARY KEY (userID, slotID),
#             FOREIGN KEY (userID) REFERENCES users(userID),
#             FOREIGN KEY (slotID) REFERENCES TimeSlot(slotID)
#         )
#     ''')

#     conn.commit()
#     conn.close()


# ======== Temp Database ========

users = []
booking_slots = []
meeting_requests = []
group_meetings = []
group_votes = []
type3_series_list = []
invitation_links = []

next_ids = {
    "users": 1,
    "booking_slots": 1,
    "meeting_requests": 1,
    "group_meetings": 1,
    "type3_series": 1,
    "invitation_links": 1
}

def now():
    return datetime.now().isoformat(timespec="seconds")

def next_id(table_name):
    value = next_ids[table_name]
    next_ids[table_name] += 1
    return value

# ======== Authentication ========

def normalize_email(email):
    return (email or "").strip().lower()

def is_mcgill_email(email):
    email = normalize_email(email)
    return email.endswith("@mail.mcgill.ca") or email.endswith("@mcgill.ca")

def get_role_from_email(email):
    email = normalize_email(email)
    if email.endswith("@mcgill.ca"):
        return "owner"
    if email.endswith("@mail.mcgill.ca"):
        return "user"
    return None

def hash_password(password):
    return generate_password_hash(password)

def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        return fn(*args, **kwargs)
    return wrapper

def owner_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        if session.get("role") != "owner":
            return jsonify({"error": "Owner access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

# ======= Validators ========
def required_fields(data, fields):
    missing = []
    for field in fields:
        value = data.get(field)
        if value is None:
            missing.append(field)
        elif not isinstance(value, str) and value.strip() == "":
            missing.append(field)
    return missing

def validate_type1_payload(data):
    #TODO
    return None

def validate_type2_payload(data):
    #TODO
    return None

def validate_type3_payload(data):
    #TODO
    return None

# ======== Repository Functions ========

def create_user(first_name, last_name, email, password_hash, role):
    user = {
        "id": next_id("users"),
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "created_at": now()
    }
    users.append(user)

    # Future DB version:
    # conn = get_db_connection()
    # cursor = conn.cursor()
    # cursor.execute(
    #     "INSERT INTO users (first_name, last_name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    #     (first_name, last_name, email, password_hash, role, now())
    # )
    # conn.commit()
    # conn.close()

    return user

def find_user_by_email(email):
    email = normalize_email(email)
    for user in users:
        if user["email"] == email:
            return user
    return None

def find_user_by_id(user_id):
    for user in users:
        if user["id"] == user_id:
            return user
    return None

def create_booking_slot(owner_id, booking_type, start_datetime, end_datetime, title="", description="", source_id=None, is_active=True, is_booked=False, booked_by_user_id=None):
    slot = {
        "id": next_id("booking_slots"),
        "owner_id": owner_id,
        "booking_type": booking_type,
        "source_id": source_id,
        "title": title,
        "description": description,
        "start_datetime": start_datetime,
        "end_datetime": end_datetime,
        "is_active": is_active,
        "is_booked": is_booked,
        "booked_by_user_id": booked_by_user_id,
        "created_at": now()
    }
    booking_slots.append(slot)
    return slot


# Register blueprint
app.register_blueprint(type1_blueprint)

@app.route("/")
#LOGIN PAGE
def login():
    return render_template('Landing&LoginPage.html')

# CREATE ACCOUNT PAGE
def create_account():
    return render_template('CreateAccountPage.html')

def home():
    return render_template('HomePage.html')
    #return "<h1>Hello from Flask!</h1>"

if __name__ == "__main__":
    #print("hello world")
    app.run(debug=False)  # <- This starts the server

