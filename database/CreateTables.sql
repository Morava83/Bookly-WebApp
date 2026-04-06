======== Database =========

Database = "bookly.db"

def get_db_connection():
    conn = sqlite3.connect(Database)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            userID INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(100) NOT NULL,
            name VARCHAR(100) NOT NULL
            role TEXT CHECK(role IN ('owner', 'user')) NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Owners (
            ownerID INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(100) NOT NULL,
            password VARCHAR(100) NOT NULL,
            name VARCHAR(100) NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS TimeSlot (
            slotID INTEGER PRIMARY KEY AUTOINCREMENT,
            ownerID INTEGER NOT NULL,
            date DATE NOT NULL,
            startTime TIME NOT NULL,
            endTime TIME NOT NULL,
            isActivated INTEGER NOT NULL CHECK (isActivated IN (0, 1)),
            bookType INTEGER NOT NULL CHECK (bookType IN (1, 2, 3))
            isRecurring INTEGER NOT NULL CHECK (isRecurring IN (0, 1)),
            recurrenceType VARCHAR(10),
            numOfRecurrences INTEGER,
            FOREIGN KEY (ownerID) REFERENCES Owners(ownerID)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Booking (
            userID INTEGER NOT NULL,
            slotID INTEGER NOT NULL,
            PRIMARY KEY (userID, slotID),
            FOREIGN KEY (userID) REFERENCES users(userID),
            FOREIGN KEY (slotID) REFERENCES TimeSlot(slotID)
        )
    ''')

    conn.commit()
    conn.close()

--Constraints using trigger
--This is employed to avoid double meeting reservation
-- CREATE TRIGGER one_subtype_only
-- BEFORE INSERT ON RequestMeeting
-- BEGIN
--     SELECT
--     CASE
--         WHEN EXISTS (SELECT 1 FROM GroupMeeting WHERE meeting_id = NEW.meeting_id)
--           OR EXISTS (SELECT 1 FROM OfficeHours WHERE meeting_id = NEW.meeting_id)
--         THEN RAISE(ABORT, 'Meeting already assigned to another subtype')
--     END;
-- END;