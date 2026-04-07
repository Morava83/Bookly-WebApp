--======== Database =========
PRAGMA foreign_keys = ON;

-- ======== Base User Table ========
CREATE TABLE IF NOT EXISTS User (
    userID INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL
);

-- ========= User subtypes ==========
CREATE TABLE IF NOT EXISTS Students (
    userID INTEGER PRIMARY KEY,
    FOREIGN KEY (userID) REFERENCES User(userID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Owner (
    userID INTEGER PRIMARY KEY,
    FOREIGN KEY (userID) REFERENCES User(userID) ON DELETE CASCADE
);

-- ======== Meeting Table ========
CREATE TABLE IF NOT EXISTS Meeting (
    meetingID INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'open', 'booked', 'cancelled'))
);

-- ======== Type 1 : Request Meeting ========
CREATE TABLE IF NOT EXISTS RequestMeeting (
    meetingID INTEGER PRIMARY KEY,
    ownerID INTEGER NOT NULL,
    studentID INTEGER NOT NULL,
    message TEXT,
    FOREIGN KEY (meetingID) REFERENCES Meeting(meetingID) ON DELETE CASCADE,
    FOREIGN KEY (ownerID) REFERENCES Owner(userID) ON DELETE CASCADE,
    FOREIGN KEY (studentID) REFERENCES Student(userID) ON DELETE CASCADE
);

-- ======== Type 2 : Group Meeting ========
CREATE TABLE IF NOT EXISTS GroupMeeting (
    meetingID INTEGER PRIMARY KEY,
    ownerID INTEGER NOT NULL,
    title VARCHAR(100),
    description TEXT,
    isRecurring INTEGER NOT NULL DEFAULT 0 CHECK (isRecurring IN (0, 1)),
    recurrenceType VARCHAR(10) CHECK (recurrenceType IN ('daily', 'weekly', 'monthly') OR recurrenceType IS NULL),
    numOfRecurrences INTEGER,
    FOREIGN KEY (meetingID) REFERENCES Meeting(meetingID) ON DELETE CASCADE,
    FOREIGN KEY (ownerID) REFERENCES Owner(userID) ON DELETE CASCADE
);

-- ======== Type 2 : Availability Options ========
CREATE TABLE IF NOT EXISTS Availability (
    availabilityID INTEGER PRIMARY KEY AUTOINCREMENT,
    meetingID INTEGER NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (meetingID) REFERENCES GroupMeeting(meetingID) ON DELETE CASCADE
);

-- ======== Type 3 : Office Hours ========
CREATE TABLE IF NOT EXISTS OfficeHours (
    meetingID INTEGER PRIMARY KEY,
    ownerID INTEGER NOT NULL,
    FOREIGN KEY (meetingID) REFERENCES Meeting(meetingID) ON DELETE CASCADE,
    FOREIGN KEY (ownerID) REFERENCES Owner(userID) ON DELETE CASCADE
);

-- ======== Type 3 : Time Slots ========
CREATE TABLE IF NOT EXISTS TimeSlot (
    slotID INTEGER PRIMARY KEY AUTOINCREMENT,
    meetingID INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    FOREIGN KEY (meetingID) REFERENCES OfficeHours(meetingID) ON DELETE CASCADE
);

-- ======== Booking Table ========
CREATE TABLE IF NOT EXISTS Booking1 (
    booking1ID INTEGER PRIMARY KEY AUTOINCREMENT,
    studentID INTEGER NOT NULL,
    ownerID INTEGER NOT NULL,
    meetingID INTEGER NOT NULL UNIQUE,
    FOREIGN KEY (studentID) REFERENCES Student(userID) ON DELETE CASCADE,
    FOREIGN KEY (ownerID) REFERENCES Owner(userID) ON DELETE CASCADE,
    FOREIGN KEY (meetingID) REFERENCES RequestMeeting(meetingID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Booking2 (
    booking2ID INTEGER PRIMARY KEY AUTOINCREMENT,
    studentID INTEGER NOT NULL,
    ownerID INTEGER NOT NULL,
    meetingID INTEGER NOT NULL,
    availabilityID INTEGER,
    FOREIGN KEY (studentID) REFERENCES Student(userID) ON DELETE CASCADE,
    FOREIGN KEY (ownerID) REFERENCES Owner(userID) ON DELETE CASCADE,
    FOREIGN KEY (meetingID) REFERENCES GroupMeeting(meetingID) ON DELETE CASCADE,
    FOREIGN KEY (availabilityID) REFERENCES Availability(availabilityID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Booking3 (
    booking3ID INTEGER PRIMARY KEY AUTOINCREMENT,
    studentID INTEGER NOT NULL,
    ownerID INTEGER NOT NULL,
    meetingID INTEGER NOT NULL,
    slotID INTEGER NOT NULL UNIQUE,
    FOREIGN KEY (studentID) REFERENCES Student(userID) ON DELETE CASCADE,
    FOREIGN KEY (ownerID) REFERENCES Owner(userID) ON DELETE CASCADE,
    FOREIGN KEY (meetingID) REFERENCES OfficeHours(meetingID) ON DELETE CASCADE,
    FOREIGN KEY (slotID) REFERENCES TimeSlot(slotID) ON DELETE CASCADE
);

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