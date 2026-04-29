// ==== GROUP MEETINGS ====


// ======== State =========
let currentVoteMeetingID = null;


// =========== Page Setup ============

document.addEventListener('DOMContentLoaded', function () {
    bindType2Handlers();
});


// =========================
// Helpers
// =========================

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeForJs(value) {
    return String(value ?? '')
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll('\n', ' ')
        .replaceAll('\r', ' ');
}

function showSuccess(id, message) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = message;
    el.classList.add('show');
}

function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = message;
    el.classList.add('show');
}

function hideNote(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = '';
    el.classList.remove('show');
}

function bindType2Handlers() {
    const submitVoteBtn = document.getElementById('submitVoteBtn');
    const backToApptsBtn = document.getElementById('backToApptsBtn');

    if (submitVoteBtn) {
        submitVoteBtn.addEventListener('click', submitGroupVote);
    }

    if (backToApptsBtn) {
        backToApptsBtn.addEventListener('click', backToAppointmentsFromVote);
    }
}



// ======== Group Meeting Table =========

async function loadAllStudentGroupRows() {
    const tbody = document.getElementById('groupMeetingsTableBody');

    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="appt-table-empty">Loading group meetings...</td>
        </tr>
    `;

    try {
        const [invitesResponse, bookingsResponse] = await Promise.all([
            fetch('/api/type2/group_meeting/my_invites'),
            fetch('/api/type2/group_meeting/my_bookings')
        ]);

        const invitesData = await invitesResponse.json();
        const bookingsData = await bookingsResponse.json();

        if (!invitesResponse.ok) {
            throw new Error(invitesData.error || 'Failed to load group meeting invitations.');
        }

        if (!bookingsResponse.ok) {
            throw new Error(bookingsData.error || 'Failed to load finalized group meetings.');
        }

        const invites = invitesData.meetings || [];
        const bookings = bookingsData.meetings || [];

        if (invites.length === 0 && bookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="appt-table-empty">
                        No group meetings yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        // 1. Open invitations that need voting
        invites.forEach(function (meeting) {
            const row = document.createElement('tr');

            const voteLabel = Number(meeting.my_vote_count || 0) > 0
                ? 'Edit vote'
                : 'Vote';

            row.innerHTML = `
                <td>${escapeHtml(meeting.title || 'Untitled group meeting')}</td>
                <td>${escapeHtml(meeting.owner_name || meeting.owner_email || '')}</td>
                <td>${escapeHtml(meeting.startDate || '')} to ${escapeHtml(meeting.endDate || '')}</td>
                <td>—</td>
                <td>—</td>
                <td>Voting stage</td>
                <td><span class="no-link">No link yet</span></td>
                <td><span class="status-badge open">open</span></td>
                <td>
                    <button class="table-action primary"
                        onclick="openVoteMeeting(${meeting.meetingID}, '${escapeForJs(meeting.title || '')}')">
                        ${voteLabel}
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        // 2. Finalized/booked group meetings
        bookings.forEach(function (meeting) {
            const row = document.createElement('tr');

            const zoomHtml = meeting.zoom_link
                ? `<a class="table-link" href="${escapeHtml(meeting.zoom_link)}" target="_blank">Join</a>`
                : `<span class="no-link">No link</span>`;

            const recurrenceText = Number(meeting.isRecurring) === 1
                ? `${escapeHtml(meeting.recurrenceType || 'Recurring')} × ${escapeHtml(meeting.numOfRecurrences || '')}`
                : 'One-time';

            const actionHtml = meeting.status === 'cancelled'
                ? `
                    <button class="table-action danger" onclick="removeStudentGroupMeeting(${meeting.meetingID})">
                        Remove
                    </button>
                `
                : `<span class="no-link">—</span>`;

            row.innerHTML = `
                <td>${escapeHtml(meeting.title || 'Untitled group meeting')}</td>
                <td>${escapeHtml(meeting.owner_name || meeting.owner_email || '')}</td>
                <td>${escapeHtml(meeting.date || '')}</td>
                <td>${escapeHtml(meeting.start_time || '')}</td>
                <td>${escapeHtml(meeting.end_time || '')}</td>
                <td>${recurrenceText}</td>
                <td>${zoomHtml}</td>
                <td><span class="status-badge ${escapeHtml(meeting.status || '')}">${escapeHtml(meeting.status || '')}</span></td>
                <td>${actionHtml}</td>
            `;



            tbody.appendChild(row);
        });

    } catch (error) {
        console.error(error);

        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="appt-table-empty">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}


// ======== Backwards-compatible loaders ========
async function loadStudentGroupMeetings() {
    await loadAllStudentGroupRows();
}

async function loadStudentGroupInvites() {
    await loadAllStudentGroupRows();
}


// ======== Vote Screen ==========

