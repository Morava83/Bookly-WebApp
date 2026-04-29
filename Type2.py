from flask import Blueprint, request, current_app, jsonify, session
import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from zoom_utils import create_type2_zoom_meeting
from datetime import datetime, timedelta

from notifications import create_notification

# -------Type 2: Group Meeting-------------

type2_blueprint = Blueprint('Type2', __name__)

BASE_DIR = os.path.dirname(__file__)
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")


def get_db_path():
    try:
        return current_app.config.get("DB_PATH") or os.environ.get("DB_PATH", DEFAULT_DB_PATH)
    except RuntimeError:
        return os.environ.get("DB_PATH", DEFAULT_DB_PATH)


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


def get_owner(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT *
        FROM User u
        JOIN Owner o ON u.userId = o.userId
        WHERE o.userId = ?
        """,
        (user_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return row if row else None


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
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Email error: {e}")


def get_participant_id_by_email(email):
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


def get_guests(students):
    conn = get_db_connection()
    cursor = conn.cursor()
    results = []
    for student in students:
        cursor.execute(
            """
            SELECT *
            FROM User u
            JOIN Student s ON u.userId = s.userId
            WHERE u.userId = ?
            """,
            (student,),
        )
        row = cursor.fetchone()
        if row:
            results.append(row)
    conn.close()
    return results


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


@type2_blueprint.route('/group_meeting', methods=['GET'])
def get_schedule():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    meeting_id = request.args.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            a.availabilityID,
            a.date,
            a.start_time,
            a.end_time,
            a.count,
            a.status,
            COUNT(v.studentID) AS vote_count
        FROM Availability a
        LEFT JOIN Vote v ON v.availabilityID = a.availabilityID
        WHERE a.meetingID = ?
        GROUP BY a.availabilityID, a.date, a.start_time, a.end_time, a.count, a.status
        ORDER BY a.date, a.start_time
        """,
        (meeting_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    availabilities = [
        {
            "availabilityID": row["availabilityID"],
            "date": row["date"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "count": row["count"],
            "status": row["status"],
            "vote_count": row["vote_count"],
        }
        for row in rows
    ]
    return jsonify({"meetingID": meeting_id, "availabilities": availabilities})


@type2_blueprint.route('/group_meeting', methods=['POST'])
def create_group_meeting():
    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "No JSON received"}), 400

    title = data.get("title")
    description = data.get("description")
    slots = data.get("slots") or []
    invitees = data.get("invitees") or []
    is_recurring = int(data.get("isRecurring") or 0)
    recurrence_type = data.get("recurrenceType") if is_recurring else None
    recurrence_end_date = data.get("recurrenceEndDate") if is_recurring else None

    if not title or not slots:
        return jsonify({"error": "Missing required fields"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    owner_id = session["user_id"]
    normalized_slots = []

    for slot in slots:
        slot_date = slot.get("date") or slot.get("start_date")
        start_time = slot.get("start_time")
        end_time = slot.get("end_time")

        if not slot_date or not start_time or not end_time:
            return jsonify({"error": "Each slot needs date, start_time, and end_time"}), 400

        try:
            start_dt = datetime.strptime(f"{slot_date} {start_time}", "%Y-%m-%d %H:%M")
            end_dt = datetime.strptime(f"{slot_date} {end_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            return jsonify({"error": "Invalid slot date or time format"}), 400

        if end_dt <= start_dt:
            return jsonify({"error": "Each slot end time must be after start time"}), 400

        normalized_slots.append(
            {"date": slot_date, "start_time": start_time, "end_time": end_time}
        )

    slot_dates = [slot["date"] for slot in normalized_slots]
    start_date = min(slot_dates)
    end_date = max(slot_dates)

    if is_recurring:
        if recurrence_type != "weekly":
            return jsonify({"error": "Only weekly recurrence is currently supported"}), 400
        if not recurrence_end_date:
            return jsonify({"error": "Missing recurrence end date"}), 400
        try:
            first_date_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            recurrence_end_dt = datetime.strptime(recurrence_end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid recurrence end date format"}), 400
        if recurrence_end_dt < first_date_dt:
            return jsonify({"error": "Recurrence end date must be after the first slot date"}), 400
        end_date = recurrence_end_date
    else:
        recurrence_type = None
        recurrence_end_date = None

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        first_slot = normalized_slots[0]
        cursor.execute(
            """
            INSERT INTO Meeting (date, start_time, end_time, status)
            VALUES (?, ?, ?, 'open')
            """,
            (first_slot["date"], first_slot["start_time"], first_slot["end_time"]),
        )
        meeting_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO GroupMeeting (
                meetingID,
                ownerID,
                title,
                description,
                startDate,
                endDate,
                isRecurring,
                recurrenceType,
                numOfRecurrences
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                meeting_id,
                owner_id,
                title,
                description,
                start_date,
                end_date,
                is_recurring,
                recurrence_type,
                None,
            ),
        )

        for slot in normalized_slots:
            cursor.execute(
                """
                INSERT INTO Availability (
                    meetingID,
                    date,
                    start_time,
                    end_time,
                    status
                )
                VALUES (?, ?, ?, ?, 'open')
                """,
                (meeting_id, slot["date"], slot["start_time"], slot["end_time"]),
            )

        saved_invitees = 0
        for email in invitees:
            email = (email or "").strip().lower()
            if not email:
                continue
            student_id = get_participant_id_by_email(email)
            if not student_id:
                continue
            cursor.execute(
                "INSERT OR IGNORE INTO GroupInvite (meetingID, studentID) VALUES (?, ?)",
                (meeting_id, student_id),
            )
            if cursor.rowcount > 0:
                saved_invitees += 1
                create_notification(
                    student_id,
                    f"You were invited to vote for group meeting '{title}'."
                )

            

        conn.commit()
        return jsonify(
            {
                "status": "ok",
                "meetingID": meeting_id,
                "invite_url": f"/group/{meeting_id}",
                "saved_invitees": saved_invitees,
                "isRecurring": is_recurring,
                "recurrenceType": recurrence_type,
                "recurrenceEndDate": recurrence_end_date,
            }
        ), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/owner', methods=['GET'])
def owner_group_meetings():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401
    if session.get("role") != "owner":
        return jsonify({"error": "Owner access required"}), 403

    owner_id = session["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                gm.meetingID,
                gm.title,
                gm.description,
                gm.startDate,
                gm.endDate,
                gm.isRecurring,
                gm.recurrenceType,
                gm.numOfRecurrences,
                m.date,
                m.start_time,
                m.end_time,
                m.status,
                m.zoom_link,
                COUNT(DISTINCT gi.studentID) AS invited_count,
                COUNT(DISTINCT v.studentID) AS voted_count
            FROM GroupMeeting gm
            JOIN Meeting m ON m.meetingID = gm.meetingID
            LEFT JOIN GroupInvite gi ON gi.meetingID = gm.meetingID
            LEFT JOIN Availability a ON a.meetingID = gm.meetingID
            LEFT JOIN Vote v ON v.availabilityID = a.availabilityID
            WHERE gm.ownerID = ?
            GROUP BY
                gm.meetingID, gm.title, gm.description, gm.startDate, gm.endDate,
                gm.isRecurring, gm.recurrenceType, gm.numOfRecurrences,
                m.date, m.start_time, m.end_time, m.status, m.zoom_link
            ORDER BY gm.startDate DESC, gm.meetingID DESC
            """,
            (owner_id,),
        )
        rows = cursor.fetchall()
        meetings = [
            {
                "meetingID": row["meetingID"],
                "title": row["title"],
                "description": row["description"],
                "startDate": row["startDate"],
                "endDate": row["endDate"],
                "date": row["date"],
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "status": row["status"],
                "zoom_link": row["zoom_link"],
                "isRecurring": row["isRecurring"],
                "recurrenceType": row["recurrenceType"],
                "numOfRecurrences": row["numOfRecurrences"],
                "invited_count": row["invited_count"],
                "voted_count": row["voted_count"],
                "invite_url": f"/group/{row['meetingID']}",
            }
            for row in rows
        ]
        return jsonify({"meetings": meetings}), 200
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/student_view', methods=['POST'])
def get_group_meetings():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            a.availabilityID,
            gm.title,
            gm.startDate,
            gm.endDate,
            a.date,
            a.start_time,
            a.end_time,
            a.status AS availability_status,
            m.status AS meeting_status,
            m.zoom_link,
            COUNT(v.studentID) AS vote_count
        FROM GroupMeeting gm
        JOIN Meeting m ON gm.meetingID = m.meetingID
        JOIN Availability a ON a.meetingID = gm.meetingID
        LEFT JOIN Vote v ON v.availabilityID = a.availabilityID
        WHERE gm.meetingID = ?
        GROUP BY
            a.availabilityID, gm.title, gm.startDate, gm.endDate,
            a.date, a.start_time, a.end_time, a.status, m.status, m.zoom_link
        """,
        (meeting_id,),
    )
    meetings = cursor.fetchall()
    conn.close()

    results = [
        {
            "availabilityID": m["availabilityID"],
            "title": m["title"],
            "startDate": m["startDate"],
            "endDate": m["endDate"],
            "date": m["date"],
            "start_time": m["start_time"],
            "end_time": m["end_time"],
            "availability_status": m["availability_status"],
            "meeting_status": m["meeting_status"],
            "zoom_link": m["zoom_link"],
            "vote_count": m["vote_count"],
        }
        for m in meetings
    ]
    return jsonify(results)


@type2_blueprint.route('/group_meeting/finalize', methods=['POST'])
def finalize_meeting():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT ownerID FROM GroupMeeting WHERE meetingID = ?", (meeting_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Meeting not found"}), 404
    if session["user_id"] != row["ownerID"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    cursor.execute(
        """
        UPDATE Meeting
        SET date = ?, start_time = ?, end_time = ?, status = 'open'
        WHERE meetingID = ?
        """,
        (data["date"], data["start_time"], data["end_time"], meeting_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


@type2_blueprint.route('/group_meeting/decide', methods=['POST'])
def decide_meeting():
    data = request.get_json() or {}
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
        cursor.execute(
            """
            SELECT ownerID, title, isRecurring, recurrenceType, endDate
            FROM GroupMeeting
            WHERE meetingID = ?
            """,
            (meeting_id,),
        )
        meeting_row = cursor.fetchone()
        if not meeting_row:
            return jsonify({"error": "Meeting not found"}), 404
        if meeting_row["ownerID"] != session["user_id"]:
            return jsonify({"error": "Unauthorized"}), 403

        cursor.execute(
            """
            SELECT availabilityID, date, start_time, end_time
            FROM Availability
            WHERE availabilityID = ? AND meetingID = ? AND status = 'open'
            """,
            (availability_id, meeting_id),
        )
        selected_slot = cursor.fetchone()
        if not selected_slot:
            return jsonify({"error": "Selected availability not found or already closed"}), 404

        num_recurrences = None
        recurrence_text = "One-time"
        if int(meeting_row["isRecurring"] or 0) == 1:
            if meeting_row["recurrenceType"] != "weekly":
                return jsonify({"error": "Only weekly recurrence is currently supported"}), 400
            try:
                selected_start_date = datetime.strptime(selected_slot["date"], "%Y-%m-%d").date()
                recurrence_end_date = datetime.strptime(meeting_row["endDate"], "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Invalid recurring date format"}), 400
            if recurrence_end_date < selected_start_date:
                return jsonify({"error": "Recurring end date must be after selected slot date"}), 400
            num_recurrences = ((recurrence_end_date - selected_start_date).days // 7) + 1
            recurrence_text = f"weekly x {num_recurrences}"

        zoom_link = None
        try:
            zoom_data = create_type2_zoom_meeting(
                current_app,
                meeting_row["title"] or "Group Meeting",
                selected_slot["date"],
                selected_slot["start_time"],
                selected_slot["end_time"],
            )
            zoom_link = zoom_data["zoom_link"]
        except Exception as zoom_error:
            print("Type 2 Zoom creation failed:", zoom_error)
            zoom_link = None

        cursor.execute(
            "UPDATE Availability SET status = 'booked' WHERE availabilityID = ? AND meetingID = ?",
            (availability_id, meeting_id),
        )
        cursor.execute(
            "UPDATE Availability SET status = 'closed' WHERE meetingID = ? AND availabilityID != ?",
            (meeting_id, availability_id),
        )
        cursor.execute(
            """
            UPDATE Meeting
            SET date = ?, start_time = ?, end_time = ?, status = 'booked', zoom_link = ?
            WHERE meetingID = ?
            """,
            (
                selected_slot["date"],
                selected_slot["start_time"],
                selected_slot["end_time"],
                zoom_link,
                meeting_id,
            ),
        )

        cursor.execute(
            "UPDATE GroupMeeting SET numOfRecurrences = ? WHERE meetingID = ?",
            (num_recurrences, meeting_id),
        )

        cursor.execute(
            """
            INSERT OR IGNORE INTO Booking2 (studentID, ownerID, meetingID, availabilityID)
            SELECT DISTINCT v.studentID, ?, ?, ?
            FROM Vote v
            WHERE v.availabilityID = ?
            """,
            (session["user_id"], meeting_id, availability_id, availability_id),
        )

        booked_count = cursor.rowcount

        cursor.execute("""
            SELECT DISTINCT studentID
            FROM Booking2
            WHERE meetingID = ?
        """, (meeting_id,))

        booked_students = cursor.fetchall()

        for student in booked_students:
            create_notification(
                student["studentID"],
                f"Group meeting '{meeting_row['title']}' has been finalized for {selected_slot['date']} at {selected_slot['start_time']}."
            )

        recurring_instance_ids = []
        if num_recurrences and num_recurrences > 1:
            base_date = datetime.strptime(selected_slot["date"], "%Y-%m-%d").date()
            for week_offset in range(1, num_recurrences):
                next_date = (base_date + timedelta(days=7 * week_offset)).strftime("%Y-%m-%d")
                cursor.execute(
                    """
                    INSERT INTO Meeting (date, start_time, end_time, status, zoom_link)
                    VALUES (?, ?, ?, 'booked', ?)
                    """,
                    (next_date, selected_slot["start_time"], selected_slot["end_time"], zoom_link),
                )
                recurring_meeting_id = cursor.lastrowid
                recurring_instance_ids.append(recurring_meeting_id)

                cursor.execute(
                    """
                    INSERT INTO GroupMeeting (
                        meetingID, ownerID, title, description, startDate, endDate,
                        isRecurring, recurrenceType, numOfRecurrences
                    )
                    SELECT ?, ownerID, title, description, ?, ?, isRecurring, recurrenceType, numOfRecurrences
                    FROM GroupMeeting
                    WHERE meetingID = ?
                    """,
                    (recurring_meeting_id, next_date, next_date, meeting_id),
                )

                cursor.execute(
                    """
                    INSERT INTO Availability (meetingID, date, start_time, end_time, status)
                    VALUES (?, ?, ?, ?, 'booked')
                    """,
                    (recurring_meeting_id, next_date, selected_slot["start_time"], selected_slot["end_time"]),
                )
                recurring_availability_id = cursor.lastrowid

                cursor.execute(
                    """
                    INSERT OR IGNORE INTO GroupInvite (meetingID, studentID, status)
                    SELECT ?, studentID, status
                    FROM GroupInvite
                    WHERE meetingID = ?
                    """,
                    (recurring_meeting_id, meeting_id),
                )

                cursor.execute(
                    """
                    INSERT OR IGNORE INTO Booking2 (studentID, ownerID, meetingID, availabilityID)
                    SELECT DISTINCT v.studentID, ?, ?, ?
                    FROM Vote v
                    WHERE v.availabilityID = ?
                    """,
                    (session["user_id"], recurring_meeting_id, recurring_availability_id, availability_id),
                )
                booked_count += cursor.rowcount

        cursor.execute("SELECT email FROM User WHERE userID = ?", (session["user_id"],))
        owner_email_row = cursor.fetchone()
        owner_email = owner_email_row["email"] if owner_email_row else None
        if owner_email:
            config = current_app.config
            body = (
                f"Your group meeting '{meeting_row['title']}' has been finalized.\n\n"
                f"Date: {selected_slot['date']}\n"
                f"Time: {selected_slot['start_time']} - {selected_slot['end_time']}\n"
                f"Recurrence: {recurrence_text}\n"
                f"Booked student count: {booked_count}\n"
                f"Zoom Link: {zoom_link or 'Not provided'}\n"
                f"Additional weekly instances created: {len(recurring_instance_ids)}"
            )
            send_email(
                subject="Group Meeting Finalized",
                body=body,
                to_email=owner_email,
                from_email=config.get("FROM_EMAIL"),
                smtp_server=config.get("SMTP_SERVER"),
                smtp_port=config.get("SMTP_PORT"),
                username=config.get("FROM_EMAIL"),
                password=config.get("EMAIL_PASSWORD"),
            )

        conn.commit()
        return jsonify(
            {
                "status": "ok",
                "message": "Meeting decided successfully",
                "meetingID": meeting_id,
                "availabilityID": availability_id,
                "zoom_link": zoom_link,
                "isRecurring": int(meeting_row["isRecurring"] or 0),
                "recurrenceType": meeting_row["recurrenceType"],
                "numOfRecurrences": num_recurrences,
                "booked_count": booked_count,
                "recurring_instance_ids": recurring_instance_ids,
            }
        ), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/cancel', methods=['POST'])
def cancel_group_meeting():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT ownerID FROM GroupMeeting WHERE meetingID = ?", (meeting_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Group meeting not found"}), 404
        if row["ownerID"] != session["user_id"]:
            return jsonify({"error": "Unauthorized"}), 403
        cursor.execute("UPDATE Meeting SET status = 'cancelled' WHERE meetingID = ?", (meeting_id,))
        cursor.execute("UPDATE Availability SET status = 'closed' WHERE meetingID = ?", (meeting_id,))

        # Notifications
        cursor.execute("""
            SELECT DISTINCT studentID
            FROM GroupInvite
            WHERE meetingID = ?
            UNION
            SELECT DISTINCT studentID
            FROM Booking2
            WHERE meetingID = ?
        """, (meeting_id, meeting_id))

        students_to_notify = cursor.fetchall()

        for student in students_to_notify:
            create_notification(
                student["studentID"],
                "A group meeting you were invited to or booked for was cancelled."
            )


        conn.commit()
        return jsonify({"status": "ok", "message": "Group meeting cancelled successfully."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/delete', methods=['POST'])
def delete_group_meeting():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT ownerID FROM GroupMeeting WHERE meetingID = ?", (meeting_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Group meeting not found"}), 404
        if row["ownerID"] != session["user_id"]:
            return jsonify({"error": "Unauthorized"}), 403
        cursor.execute("DELETE FROM Meeting WHERE meetingID = ?", (meeting_id,))
        conn.commit()
        return jsonify({"status": "ok", "message": "Group meeting removed successfully."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/student_remove', methods=['POST'])
def student_remove_group_meeting():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")
    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    student_id = session["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT m.status
            FROM Meeting m
            JOIN GroupMeeting gm ON gm.meetingID = m.meetingID
            WHERE m.meetingID = ?
            """,
            (meeting_id,),
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Group meeting not found"}), 404
        if row["status"] != "cancelled":
            return jsonify({"error": "Only cancelled group meetings can be removed"}), 400
        cursor.execute("DELETE FROM Booking2 WHERE meetingID = ? AND studentID = ?", (meeting_id, student_id))
        cursor.execute("DELETE FROM GroupInvite WHERE meetingID = ? AND studentID = ?", (meeting_id, student_id))
        conn.commit()
        return jsonify({"status": "ok", "message": "Cancelled group meeting removed."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/vote', methods=['POST'])
def submit_vote():
    data = request.get_json() or {}
    meeting_id = data.get("meetingID")
    availability_ids = data.get("availabilityIDs")

    if not meeting_id:
        return jsonify({"error": "Missing meetingID"}), 400
    if not availability_ids or not isinstance(availability_ids, list):
        return jsonify({"error": "Select at least one availability option"}), 400
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    student_id = session["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM GroupInvite WHERE meetingID = ? AND studentID = ?",
            (meeting_id, student_id),
        )
        if not cursor.fetchone():
            return jsonify({"error": "You are not invited to this group meeting"}), 403

        cursor.execute("SELECT status FROM Meeting WHERE meetingID = ?", (meeting_id,))
        meeting_row = cursor.fetchone()
        if not meeting_row:
            return jsonify({"error": "Meeting not found"}), 404
        if meeting_row["status"] != "open":
            return jsonify({"error": "Voting is closed for this meeting"}), 400

        cursor.execute(
            """
            DELETE FROM Vote
            WHERE studentID = ?
            AND availabilityID IN (
                SELECT availabilityID
                FROM Availability
                WHERE meetingID = ?
            )
            """,
            (student_id, meeting_id),
        )

        for availability_id in availability_ids:
            cursor.execute(
                """
                SELECT 1
                FROM Availability
                WHERE availabilityID = ? AND meetingID = ? AND status = 'open'
                """,
                (availability_id, meeting_id),
            )
            if not cursor.fetchone():
                conn.rollback()
                return jsonify({"error": "Invalid or closed availability selected"}), 400
            cursor.execute(
                "INSERT INTO Vote (studentID, availabilityID) VALUES (?, ?)",
                (student_id, availability_id),
            )

        cursor.execute(
            "UPDATE GroupInvite SET status = 'voted' WHERE meetingID = ? AND studentID = ?",
            (meeting_id, student_id),
        )

        # Notification
        cursor.execute("""
            SELECT ownerID, title
            FROM GroupMeeting
            WHERE meetingID = ?
        """, (meeting_id,))
        meeting_info = cursor.fetchone()

        if meeting_info:
            create_notification(
                meeting_info["ownerID"],
                f"A student submitted availability for group meeting '{meeting_info['title']}'."
            )


        conn.commit()
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/vote_counts', methods=['GET'])
def get_all_vote_counts():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT a.availabilityID, COUNT(v.studentID) AS vote_count
        FROM Availability a
        LEFT JOIN Vote v ON a.availabilityID = v.availabilityID
        GROUP BY a.availabilityID
        """
    )
    rows = cursor.fetchall()
    conn.close()
    result = [{"availabilityID": r[0], "vote_count": r[1]} for r in rows]
    return jsonify(result)


@type2_blueprint.route('/group_meeting/my_bookings', methods=['GET'])
def my_group_bookings():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    student_id = session["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                b.booking2ID,
                b.meetingID,
                b.availabilityID,
                gm.title,
                gm.description,
                gm.startDate,
                gm.endDate,
                gm.isRecurring,
                gm.recurrenceType,
                gm.numOfRecurrences,
                m.date,
                m.start_time,
                m.end_time,
                m.status,
                m.zoom_link,
                u.name AS owner_name,
                u.email AS owner_email
            FROM Booking2 b
            JOIN GroupMeeting gm ON gm.meetingID = b.meetingID
            JOIN Meeting m ON m.meetingID = b.meetingID
            JOIN User u ON u.userID = b.ownerID
            WHERE b.studentID = ?
            ORDER BY m.date, m.start_time
            """,
            (student_id,),
        )
        rows = cursor.fetchall()
        meetings = [
            {
                "booking2ID": row["booking2ID"],
                "meetingID": row["meetingID"],
                "availabilityID": row["availabilityID"],
                "title": row["title"],
                "description": row["description"],
                "owner_name": row["owner_name"],
                "owner_email": row["owner_email"],
                "startDate": row["startDate"],
                "endDate": row["endDate"],
                "date": row["date"],
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "status": row["status"],
                "zoom_link": row["zoom_link"],
                "isRecurring": row["isRecurring"],
                "recurrenceType": row["recurrenceType"],
                "numOfRecurrences": row["numOfRecurrences"],
            }
            for row in rows
        ]
        return jsonify({"meetings": meetings}), 200
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/my_invites', methods=['GET'])
def my_group_invites():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    student_id = session["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                gm.meetingID,
                gm.title,
                gm.description,
                gm.startDate,
                gm.endDate,
                m.status,
                u.name AS owner_name,
                u.email AS owner_email,
                COUNT(DISTINCT a.availabilityID) AS option_count,
                COUNT(DISTINCT v.availabilityID) AS my_vote_count
            FROM GroupInvite gi
            JOIN GroupMeeting gm ON gm.meetingID = gi.meetingID
            JOIN Meeting m ON m.meetingID = gm.meetingID
            JOIN User u ON u.userID = gm.ownerID
            LEFT JOIN Availability a ON a.meetingID = gm.meetingID
            LEFT JOIN Vote v ON v.availabilityID = a.availabilityID AND v.studentID = gi.studentID
            WHERE gi.studentID = ? AND m.status = 'open'
            GROUP BY gm.meetingID, gm.title, gm.description, gm.startDate, gm.endDate, m.status, u.name, u.email
            ORDER BY gm.startDate, gm.meetingID
            """,
            (student_id,),
        )
        rows = cursor.fetchall()
        meetings = [
            {
                "meetingID": row["meetingID"],
                "title": row["title"],
                "description": row["description"],
                "startDate": row["startDate"],
                "endDate": row["endDate"],
                "status": row["status"],
                "owner_name": row["owner_name"],
                "owner_email": row["owner_email"],
                "option_count": row["option_count"],
                "my_vote_count": row["my_vote_count"],
            }
            for row in rows
        ]
        return jsonify({"meetings": meetings}), 200
    finally:
        conn.close()


@type2_blueprint.route('/group_meeting/owner_bookings', methods=['GET'])
def owner_group_bookings_history():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401
    if session.get("role") != "owner":
        return jsonify({"error": "Owner access required"}), 403

    owner_id = session["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                gm.meetingID,
                gm.title,
                gm.description,
                gm.startDate,
                gm.endDate,
                gm.isRecurring,
                gm.recurrenceType,
                gm.numOfRecurrences,
                m.date,
                m.start_time,
                m.end_time,
                m.status,
                m.zoom_link,
                GROUP_CONCAT(u.name, ', ') AS attendee_names,
                GROUP_CONCAT(u.email, ', ') AS attendee_emails,
                COUNT(DISTINCT b.studentID) AS attendee_count
            FROM GroupMeeting gm
            JOIN Meeting m ON m.meetingID = gm.meetingID
            LEFT JOIN Booking2 b ON b.meetingID = gm.meetingID
            LEFT JOIN User u ON u.userID = b.studentID
            WHERE gm.ownerID = ? AND m.status IN ('booked', 'cancelled')
            GROUP BY
                gm.meetingID, gm.title, gm.description, gm.startDate, gm.endDate,
                gm.isRecurring, gm.recurrenceType, gm.numOfRecurrences,
                m.date, m.start_time, m.end_time, m.status, m.zoom_link
            ORDER BY m.date, m.start_time
            """,
            (owner_id,),
        )
        rows = cursor.fetchall()
        meetings = [
            {
                "meetingID": row["meetingID"],
                "title": row["title"],
                "description": row["description"],
                "startDate": row["startDate"],
                "endDate": row["endDate"],
                "date": row["date"],
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "status": row["status"],
                "zoom_link": row["zoom_link"],
                "isRecurring": row["isRecurring"],
                "recurrenceType": row["recurrenceType"],
                "numOfRecurrences": row["numOfRecurrences"],
                "attendee_names": row["attendee_names"] or "",
                "attendee_emails": row["attendee_emails"] or "",
                "attendee_count": row["attendee_count"],
            }
            for row in rows
        ]
        return jsonify({"meetings": meetings}), 200
    finally:
        conn.close()
