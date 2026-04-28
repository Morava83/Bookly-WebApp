async function sendType1MeetingRequest() {
    const ownerSelect = document.getElementById('ownerSelect');
    const meetingMessage = document.getElementById('meetingMessage');
    const bookingNote = document.getElementById('type1RequestSuccessNote');
    const errorNote = document.getElementById('type1RequestErrorNote');
    
    if (!ownerSelect || !meetingMessage) {
        console.error('Type1 form elements not found.');
        return;
    }

    if (bookingNote) {
        bookingNote.textContent = '';
        bookingNote.classList.remove('show');
    }
    if (errorNote) {
        errorNote.textContent = '';
        errorNote.classList.remove('show');
    }

    if (!window.currentUser || !window.currentUser.email) {
        if (errorNote) {
            errorNote.textContent = 'You must be logged in.';
            errorNote.classList.add('show');
        }
        return;
    }

    if (!ownerSelect.value) {
        if (errorNote) {
            errorNote.textContent = 'Please choose an owner.';
            errorNote.classList.add('show');
        }
        return;
    }

    if (!meetingMessage.value.trim()) {
        if (errorNote) {
            errorNote.textContent = 'Please enter a request message.';
            errorNote.classList.add('show');
        }
        return;
    }

    const meetingDateInput = document.getElementById('type1MeetingDate');
    const startTimeInput = document.getElementById('type1StartTime');
    const endTimeInput = document.getElementById('type1EndTime');

    if (!meetingDateInput || !startTimeInput || !endTimeInput) {
        if (errorNote) {
            errorNote.textContent = 'Date/time form fields are missing.';
            errorNote.classList.add('show');
        }
        return;
    }

    const meetingDate = meetingDateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    if (!meetingDate || !startTime || !endTime) {
        if (errorNote) {
            errorNote.textContent = 'Please choose a date, start time, and end time.';
            errorNote.classList.add('show');
        }
        return;
    }

    if (endTime <= startTime) {
        if (errorNote) {
            errorNote.textContent = 'End time must be after start time.';
            errorNote.classList.add('show');
        }
        return;
    }

    try {
        const response = await fetch('/api/type1/request_meeting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                student_email: window.currentUser.email,
                owner_email: ownerSelect.value,
                message: meetingMessage.value.trim(),
                date: meetingDate,
                start_time: startTime,
                end_time: endTime
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send meeting request');
        }

        if (bookingNote) {
            bookingNote.textContent = 'Meeting request sent successfully! The owner has been notified.';
            bookingNote.classList.add('show');
        }

        if (errorNote) {
            errorNote.textContent = '';
            errorNote.classList.remove('show');
        }

        ownerSelect.value = '';
        meetingMessage.value = '';
        meetingDateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';


        await loadType1Meetings();
    } catch (error) {
        console.error('Type1 request error:', error);
        if (errorNote) {
            errorNote.textContent = 'Could not connect to the server.';
            errorNote.classList.add('show');
        }
    }
}

async function loadType1Meetings() {
    const tbody = document.getElementById('individualMeetingsTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="appt-table-empty">Loading individual meetings...</td>
        </tr>
    `;

    try {
        const response = await fetch('/api/type1/my_meetings');
        const data = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="appt-table-empty">Could not load individual meetings.</td>
                </tr>
            `;
            return;
        }

        renderType1Meetings(data.meetings || []);
    } catch (error) {
        console.error('Type1 meetings load error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="appt-table-empty">Could not load individual meetings.</td>
            </tr>
        `;
    }
}

async function cancelType1Meeting(meetingID) {
    if (!confirm("Cancel this pending meeting request?")) {
        return;
    }

    try {
        const response = await fetch("/api/type1/cancel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ meetingID: meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Could not cancel meeting.");
            return;
        }

        await loadType1Meetings();

    } catch (error) {
        console.error("Cancel Type 1 meeting error:", error);
        alert("Could not cancel meeting.");
    }
}

async function removeType1Meeting(meetingID) {
    try {
        const response = await fetch("/api/type1/remove", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ meetingID: meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Could not remove meeting.");
            return;
        }

        await loadType1Meetings();

    } catch (error) {
        console.error("Remove Type 1 meeting error:", error);
        alert("Could not remove meeting.");
    }
}

function renderType1Meetings(meetings) {
    const tbody = document.getElementById('individualMeetingsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!meetings || meetings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="appt-table-empty">No individual meetings yet.</td>
            </tr>
        `;
        return;
    }

    meetings.forEach(function (meeting) {
        const row = document.createElement('tr');

        const zoomCell = meeting.status === "accepted" && meeting.zoom_link
            ? `<a class="table-action primary" href="${meeting.zoom_link}" target="_blank">Join</a>`
            : `<button class="table-action" disabled style="opacity: 0.45; cursor: not-allowed;">Join</button>`;
        
        const actionButtons = `
            <a class="table-action" href="mailto:${meeting.owner_email}">Email</a>
            ${
                meeting.status === 'pending'
                    ? `<button class="table-action danger" onclick="cancelType1Meeting(${meeting.meetingID})">Cancel</button>`
                    : ''
            }

            ${
                meeting.status === "cancelled"
                    ? `<button class="table-action danger" onclick="removeType1Meeting(${meeting.meetingID})">Remove</button>`
                    : ""
            }
        `; 

        row.innerHTML = `
            <td>${meeting.meetingID}</td>
            <td>${meeting.owner_name}</td>
            <td>${meeting.date}</td>
            <td>${meeting.start_time}</td>
            <td>${meeting.end_time}</td>
            <td>${zoomCell}</td>
            <td><span class="status-badge ${meeting.status}">${meeting.status}</span></td>
            <td>
                <div class="table-actions">
                    ${actionButtons}
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function bindType1Handlers() {
    const sendRequestButton = document.getElementById('sendRequestButton');
    if (sendRequestButton) {
        sendRequestButton.addEventListener('click', sendType1MeetingRequest);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    bindType1Handlers();
});