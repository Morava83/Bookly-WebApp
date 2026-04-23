from flask import Blueprint, request, current_app, jsonify
import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
#-------Type 2: Group Meeting-------------

#=======Setup========
type2_blueprint = Blueprint('Type2', __name__)

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "database", "bookly.db")

#--------Media Query----------

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

#Get Owner Record
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


#Get list of invited users --> assumes students as a list of student ids --> list of integers
def get_guests(students):
    conn = get_db_connection()
    cursor = conn.cursor()
    for student in students:
        cursor.execute("""
                       SELECT *
                       FROM User u
                       JOIN Student s ON u.userId = s.userId
                       WHERE u.userId = ?
                       """, (student,))
    row = cursor.fetchone()
    conn.close()
    return row if row else None

#Get owner recurring time slots

#--------Schedule Meeting----------
#User picks set of slots

