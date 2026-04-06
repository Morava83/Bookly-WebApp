--Using SQLite
PRAGMA foreign_keys = ON;

--Create User Entity Table
CREATE TABLE User (
    user_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK(role IN ('owner', 'user')) NOT NULL
);

--Meeting Superclass
--Types 1, 2, and 3 are in an ISA relationship with the following table
CREATE TABLE Meeting (
    meeting_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled')) NOT NULL,

    FOREIGN KEY (owner_id) REFERENCES User(user_id)
);

--Type 1 Meeting
CREATE TABLE RequestMeeting (
    meeting_id INTEGER PRIMARY KEY,
    message TEXT,
    approval_status TEXT CHECK(approval_status IN ('pending', 'accepted', 'declined')) NOT NULL,

    FOREIGN KEY (meeting_id) REFERENCES Meeting(meeting_id) ON DELETE CASCADE
);

--Type 2 Meeting
CREATE TABLE GroupMeeting (
    meeting_id INTEGER PRIMARY KEY,
    selection_deadline TEXT,
    max_participants INTEGER,
    is_recurring INTEGER CHECK(is_recurring IN (0,1)),

    FOREIGN KEY (meeting_id) REFERENCES Meeting(meeting_id) ON DELETE CASCADE
);

--Type 3 Meeting
CREATE TABLE OfficeHours (
    meeting_id INTEGER PRIMARY KEY,
    recurrence_pattern TEXT,
    start_date TEXT,
    end_date TEXT,

    FOREIGN KEY (meeting_id) REFERENCES Meeting(meeting_id) ON DELETE CASCADE
);

--Meeting Request as a separate entity
CREATE TABLE MeetingRequest (
    request_id INTEGER PRIMARY KEY,
    sender_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    message TEXT,
    status TEXT CHECK(status IN ('pending', 'accepted', 'declined')) NOT NULL,

    FOREIGN KEY (sender_id) REFERENCES User(user_id),
    FOREIGN KEY (owner_id) REFERENCES User(user_id)
);

--Owner's or Prof's Schedule
CREATE TABLE Availability (
    availability_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    day_of_week TEXT,
    start_time TEXT,
    end_time TEXT,
    start_date TEXT,
    end_date TEXT,

    FOREIGN KEY (owner_id) REFERENCES User(user_id)
);

--Participation Constraint --> Many-to-Many
CREATE TABLE Participation (
    participation_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    meeting_id INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (meeting_id) REFERENCES Meeting(meeting_id),

    UNIQUE(user_id, meeting_id)
);

--Constraints using trigger
--This is employed to avoid double meeting reservation
CREATE TRIGGER one_subtype_only
BEFORE INSERT ON RequestMeeting
BEGIN
    SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM GroupMeeting WHERE meeting_id = NEW.meeting_id)
          OR EXISTS (SELECT 1 FROM OfficeHours WHERE meeting_id = NEW.meeting_id)
        THEN RAISE(ABORT, 'Meeting already assigned to another subtype')
    END;
END;