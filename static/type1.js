// --- INDIVIDUAL MEETING REQUESTS ----
// Contributer:
// Maxim Miladinov-Genov - 260989667
// Enoch Chan - 261160969


// ========= Page Setup ============
document.addEventListener('DOMContentLoaded', function () {
    bindType1Handlers();
});

// ========= Helper Functions =========
function bindType1Handlers() {
    const sendRequestButton = document.getElementById('sendRequestButton');
    if (sendRequestButton) {
        sendRequestButton.addEventListener('click', sendType1MeetingRequest);
    }
}

// ======== Request Form ========

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
            credentials: 'same-origin',
            body: JSON.stringify({
                student_email: window.currentUser.email,
                owner_email: ownerSelect.value,
                message: meetingMessage.value.trim(),
                date: meetingDate,
                start_time: startTime,
                end_time: endTime
            })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (jsonError) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || 'Could not send meeting request.');
        }

        type1RequestSuccessNote.textContent = 'Meeting request sent successfully.';
        type1RequestSuccessNote.classList.add('show');
        type1RequestErrorNote.classList.remove('show');

    } catch (error) {
        type1RequestErrorNote.textContent = error.message || 'Could not connect to the server.';
        type1RequestErrorNote.classList.add('show');
        type1RequestSuccessNote.classList.remove('show');
    }
}

// ========= User Table ============
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
        
        const actionButtons = meeting.status === 'cancelled'
            ? `
                <button class="table-action danger" onclick="removeType1Meeting(${meeting.meetingID})">
                    Remove
                </button>
            `
            : `
                <a class="table-action" href="mailto:${escapeHtml(meeting.owner_email || '')}">
                    Email
                </a>
                <button class="table-action danger" onclick="cancelType1Meeting(${meeting.meetingID})">
                    Cancel
                </button>
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


// ========== Meeting Actions ============
async function cancelType1Meeting(meetingID) {
    if (!confirm('Cancel this individual meeting?')) {
        return;
    }

    try {
        const response = await fetch('/api/type1/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to cancel meeting.');
            return;
        }

        if (typeof loadType1Meetings === 'function') {
            await loadType1Meetings();
        }

        if (typeof loadOwnerAppointments === 'function') {
            await loadOwnerAppointments();
        }

    } catch (error) {
        console.error(error);
        alert('Server error while cancelling meeting.');
    }
}

async function removeType1Meeting(meetingID) {
    if (!confirm('Delete this individual meeting permanently?')) {
        return;
    }

    try {
        const response = await fetch('/api/type1/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to remove meeting.');
            return;
        }

        if (typeof loadType1Meetings === 'function') {
            await loadType1Meetings();
        }

        if (typeof loadOwnerAppointments === 'function') {
            await loadOwnerAppointments();
        }

    } catch (error) {
        console.error(error);
        alert('Server error while removing meeting.');
    }
}