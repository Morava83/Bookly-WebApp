import requests
from requests.auth import HTTPBasicAuth

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

def create_type1_zoom_meeting(app, owner_name, student_email, meeting_date, start_time):
    access_token = get_zoom_token(app)

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
            "duration": 15,
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


