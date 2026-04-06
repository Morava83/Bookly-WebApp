import sqlite3

def create_tables():
    conn = sqlite3.connect("bookly.db")
    cursor = conn.cursor()

    with open("database/CreateTables.sql", "r") as f:
        sql_script = f.read()

    cursor.executescript(sql_script)
    conn.commit()
    conn.close()