async function openVoteMeeting(meetingID, title) {
    currentVoteMeetingID = meetingID;

    const makeAppointmentView = document.querySelector('.make-appointment-tab-view');
    const appointmentView = document.querySelector('.view-appointment-tab-view');
    const voteView = document.getElementById('voteMeetingView');
    const voteIntro = document.getElementById('voteIntro');
    const voteSlotList = document.getElementById('voteSlotList');
    const voteSelectionText = document.getElementById('voteSelectionText');

    if (makeAppointmentView) {
        makeAppointmentView.style.display = 'none';
    }

    if (appointmentView) {
        appointmentView.style.display = 'none';
    }

    if (voteView) {
        voteView.style.display = 'block';
    }

    if (voteIntro) {
        voteIntro.textContent = `Select all times that work for you for "${title}".`;
    }

    if (voteSelectionText) {
        voteSelectionText.textContent = 'Check the time slots that work for you.';
    }

    if (voteSlotList) {
        voteSlotList.innerHTML = '<p class="slots-note">Loading options...</p>';
    }

    hideNote('voteSuccessNote');
    hideNote('voteErrorNote');

    try {
        const response = await fetch(`/api/type2/group_meeting?meetingID=${meetingID}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load voting options.');
        }

        const slots = data.availabilities || [];

        if (slots.length === 0) {
            voteSlotList.innerHTML = '<p class="slots-note">No voting options available.</p>';
            return;
        }

        voteSlotList.innerHTML = '';

        let openSlotCount = 0;

        slots.forEach(function (slot) {
            if (slot.status !== 'open') {
                return;
            }

            openSlotCount++;

            const option = document.createElement('label');
            option.className = 'vote-option';
            option.style.display = 'block';
            option.style.padding = '12px';
            option.style.border = '1px solid #d6d6d6';
            option.style.marginBottom = '8px';
            option.style.cursor = 'pointer';

            option.innerHTML = `
                <input type="checkbox" class="vote-checkbox" value="${slot.availabilityID}">
                <strong>${escapeHtml(slot.date)}</strong>
                ${escapeHtml(slot.start_time)} - ${escapeHtml(slot.end_time)}
                <span class="no-link">(${slot.vote_count || 0} vote(s))</span>
            `;

            voteSlotList.appendChild(option);
        });

        if (openSlotCount === 0) {
            voteSlotList.innerHTML = '<p class="slots-note">Voting is closed for this meeting.</p>';
        }

    } catch (error) {
        console.error(error);

        if (voteSlotList) {
            voteSlotList.innerHTML = `
                <p class="error-note show">${escapeHtml(error.message)}</p>
            `;
        }
    }
}

function backToAppointmentsFromVote() {
    const makeAppointmentView = document.querySelector('.make-appointment-tab-view');
    const appointmentView = document.querySelector('.view-appointment-tab-view');
    const voteView = document.getElementById('voteMeetingView');

    if (makeAppointmentView) {
        makeAppointmentView.style.display = 'none';
    }

    if (voteView) {
        voteView.style.display = 'none';
    }

    if (appointmentView) {
        appointmentView.style.display = 'block';
    }

    currentVoteMeetingID = null;
}




// ========== Voting Actino ============

async function submitGroupVote() {
    if (!currentVoteMeetingID) {
        showError('voteErrorNote', 'No group meeting selected.');
        return;
    }

    hideNote('voteSuccessNote');
    hideNote('voteErrorNote');

    const checkedBoxes = document.querySelectorAll('.vote-checkbox:checked');

    const availabilityIDs = Array.from(checkedBoxes).map(function (box) {
        return Number(box.value);
    });

    if (availabilityIDs.length === 0) {
        showError('voteErrorNote', 'Please select at least one time slot.');
        return;
    }

    try {
        const response = await fetch('/api/type2/group_meeting/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meetingID: currentVoteMeetingID,
                availabilityIDs: availabilityIDs
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showError('voteErrorNote', data.error || 'Failed to submit vote.');
            return;
        }

        showSuccess('voteSuccessNote', 'Your availability was submitted successfully.');

        setTimeout(async function () {
            backToAppointmentsFromVote();

            if (typeof loadAllStudentGroupRows === 'function') {
                await loadAllStudentGroupRows();
            }
        }, 800);

    } catch (error) {
        console.error(error);
        showError('voteErrorNote', 'Server error while submitting vote.');
    }
}



// ======== Meeting Action ============
async function removeStudentGroupMeeting(meetingID) {
    if (!confirm('Remove this cancelled group meeting from your appointments?')) {
        return;
    }

    try {
        const response = await fetch('/api/type2/group_meeting/student_remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to remove group meeting.');
            return;
        }

        if (typeof loadAllStudentGroupRows === 'function') {
            await loadAllStudentGroupRows();
        }

    } catch (error) {
        console.error(error);
        alert('Server error while removing group meeting.');
    }
}

