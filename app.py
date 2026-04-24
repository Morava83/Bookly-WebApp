from flask import Flask, render_template, request, jsonify, session
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO
import sqlite3
import os

# Blueprint is registered at the bottom
from Type1 import type1_blueprint
from Type2 import type2_blueprint
from Type3 import type3_blueprint

import database.CreateTables

app = Flask(__name__, template_folder="templates")
#socketio = SocketIO(app)
socketio = SocketIO(app, cors_allowed_origins="*")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key") # Change later

# Dynamic media query
# SMTP config
# Zoom app
app.config.update({
    "FROM_EMAIL": os.environ.get("FROM_EMAIL", "your_email@mail.mcgill.ca"),
    "EMAIL_PASSWORD": os.environ.get("EMAIL_PASSWORD", "your_app_password"),
    "SMTP_SERVER": os.environ.get("SMTP_SERVER", "smtp.office365.com"),
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

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

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

        return jsonify({
            "message": "Login successful",
            "userID": user["userID"],
            "role": role
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

# ======== Blueprints ======== 
app.register_blueprint(type1_blueprint, url_prefix="/api/type1")
app.register_blueprint(type2_blueprint, url_prefix="/api/type2")
app.register_blueprint(type3_blueprint, url_prefix="/api/type3")

if __name__ == "__main__":
    socketio.run(app, debug=True)