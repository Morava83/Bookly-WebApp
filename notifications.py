# Contributer:
# Enoch Chan - 261160969

import sqlite3
from flask import current_app


def get_db_connection():
    db_path = current_app.config.get("DB_PATH", "database/bookly.db")
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def create_notification(user_id, message):
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO Notification (userID, message)
            VALUES (?, ?)
            """,
            (user_id, message),
        )

        conn.commit()

        try:
            from app import socketio
            socketio.emit(
                "notification",
                {"message": message},
                to=str(user_id),
            )
        except Exception as e:
            print("Socket notification error:", e)

    except Exception as e:
        conn.rollback()
        print("Create notification error:", e)

    finally:
        conn.close()