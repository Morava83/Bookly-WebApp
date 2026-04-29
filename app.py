from flask import Flask, render_template, request, jsonify, session, redirect
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO, join_room
import sqlite3
import os

import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Blueprint is registered at the bottom
from Type1 import type1_blueprint
from Type2 import type2_blueprint
from Type3 import type3_blueprint

import database.CreateTables

app = Flask(__name__, template_folder="templates")
#socketio = SocketIO(app)
socketio = SocketIO(app, cors_allowed_origins="*")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key") # Change later

@socketio.on("connect")
def handle_socket_connect():
    if "user_id" in session:
        join_room(str(session["user_id"]))
        print(f"User {session['user_id']} connected to notification room")

# Dynamic media query
# SMTP config
# Zoom app
app.config.update({
    "FROM_EMAIL": os.environ.get("FROM_EMAIL", "bookly.app.comp307@gmail.com"),
    "EMAIL_PASSWORD": os.environ.get("EMAIL_PASSWORD", "wpdz cbcx bpam fbfu"),
    "SMTP_SERVER": os.environ.get("SMTP_SERVER", "smtp.gmail.com"),
    "SMTP_PORT": int(os.environ.get("SMTP_PORT", "587")),
    "DB_PATH": os.environ.get("DB_PATH", "database/bookly.db"),
    "ZOOM_ACCOUNT_ID": os.environ.get("ZOOM_ACCOUNT_ID", ""),
    "ZOOM_CLIENT_ID": os.environ.get("ZOOM_CLIENT_ID", ""),
    "ZOOM_CLIENT_SECRET": os.environ.get("ZOOM_CLIENT_SECRET", ""),
})

database.CreateTables.create_tables()

# ======== DB helper ========
def get_db_connection():
    conn = sqlite3.connect(app.config["DB_PATH"])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

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

# Using Werkzeug for password
def hash_password(password):
    return generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)

def get_role_for_user(conn, user_id):
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM Owner WHERE userID = ?", (user_id,))
    if cur.fetchone():
        return "owner"

    cur.execute("SELECT 1 FROM Student WHERE userID = ?", (user_id,))
    if cur.fetchone():
        return "user"

    return None

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


# ======== Auth Routes ========
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = normalize_email(data.get("email"))
    password = data.get("password") or ""
    code = (data.get("code") or "").strip()

    if not first_name or not last_name or not email or not password or not code:
        return jsonify({"error": "Missing required fields"}), 400
    
    if session.get("verify_code") != code or session.get("verify_email") != email:
        return jsonify({"error": "Invalid or expired verification code"}), 400

    if not is_mcgill_email(email):
        return jsonify({"error": "Only McGill emails can register"}), 400

    role = get_role_from_email(email)
    if role is None:
        return jsonify({"error": "Invalid email domain"}), 400

    full_name = f"{first_name} {last_name}".strip()
    password_hash = hash_password(password)

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # User table from ER-style schema
        cur.execute("SELECT userID FROM User WHERE email = ?", (email,))
        if cur.fetchone():
            conn.close()
            return jsonify({"error": "Email already registered"}), 409

        cur.execute(
            "INSERT INTO User (email, password, name) VALUES (?, ?, ?)",
            (email, password_hash, full_name)
        )
        user_id = cur.lastrowid

        if role == "owner":
            cur.execute("INSERT INTO Owner (userID) VALUES (?)", (user_id,))
        else:
            cur.execute("INSERT INTO Student (userID) VALUES (?)", (user_id,))

        conn.commit()

        session.pop("verify_code", None)
        session.pop("verify_email", None)

        return jsonify({
            "message": "Registered successfully",
            "userID": user_id,
            "role": role
        }), 201

    finally:
        conn.close()

@app.route("/api/login", methods=["POST"])
def login_api():
    data = request.get_json() or {}

    email = normalize_email(data.get("email"))
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM User WHERE email = ?", (email,))
        user = cur.fetchone()

        if not user or not verify_password(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401

        role = get_role_for_user(conn, user["userID"])
        if role is None:
            return jsonify({"error": "User role not found"}), 500

        session["user_id"] = user["userID"]
        session["email"] = user["email"]
        session["role"] = role

        redirect_url = session.pop("next_after_login", None)

        if not redirect_url:
            redirect_url = "/home"

        return jsonify({
            "message": "Login successful",
            "userID": user["userID"],
            "role": role,
            "redirect_url": redirect_url
        }), 200

    finally:
        conn.close()

@app.route("/api/logout", methods=["POST"])
def logout_api():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.route("/api/me", methods=["GET"])
@login_required
def me():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT * FROM User WHERE userID = ?", (session["user_id"],))
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "userID": user["userID"],
            "email": user["email"],
            "name": user["name"],
            "role": session["role"]
        }), 200

    finally:
        conn.close()

