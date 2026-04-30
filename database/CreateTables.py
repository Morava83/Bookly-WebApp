# Contributer:
# Maxim Miladinov-Genov - 260989667
# Hoi Kin Chiu - 261142005



import os
import sqlite3

def create_tables():
    base_dir = os.path.dirname(__file__)
    db_path = os.environ.get("DB_PATH", os.path.join(base_dir, "bookly.db"))
    sql_path = os.path.join(base_dir, "CreateTables.sql")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    with open(sql_path, "r", encoding="utf-8") as f:
        sql_script = f.read()

    cursor.executescript(sql_script)
    conn.commit()
    conn.close()