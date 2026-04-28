import requests
from requests.auth import HTTPBasicAuth
from datetime import datetime

TOKEN_URL = "https://zoom.us/oauth/token"
BASE_URL = "https://api.zoom.us/v2"

def get_zoom_token(app):
    response = requests.post(
        TOKEN_URL,
        params={
            "grant_type": "account_credentials",
            "account_id": app.config["ZOOM_ACCOUNT_ID"],
        },
        auth=HTTPBasicAuth(
            app.config["ZOOM_CLIENT_ID"],
            app.config["ZOOM_CLIENT_SECRET"]
        ),
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]

#=============================
# Type 1 : Individual Meetings

def create_type1_zoom_meeting(app, owner_name, student_email, meeting_date, start_time, end_time):
    access_token = get_zoom_token(app)

    # Convert "2026-04-28" + "14:00" into datetime objects
    start_dt = datetime.strptime(f"{meeting_date} {start_time}", "%Y-%m-%d %H:%M")
    end_dt = datetime.strptime(f"{meeting_date} {end_time}", "%Y-%m-%d %H:%M")

    # Calculate duration in minutes
    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    if duration_minutes <= 0:
        raise ValueError("End time must be after start time.")

    response = requests.post(
        f"{BASE_URL}/users/me/meetings",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "topic": f"Bookly Individual Meeting - {owner_name} with {student_email}",
            "type": 2,
            "start_time": f"{meeting_date}T{start_time}:00",
            "duration": duration_minutes,
            "settings": {
                "waiting_room": True,
                "join_before_host": False,
                "mute_upon_entry": True,
            },
        },
        timeout=20,
    )

    response.raise_for_status()
    data = response.json()

    return {
        "zoom_meeting_id": str(data["id"]),
        "zoom_link": data["join_url"],
        "start_url": data.get("start_url"),
    }

#=============================
# Type 2 : Group Meetings

def create_type2_zoom_meeting(app, title, meeting_date, start_time, end_time):
    access_token = get_zoom_token(app)

    start_dt = datetime.strptime(f"{meeting_date} {start_time}", "%Y-%m-%d %H:%M")
    end_dt = datetime.strptime(f"{meeting_date} {end_time}", "%Y-%m-%d %H:%M")

    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    if duration_minutes <= 0:
        raise ValueError("End time must be after start time.")

    response = requests.post(
        f"{BASE_URL}/users/me/meetings",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "topic": f"Bookly Group Meeting - {title}",
            "type": 2,
            "start_time": f"{meeting_date}T{start_time}:00",
            "duration": duration_minutes,
            "settings": {
                "waiting_room": True,
                "join_before_host": False,
                "mute_upon_entry": True,
            },
        },
        timeout=20,
    )

    response.raise_for_status()
    data = response.json()

    return {
        "zoom_meeting_id": str(data["id"]),
        "zoom_link": data["join_url"],
        "start_url": data.get("start_url"),
    }

#=============================
# Type 3 : Office Hours
def create_zoom_meeting_owner(app, owner_name):
    access_token = get_zoom_token(app)

    response = requests.post(
        f"{BASE_URL}/users/me/meetings",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "topic": f"Bookly Office Hours - {owner_name}",
            "type": 3,
            "settings": {
                "waiting_room": True,
                "join_before_host": False,
                "mute_upon_entry": True,
            },
        },
        timeout=20,
    )

    response.raise_for_status()
    data = response.json()

    return{
        "zoom_meeting_id": str(data["id"]),
        "zoom_link": data["join_url"],
        "start_url": data.get("start_url"),
    }

def get_owner_zoom_link(conn, app, owner_id, owner_name):
    cur = conn.cursor()
    cur.execute("""
        SELECT zoom_meeting_id, zoom_link
        FROM Owner
        WHERE userID = ?
    """, (owner_id,))
    row = cur.fetchone()

    if row and row["zoom_link"]:
        return {
            "zoom_meeting_id": row["zoom_meeting_id"],
            "zoom_link": row["zoom_link"]
        }
    
    zoom_data = create_zoom_meeting_owner(app, owner_name)

    cur.execute("""
        UPDATE Owner
        SET zoom_meeting_id = ?, zoom_link = ?
        WHERE userID = ?  
    """, (zoom_data["zoom_meeting_id"], zoom_data["zoom_link"], owner_id))

    return zoom_data