@app.route("/api/send-verification", methods=["POST"])
def send_verification():
    data = request.get_json() or {}
    email = normalize_email(data.get("email"))
    
    if not email:
        return jsonify({"error": "Missing email"}), 400
    if not is_mcgill_email(email):
        return jsonify({"error": "Only McGill emails can register"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM User WHERE email = ?", (email,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Email already registered"}), 409
    conn.close()
    
    code = str(random.randint(100000, 999999))
    session["verify_code"] = code
    session["verify_email"] = email
    
    try:
        msg = MIMEMultipart()
        msg["From"] = app.config["FROM_EMAIL"]
        msg["To"] = email
        msg["Subject"] = "Bookly - Your verification code"
        msg.attach(MIMEText(f"Your Bookly verification code is: {code}\n\nThis code expires when you close the page.", "plain"))
        
        with smtplib.SMTP(app.config["SMTP_SERVER"], app.config["SMTP_PORT"]) as server:
            server.starttls()
            server.login(app.config["FROM_EMAIL"], app.config["EMAIL_PASSWORD"])
            server.send_message(msg)
    except Exception as e:
        print("Verification email error:", e)
        return jsonify({"error": "Could not send verification email. Check your email and try again."}), 500
    
    return jsonify({"message": "Verification code sent"}), 200

@app.route("/api/owners", methods=["GET"])
@login_required
def get_owners():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT u.userID, u.name, u.email
            FROM Owner o
            JOIN User u ON o.userID = u.userID
            ORDER BY u.name
        """)
        rows = cur.fetchall()

        return jsonify({
            "owners": [
                {
                    "userID": row["userID"],
                    "name": row["name"],
                    "email": row["email"]
                }
                for row in rows
            ]
        }), 200
    finally:
        conn.close()

@app.route("/api/owners/search", methods=["GET"])
@login_required
def search_owners():
    q = request.args.get("q", "").strip().lower()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.userID, u.name, u.email FROM User u
        JOIN Owner o ON o.userID = u.userID
        WHERE LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?
    """, (f"%{q}%", f"%{q}%"))
    rows = cur.fetchall()
    conn.close()
    return jsonify({"owners": [dict(r) for r in rows]})

# -====== Invitational Link ===========
@app.route("/book/owner/<int:owner_id>")
def book_owner_slots(owner_id):
    if "user_id" not in session:
        session["next_after_login"] = f"/book/owner/{owner_id}"
        return redirect("/")

    return render_template("HomePage.html", booking_owner_id=owner_id)

# ======== Pages ==========
@app.route("/")
def login_page():
    return render_template("LandingLoginPage.html")

@app.route("/create-account")
def create_account_page():
    return render_template("CreateAccountPage.html")

@app.route("/home")
@login_required
def home_page():
    if session["role"] == "owner":
        return render_template("OwnerHomePage.html")
    return render_template("HomePage.html")

@app.route("/book")
@login_required
def book_page():
    return render_template("HomePage.html")

# ======= Notification ==========
@app.route("/api/notifications", methods=["GET"])
@login_required
def get_notifications():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT notificationID, message, is_read, created_at
            FROM Notification
            WHERE userID = ?
            ORDER BY created_at DESC
            LIMIT 20
        """, (session["user_id"],))

        rows = cur.fetchall()

        cur.execute("""
            SELECT COUNT(*) AS unread_count
            FROM Notification
            WHERE userID = ? AND is_read = 0
        """, (session["user_id"],))

        unread_count = cur.fetchone()["unread_count"]

        return jsonify({
            "notifications": [
                {
                    "notificationID": row["notificationID"],
                    "message": row["message"],
                    "is_read": row["is_read"],
                    "created_at": row["created_at"]
                }
                for row in rows
            ],
            "unread_count": unread_count
        }), 200

    finally:
        conn.close()


@app.route("/api/notifications/mark-read", methods=["POST"])
@login_required
def mark_notifications_read():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE Notification
            SET is_read = 1
            WHERE userID = ?
        """, (session["user_id"],))

        conn.commit()
        return jsonify({"success": True}), 200

    finally:
        conn.close()

# ======== Blueprints ======== 
app.register_blueprint(type1_blueprint, url_prefix="/api/type1")
app.register_blueprint(type2_blueprint, url_prefix="/api/type2")
app.register_blueprint(type3_blueprint, url_prefix="/api/type3")

if __name__ == "__main__":
    socketio.run(app, debug=True)