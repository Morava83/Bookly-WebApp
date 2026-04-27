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
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")

def get_db_path():
    try:
        return current_app.config.get("DB_PATH") or os.environ.get("DB_PATH", DEFAULT_DB_PATH)
    except RuntimeError:
        return os.environ.get("DB_PATH", DEFAULT_DB_PATH)

#--------Query----------

def get_db_connection():
    conn = sqlite3.connect(get_db_path())
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
@type2_blueprint.route('/group_meeting', methods=['GET'])
def get_schedule():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    meeting_id = request.args.get("meetingID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
                   SELECT DISTINCT gm.startDate, gm.endDate, a.start_time, a.end_time, a.day
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
    
    #Debugging
    # print("RECEIVED DATA:", data)
    # print("SLOTS:", slots)

    if not title or not slots:
        return jsonify({"error": "Missing required fields"}), 400

    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    owner_id = session["user_id"]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        
        # 1. Create base Meeting record
        
        cursor.execute("""
        INSERT INTO Meeting (date, start_time, end_time, status)
        VALUES (NULL, NULL, NULL, 'open')
    """)

        meeting_id = cursor.lastrowid

        
        # 2. Create GroupMeeting record

        start_dates = [s.get("start_date") for s in slots if s.get("start_date")]
        end_dates = [s.get("end_date") for s in slots if s.get("end_date")]

        if not start_dates or not end_dates:
            return jsonify({"error": "Invalid slot data"}), 400

        start_date = min(start_dates)
        end_date = max(end_dates)
        
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
            start_date,
            end_date
        ))

        
        # 3. Insert availability slots
        
        for slot in slots:
            cursor.execute("""
                INSERT INTO Availability (
                    meetingID, day, start_time, end_time
                )
                VALUES (?, ?, ?, ?)
            """, (
                meeting_id,
                slot["day"],  # TODO: map real weekday if needed
                slot["start_time"],
                slot["end_time"]
            ))

        conn.commit()

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

    conn.close()

   
    # 4. Return meeting ID to frontend
   
    invite_url = f"/group/{meeting_id}"

    return jsonify({
        "status": "ok",
        "meetingID": meeting_id,
        "invite_url": invite_url
    })

#To be put in STUDENT VIEW Dashboard where all Type2 meetings should be display
@type2_blueprint.route('/group_meeting/student_view', methods=['POST'])
def get_group_meetings():
    data = request.get_json()
    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
        a.availabilityID,
        gm.title,
        gm.startDate,
        gm.endDate,
        a.start_time,
        a.end_time,
        m.status,
        m.zoom_link,
        COUNT(v.studentID) AS vote_count
        FROM GroupMeeting gm
        JOIN Meeting m 
            ON gm.meetingID = m.meetingID
        JOIN Availability a
            ON a.meetingID = gm.meetingID
        LEFT JOIN Vote v
            ON v.availabilityID = a.availabilityID
        WHERE gm.meetingID = ?
        GROUP BY 
            a.availabilityID,
            gm.title,
            gm.startDate,
            gm.endDate,
            a.start_time,
            a.end_time,
            m.status,
            m.zoom_link
    """, (meeting_id,))

    meetings = cursor.fetchall()
    results = [
        {"Availability": m[0], "Title": m[1], "Start Date": m[2], "End Date": m[3], "Start Time": m[4], "End Time": m[5], "Status": m[6], "Zoom Link": m[7], "Count": m[8]}
        for m in meetings
    ]
    conn.close()

    return jsonify(results)



@type2_blueprint.route('/group_meeting/finalize', methods=['POST'])
def finalize_meeting():
    data = request.get_json()

    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT ownerID FROM GroupMeeting WHERE meetingID = ?",
        (meeting_id,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Meeting not found"}), 404

    owner_id = row["ownerID"]

    # AUTH CHECK
    if session["user_id"] != owner_id:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    # proceed with updating Meeting table
    cursor.execute("""
        UPDATE Meeting
        SET date = ?, start_time = ?, end_time = ?, status = 'open'
        WHERE meetingID = ?
    """, (data["date"], data["start_time"], data["end_time"], meeting_id))

    conn.commit()
    conn.close()

    return jsonify({"status": "ok"})

#Function that changes status from open to booked or closed
#Using form with radio button or checkbox
@type2_blueprint.route('/group_meeting/decide', methods=['POST'])
def decide_meeting():
    data = request.get_json()

    meeting_id = data.get("meetingID")
    availability_id = data.get("availabilityID")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if not availability_id:
        return jsonify({"error": "Missing availabilityID"}), 400
    
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Mark selected availability as booked
        cursor.execute("""
            UPDATE Availability
            SET status = 'booked'
            WHERE availabilityID = ?
        """, (availability_id,))

        # 2. Close all OTHER availabilities for the SAME meeting
        cursor.execute("""
            UPDATE Availability
            SET status = 'closed'
            WHERE meetingID = ?
              AND availabilityID != ?
        """, (meeting_id, availability_id))

        conn.commit()

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

    #Send email to Owner once meeting is booked
    #send_email(subject, body, to_email, from_email, smtp_server, smtp_port, username, password, zoom)
    #TODO Optionally delete all closed availability

    return jsonify({"message": "Meeting decided successfully"})

#----------FORM TO DATABASE------------
#Student chooses most convenient dates & time slots out of those made available by the TA
@type2_blueprint.route('/group_meeting/vote', methods=['POST'])
def submit_vote():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON received"}), 400

    meeting_id = data.get("meetingID")
    availability_id = data.get("availabilityID")

    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    student_id = session["user_id"]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO Vote (
                studentID, availabilityID
            )
            VALUES (?, ?)
        """, (
            student_id,
            availability_id
        ))

        #OPTION 1: Keep track of counter with counter attribute
        # increment vote count (optional but useful)
        # cursor.execute("""
        #     UPDATE Availability
        #     SET count = count + 1
        #     WHERE availabilityID = ?
        # """, (availability_id,))

        # Count number of votes via query using COUNT aggregation

        conn.commit()

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

    conn.close()

    return jsonify({"status": "ok"})

@type2_blueprint.route('/group_meeting/vote_counts', methods=['GET'])
def get_all_vote_counts():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.availabilityID, COUNT(v.studentID) AS vote_count
        FROM Availability a
        LEFT JOIN Vote v
        ON a.availabilityID = v.availabilityID
        GROUP BY a.availabilityID;
    """)

    rows = cursor.fetchall()
    conn.close()

    result = [
        {"availabilityID": r[0], "vote_count": r[1]}
        for r in rows
    ]

    return jsonify(result)

#Get list of invited users --> assumes students as a list of student ids --> list of integers
def get_guests(students):
    conn = get_db_connection()
    cursor = conn.cursor()
    results = []

    for student in students:
        cursor.execute("""
            SELECT *
            FROM User u
            JOIN Student s ON u.userId = s.userId
            WHERE u.userId = ?
        """, (student,))

        row = cursor.fetchone()
        if row:
            results.append(row)

    conn.close()
    return results

#Get owner recurring time slots

#--------Schedule Meeting----------

#======Helper Functions==========
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
#TODO Check how where to call send_email which should send email to owner that meeting is booked

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

