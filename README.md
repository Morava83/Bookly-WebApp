# Bookly-WebApp
McGill booking app where professors/TAs publish office-hour and meeting slots and students book, cancel, and message-plus invite links and Google/Outlook calendar export.

# Setup

python3 -m venv .venv
source .venv/bin/activate

Installing the requried modules
pip install -r requirements.txt

# Run the Project

python app.py

Visit: (http://127.0.0.1:5000)

# Database
The SQLite3 database file is stored at database/bookly.db
Database Schema: database/CreateTables.sql
Database Initialized: database/CreateTables.py

# Deployment 
Deployed to the Render Hosting Service 

Public URL: https://bookly-webapp.onrender.com/
