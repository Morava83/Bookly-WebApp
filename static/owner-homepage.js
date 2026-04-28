
//helper function
async function postJson(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    return { response, data };
}

async function readJsonResponse(response) {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 120)}`);
    }
}

async function loadOwnerAppointments() {
    // Load Type 3 (office hours) bookings
    var ohBody = document.getElementById('ownerOHTableBody');
    try {
        var res = await fetch('/api/type3/my_bookings');
        var data = await res.json();
        ohBody.innerHTML = '';

        if (!data.bookings || data.bookings.length === 0) {
            ohBody.innerHTML = '<tr><td colspan="7" class="appt-table-empty">No office hours bookings.</td></tr>';
        } else {
            data.bookings.forEach(function (b) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + b.slotID + '</td>' +
                    '<td>' + (b.student_name || '') + '</td>' +
                    '<td>' + b.start_date + '</td>' +
                    '<td>' + b.start_time + '</td>' +
                    '<td>' + b.end_time + '</td>' +
                    '<td>' + (b.zoom_link ? '<a class="table-link" href="' + b.zoom_link + '" target="_blank">Join</a>' : '<span class="no-link">—</span>') + '</td>' +
                    '<td><div class="table-actions">' +
                        '<a class="table-action" href="mailto:' + (b.student_email || '') + '">Email</a>' +
                        '<button class="table-action danger" onclick="cancelOHBooking(' + b.booking3ID + ', \'' + (b.student_email || '') + '\')">Cancel</button>' +
                    '</div></td>';
                ohBody.appendChild(tr);
            });
        }
    } catch (err) {
        ohBody.innerHTML = '<tr><td colspan="7" class="appt-table-empty">Error loading bookings.</td></tr>';
    }

    // TODO: load Type 1 and Type 2 appointments similarly
}

async function cancelOHBooking(bookingID, studentEmail) {
    if (!confirm('Cancel this booking?')) return;

    var res = await fetch('/api/type3/cancel_booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking3ID: bookingID })
    });

    if (res.ok) {
        loadOwnerAppointments();
        window.location.href = 'mailto:' + studentEmail +
            '?subject=' + encodeURIComponent('Bookly - Booking cancelled') +
            '&body=' + encodeURIComponent('Your office hours booking has been cancelled.');
    }
}

/* ── Tab switching ── */

function ownerSwitchTab(tabId) {
    const views = document.querySelectorAll('.owner-tab-view');

    views.forEach(function (view) {
        view.style.display = 'none';
    });

    const selectedView = document.getElementById(tabId);
    if (selectedView) {
        selectedView.style.display = 'block';
    }

    if (tabId === 'manageGMView') {
        if (typeof loadOwnerGroupMeetings === 'function') {
            loadOwnerGroupMeetings();
        }
    }

    if (tabId === 'pendingView') {
        if (typeof loadPendingRequests === 'function') {
            loadPendingRequests();
        }
    }

    if (tabId === 'ownerApptsView') {
        if (typeof loadOwnerAppointments === 'function') {
            loadOwnerAppointments();
        }

        if (typeof loadOwnerType1Meetings === 'function') {
            loadOwnerType1Meetings();
        }

        if (typeof loadOwnerGroupBookings === 'function') {
            loadOwnerGroupBookings();
        }

        if (typeof loadOwnerOHBookings === 'function') {
            loadOwnerOHBookings();
        }
    }
}


/* ── Notifications (same as student) ── */

function toggleNotifications(e) {
    e.stopPropagation();
    var panel = document.getElementById('notifPanel');
    panel.classList.toggle('open');
}

document.addEventListener('click', function (e) {
    var panel = document.getElementById('notifPanel');
    if (!panel.contains(e.target)) {
        panel.classList.remove('open');
    }
});

/* ── Current logged-in owner ── */

var currentUserName = document.getElementById('currentUserName');
var currentUserEmail = document.getElementById('currentUserEmail');
var currentUserRole = document.getElementById('currentUserRole');

loadCurrentUser();

async function loadCurrentUser() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();

        if (!response.ok) {
            currentUserName.textContent = 'Unavailable';
            currentUserEmail.textContent = 'Unavailable';
            currentUserRole.textContent = 'Unavailable';
            return;
        }

        currentUserName.textContent = data.name || 'Unknown';
        currentUserEmail.textContent = data.email || 'Unknown';
        currentUserRole.textContent = formatRoleLabel(data.role);
    } catch (error) {
        console.error('Error loading current user:', error);
        currentUserName.textContent = 'Unavailable';
        currentUserEmail.textContent = 'Unavailable';
        currentUserRole.textContent = 'Unavailable';
    }
}

function formatRoleLabel(role) {
    if (!role) return 'Unknown';
    return role.charAt(0).toUpperCase() + role.slice(1);
}

/* ── Logout ── */

document.getElementById('logoutButton').addEventListener('click', async function () {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        window.location.href = '/';
    }
});

/* ── Copy invite URL ── */

function copyInviteUrl(btn) {
    var textEl = btn.previousElementSibling || btn.parentElement.querySelector('.invite-url-text');
    var url = window.location.origin + textEl.textContent.trim();
    navigator.clipboard.writeText(url).then(function () {
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
    });
}


loadOwnerSlots();

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeForJs(value) {
    return String(value ?? '')
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll('\n', ' ')
        .replaceAll('\r', ' ');
}

function formatStatusBadge(status) {
    var normalized = (status || '').toLowerCase();

    if (normalized === 'booked') {
        return '<span class="status-badge booked">Booked</span>';
    }
    if (normalized === 'private') {
        return '<span class="status-badge private">Private</span>';
    }
    return '<span class="status-badge open">Active</span>';
}

function renderOwnerSlots(slots) {
    var tbody = document.querySelector('#ownerSlotsTable tbody');
    if (!tbody) return;

    if (!slots || slots.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" class="appt-table-empty">No office-hours slots yet.</td></tr>';
        return;
    }

    tbody.innerHTML = slots.map(function (slot) {
        var bookedByHtml = '<span class="no-link">—</span>';
        if (slot.student_name && slot.student_email) {
            bookedByHtml =
                escapeHtml(slot.student_name) +
                ' <a class="table-link" href="mailto:' + encodeURIComponent(slot.student_email) + '">(email)</a>';
        }

        var actionsHtml = '';

        if (slot.status === 'Booked') {
            actionsHtml =
                '<div class="table-actions">' +
                    '<button class="table-action danger" onclick="deleteSlot(this, \'' + escapeHtml(slot.student_email || '') + '\')">Delete</button>' +
                '</div>';
        } else if (slot.status === 'Private') {
            actionsHtml =
                '<div class="table-actions">' +
                    '<button class="table-action vote" onclick="toggleSlotStatus(this)">Activate</button>' +
                    '<button class="table-action danger" onclick="deleteSlot(this)">Delete</button>' +
                '</div>';
        } else {
            actionsHtml =
                '<div class="table-actions">' +
                    '<button class="table-action" onclick="toggleSlotStatus(this)">Deactivate</button>' +
                    '<button class="table-action danger" onclick="deleteSlot(this)">Delete</button>' +
                '</div>';
        }

        return (
            '<tr data-slot-id="' + escapeHtml(slot.slotID) + '">' +
                '<td>' + escapeHtml(slot.slotID) + '</td>' +
                '<td>' + escapeHtml(slot.date) + '</td>' +
                '<td>' + escapeHtml(slot.start_time) + '</td>' +
                '<td>' + escapeHtml(slot.end_time) + '</td>' +
                '<td>' + formatStatusBadge(slot.status) + '</td>' +
                '<td>' + bookedByHtml + '</td>' +
                '<td>' + actionsHtml + '</td>' +
            '</tr>'
        );
    }).join('');
}


async function updateOwnerSlotVisibility(url, payload, successMessage, fallbackErrorMessage) {
    try {
        const result = await postJson(url, payload);

        if (!result.response.ok) {
            showOwnerError('slotsError', result.data.error || fallbackErrorMessage);
            return false;
        }

        hideMsg('slotsError');
        showOwnerMsg('slotsMsg', successMessage);
        await loadOwnerSlots();
        return true;
    } catch (error) {
        console.error('Slot visibility update error:', error);
        showOwnerError('slotsError', fallbackErrorMessage);
        return false;
    }
}


async function loadOwnerSlots() {
    try {
        const response = await fetch('/api/type3/owner_slots');
        const data = await response.json();

        if (!response.ok) {
            showOwnerError('slotsError', data.error || 'Could not load slots.');
            return;
        }

        hideMsg('slotsError');
        renderOwnerSlots(data.slots || []);
    } catch (error) {
        console.error('Error loading owner slots:', error);
        showOwnerError('slotsError', 'Could not load slots.');
    }
}




/* ═══════════════════════════════════════════
   TAB 1: My Slots — activate / deactivate / delete
   ═══════════════════════════════════════════ */

async function toggleSlotStatus(btn) {
    var row = btn.closest('tr');
    var slotId = row ? row.getAttribute('data-slot-id') : null;

    if (!slotId) {
        showOwnerError('slotsError', 'Could not identify slot.');
        return;
    }

    var isActivating = btn.textContent.trim() === 'Activate';

    await updateOwnerSlotVisibility(
        '/api/type3/set_slot_status',
        {
            slotID: parseInt(slotId, 10),
            is_active: isActivating
        },
        isActivating ? 'Slot activated.' : 'Slot deactivated.',
        'Could not update slot status.'
    );
}

async function deleteSlot(btn, notifyEmail) {
    var row = btn.closest('tr');
    var slotID = Number(row.children[0].textContent.trim());
    
    if (!confirm('Delete this slot?')) return;

    try {
        var res = await fetch('/api/type3/delete_slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slotID: slotID })
        });

        if (!res.ok) {
            showOwnerError('slotsError', 'Could not delete slot.');
            return;
        }

        hideMsg('slotsError');
        loadOwnerSlots();

        showOwnerMsg('slotsMsg', 'Slot deleted successfully.');

        // ONLY IF the booking was booked by a student, THEN it opens mailto: to notify the student whose booking was cancelled
        if (notifyEmail) {
            showOwnerMsg('slotsMsg', 'Slot deleted successfully. A mailto: window was opened to notify the student.');

            window.location.href = 'mailto:' + notifyEmail +
                '?subject=' + encodeURIComponent('Bookly - Slot cancelled') +
                '&body=' + encodeURIComponent('Your booked slot has been cancelled by the owner.');
        }

    } catch (error) {
        showOwnerError('slotsError', 'Could not delete slot.');
    }
}

async function activateAllSlots() {
    await updateOwnerSlotVisibility(
        '/api/type3/set_all_slot_status',
        { is_active: true },
        'All slots activated.',
        'Could not activate all slots.'
    );
}

async function deactivateAllSlots() {
    await updateOwnerSlotVisibility(
        '/api/type3/set_all_slot_status',
        { is_active: false },
        'All slots deactivated.',
        'Could not deactivate all slots.'
    );
}

/* ═══════════════════════════════════════════
   TAB 2: Create Office Hours
   ═══════════════════════════════════════════ */

function addOHSlotEntry() {
    var container = document.getElementById('ohSlotEntries');
    var entry = document.createElement('div');
    entry.className = 'oh-slot-entry';
    entry.innerHTML =
        '<div class="oh-slot-row">' +
            '<div>' +
                '<label class="request-label">Day</label>' +
                '<select class="request-select oh-day">' +
                    '<option>Monday</option><option>Tuesday</option>' +
                    '<option>Wednesday</option><option>Thursday</option>' +
                    '<option>Friday</option>' +
                '</select>' +
            '</div>' +
            '<div>' +
                '<label class="request-label">Start</label>' +
                '<input type="time" class="request-select oh-start" value="10:00">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">End</label>' +
                '<input type="time" class="request-select oh-end" value="10:15">' +
            '</div>' +
            '<div style="align-self:end;">' +
                '<button class="table-action danger" onclick="this.closest(\'.oh-slot-entry\').remove()" ' +
                    'style="margin-bottom:12px;">✕</button>' +
            '</div>' +
        '</div>';
    container.appendChild(entry);
}

async function createOfficeHours() {
    var startDate = document.getElementById('ohStartDate').value;
    var weeks = parseInt(document.getElementById('ohWeeks').value, 10);

    if (!startDate || !weeks || weeks <= 0) {
        showOwnerError('ohErrorNote', 'Please fill in start date and number of weeks.');
        return;
    }

    var entries = document.querySelectorAll('.oh-slot-entry');
    if (entries.length === 0) {
        showOwnerError('ohErrorNote', 'Add at least one slot definition.');
        return;
    }

    var weeklySlots = [];
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var day = entry.querySelector('.oh-day').value;
        var start = entry.querySelector('.oh-start').value;
        var end = entry.querySelector('.oh-end').value;

        if (!day || !start || !end) {
            showOwnerError('ohErrorNote', 'Each slot must include a day, start time, and end time.');
            return;
        }

        if (start >= end) {
            showOwnerError('ohErrorNote', 'Each slot must end after it starts.');
            return;
        }

        weeklySlots.push({
            weekday: day.toLowerCase(),
            start_time: start,
            end_time: end
        });
    }

    try {
        const response = await fetch('/api/type3/create_office_hours', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start_date: startDate,
                num_weeks: weeks,
                weekly_slots: weeklySlots
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('ohErrorNote', data.error || 'Could not create office hours.');
            return;
        }

        hideMsg('ohErrorNote');
        showOwnerMsg(
            'ohSuccessNote',
            'Created ' + data.slots_created + ' slot(s). Go to "My Slots" to manage them.'
        );

        await loadOwnerSlots();
    } catch (error) {
        console.error('Error creating office hours:', error);
        showOwnerError('ohErrorNote', 'Could not create office hours.');
    }
}

/* ═══════════════════════════════════════════
   TAB 3: Create Group Meeting
   ═══════════════════════════════════════════ */

function addGMSlotEntry() {
    var container = document.getElementById('gmSlotEntries');
    var entry = document.createElement('div');
    entry.className = 'gm-slot-entry';

    entry.innerHTML =
        '<div class="oh-slot-row">' +
            '<div>' +
                '<label class="request-label">Start Date</label>' +
                '<input type="date" class="request-select gm-start-date">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">End Date</label>' +
                '<input type="date" class="request-select gm-end-date">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">Start Time</label>' +
                '<input type="time" class="request-select gm-start" value="14:00">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">End Time</label>' +
                '<input type="time" class="request-select gm-end" value="15:00">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">Day of Week</label>' +
                '<select class="request-select gm-day">' +
                    '<option value="monday">Monday</option>' +
                    '<option value="tuesday">Tuesday</option>' +
                    '<option value="wednesday">Wednesday</option>' +
                    '<option value="thursday">Thursday</option>' +
                    '<option value="friday">Friday</option>' +
                    '<option value="saturday">Saturday</option>' +
                    '<option value="sunday">Sunday</option>' +
                '</select>' +
            '</div>' +
            '<div style="align-self:end;">' +
                '<button class="table-action danger" onclick="this.closest(\'.gm-slot-entry\').remove()" style="margin-bottom:12px;">✕</button>' +
            '</div>' +
        '</div>';

    container.appendChild(entry);
}

// async function createGroupMeeting() {
//     var title = document.getElementById('gmTitle').value.trim();
//     var description = document.getElementById('gmDesc').value.trim();

//     var startDate = document.getElementById('gmStartDate').value;
//     var endDate = document.getElementById('gmEndDate').value;

//     if (!title) {
//         showOwnerError('gmErrorNote', 'Please enter a meeting title.');
//         return;
//     }

//     if (!startDate || !endDate) {
//         showOwnerError('gmErrorNote', 'Please select start and end dates.');
//         return;
//     }

//     var entries = document.querySelectorAll('.gm-slot-entry');
//     if (entries.length === 0) {
//         showOwnerError('gmErrorNote', 'Add at least one time option.');
//         return;
//     }

//     var slots = [];

//     entries.forEach(function (entry) {
//         var start_date = entry.querySelector('.gm-start-date').value;
//         var end_date = entry.querySelector('.gm-end-date').value;
//         var day = entry.querySelector('.gm-day').value;
//         var start = entry.querySelector('.gm-start').value;
//         var end = entry.querySelector('.gm-end').value;

//         if (!start_date || !end_date || !start || !end) {
//             return;
//         }

//         slots.push({
//             day: day,
//             start_date: start_date,
//             end_date: end_date,
//             start_time: start,
//             end_time: end
//         });
//     });

//     if (slots.length === 0) {
//         showOwnerError('gmErrorNote', 'Please fill all slot fields.');
//         return;
//     }

//     var inviteText = document.getElementById('gmInvitees').value.trim();
//     var invitees = inviteText
//         ? inviteText.split('\n').filter(e => e.trim())
//         : [];

//     try {
//         const response = await fetch('/group_meeting', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({
//                 title,
//                 description,
//                 start_date: startDate,
//                 end_date: endDate,
//                 slots,
//                 invitees
//             })
//         });

//         const data = await response.json();

//         if (!response.ok) {
//             showOwnerError('gmErrorNote', data.error || 'Failed to create meeting.');
//             return;
//         }

//         var inviteUrl = data.invite_url;

//         if (!inviteUrl) {
//             showOwnerError('gmErrorNote', 'Meeting created but no invite URL returned.');
//             return;
//         }

//         showOwnerMsg('gmSuccessNote',
//             'Meeting "' + title + '" created. Invite URL: ' + inviteUrl
//         );

//         if (invitees.length > 0) {
//             window.open(
//                 'mailto:' + invitees.join(',') +
//                 '?subject=' + encodeURIComponent('Bookly – Please vote: ' + title) +
//                 '&body=' + encodeURIComponent('Vote here: ' + inviteUrl),
//                 '_self'
//             );
//         }

//     } catch (error) {
//         console.error(error);
//         showOwnerError('gmErrorNote', 'Server error.');
//     }
// }

async function createGroupMeeting() {
    const title = document.getElementById('gmTitle').value.trim();
    const description = document.getElementById('gmDesc').value.trim();

    if (!title) {
        showOwnerError('gmErrorNote', 'Please enter a meeting title.');
        return;
    }

    const entries = document.querySelectorAll('.gm-slot-entry');
    if (entries.length === 0) {
        showOwnerError('gmErrorNote', 'Add at least one time option.');
        return;
    }

    let slots = [];

    entries.forEach(entry => {
        const start_date = entry.querySelector('.gm-start-date').value;
        const end_date = entry.querySelector('.gm-end-date').value;
        const day = entry.querySelector('.gm-day').value;
        const start_time = entry.querySelector('.gm-start').value;
        const end_time = entry.querySelector('.gm-end').value;

        if (start_date && end_date && start_time && end_time) {

            if (start_date > end_date) {
                return;
            }

            if (start_time >= end_time) {
                return;
            }

            slots.push({
                day,
                start_date,
                end_date,
                start_time,
                end_time
            });
        }
    });

    if (slots.length === 0) {
        showOwnerError('gmErrorNote', 'Please fill all slot fields.');
        return;
    }

    // derive meeting range from slots (fix for backend requirement)
    const startDate = slots.reduce((min, s) =>
        s.start_date < min ? s.start_date : min, slots[0].start_date);

    const endDate = slots.reduce((max, s) =>
        s.end_date > max ? s.end_date : max, slots[0].end_date);

    const inviteText = document.getElementById('gmInvitees').value.trim();
    const invitees = inviteText
        ? inviteText.split('\n').map(e => e.trim()).filter(Boolean)
        : [];

    try {
        const response = await fetch('/api/type2/group_meeting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                description,
                start_date: startDate,
                end_date: endDate,
                slots,
                invitees
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('gmErrorNote', data.error || 'Failed to create meeting.');
            return;
        }

        const inviteUrl = data.invite_url;

        if (!inviteUrl) {
            showOwnerError('gmErrorNote', 'Meeting created but no invite URL returned.');
            return;
        }

        ownerSwitchTab('manageGMView');

        showOwnerMsg(
            'mgmSuccessNote',
            `Meeting "${title}" created successfully. Invite URL: ${inviteUrl}`
        );

        if (invitees.length > 0) {
            window.open(
                'mailto:' + invitees.join(',') +
                '?subject=' + encodeURIComponent('Bookly – Please vote: ' + title) +
                '&body=' + encodeURIComponent('Vote here: ' + inviteUrl),
                '_self'
            );
        }

    } catch (error) {
        console.error(error);
        showOwnerError('gmErrorNote', 'Server error.');
    }
}

/* Group Bookings */
async function loadOwnerGroupBookings() {
    const table = document.getElementById('ownerGroupTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="appt-table-empty">Loading group meetings...</td>
        </tr>
    `;

    try {
        const response = await fetch('/api/type2/group_meeting/owner_bookings');
        const data = await readJsonResponse(response);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load group meetings.');
        }

        const meetings = data.meetings || [];

        if (meetings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="appt-table-empty">
                        No finalized group meetings yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        meetings.forEach(function (meeting) {
            const row = document.createElement('tr');

            const status = meeting.status || '';

            const zoomHtml = meeting.zoom_link && status !== 'cancelled'
                ? `<a class="table-link" href="${escapeHtml(meeting.zoom_link)}" target="_blank">Join</a>`
                : `<span class="no-link">No link</span>`;

            const recurrenceText = Number(meeting.isRecurring) === 1
                ? `${escapeHtml(meeting.recurrenceType || 'Recurring')} × ${escapeHtml(meeting.numOfRecurrences || '')}`
                : 'One-time';

            const attendeesText = meeting.attendee_names
                ? escapeHtml(meeting.attendee_names)
                : '<span class="no-link">No attendees</span>';

            const actionHtml = status === 'booked'
                ? `
                    <button class="table-action danger" onclick="cancelGroupMeeting(${meeting.meetingID})">
                        Cancel
                    </button>
                `
                : status === 'cancelled'
                    ? `
                        <button class="table-action danger" onclick="deleteGroupMeeting(${meeting.meetingID})">
                            Remove
                        </button>
                    `
                    : `
                        <button class="table-action vote" onclick="openFinalizeView(${meeting.meetingID}, '${escapeForJs(meeting.title || '')}')">
                            View votes
                        </button>
                        <button class="table-action danger" onclick="deleteGroupMeeting(${meeting.meetingID})">
                            Remove
                        </button>
                    `;

            row.innerHTML = `
                <td>${escapeHtml(meeting.title || 'Untitled group meeting')}</td>
                <td>${escapeHtml(meeting.date || '')}</td>
                <td>${escapeHtml(meeting.start_time || '')}</td>
                <td>${escapeHtml(meeting.end_time || '')}</td>
                <td>${recurrenceText}</td>
                <td>${zoomHtml}</td>
                <td><span class="status-badge ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
                <td>${attendeesText}</td>
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


/* ═══════════════════════════════════════════
   TAB 4: Manage Group Meetings — finalize
   ═══════════════════════════════════════════ */

async function openFinalizeView(meetingID, title) {
    ownerSwitchTab('finalizeGMView');

    document.getElementById('finalizeIntro').textContent =
        'Review vote counts for "' + title + '" and pick the best time.';
    document.getElementById('finalizeTitle').textContent = title;
    hideMsg('finalizeSuccessNote');
    hideMsg('finalizeErrorNote');

    /*
     * BACKEND TODO: replace dummySlots with fetch from /api/type2/meeting/<meetingID>
     * Response includes slots[] with count per slot
     */
    // var dummySlots = [
    //     { slotID: 1, date: '2026-04-28', start_time: '13:00', end_time: '14:00', count: 3 },
    //     { slotID: 2, date: '2026-04-28', start_time: '15:00', end_time: '16:00', count: 1 },
    //     { slotID: 3, date: '2026-04-29', start_time: '10:00', end_time: '11:00', count: 2 },
    //     { slotID: 4, date: '2026-04-30', start_time: '14:00', end_time: '15:00', count: 3 }
    // ];
    const res = await fetch(`/api/type2/group_meeting?meetingID=${meetingID}`);
    const data = await res.json();
    const slots = data.availabilities || [];

    var list = document.getElementById('finalizeSlotList');
    list.innerHTML = '';

    slots.forEach(function (slot) {
        var row = document.createElement('div');
        row.className = 'vote-slot-row';

        var lbl = document.createElement('div');
        lbl.className = 'vote-slot-label';
        lbl.innerHTML =
            '<span class="vote-slot-date">' + slot.date + '</span>' +
            '<span class="vote-slot-time">' + slot.start_time + ' – ' + slot.end_time + '</span>';

        var count = document.createElement('span');
        count.className = 'finalize-count';
        count.textContent = (slot.vote_count || 0) + ' vote(s)';

        var pickBtn = document.createElement('button');
        pickBtn.className = 'table-action vote';
        pickBtn.textContent = 'Pick this';
        pickBtn.addEventListener('click', function () {
            finalizeMeeting(meetingID, slot);
        });

        row.appendChild(lbl);
        row.appendChild(count);
        row.appendChild(pickBtn);
        list.appendChild(row);
    });

    document.getElementById('backToManageGMBtn').onclick = function () {
        ownerSwitchTab('manageGMView');
    };
}

async function finalizeMeeting(meetingID, slot) {
    if (!confirm('Finalize this group meeting time?')) {
        return;
    }

    hideMsg('finalizeErrorNote');

    try {
        const response = await fetch('/api/type2/group_meeting/decide', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meetingID: meetingID,
                availabilityID: slot.availabilityID
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('finalizeErrorNote', data.error || 'Could not finalize meeting.');
            return;
        }

        showOwnerMsg(
            'finalizeSuccessNote',
            `Meeting finalized for ${slot.date} from ${slot.start_time} to ${slot.end_time}.`
        );

        await loadOwnerGroupMeetings();

        if (typeof loadOwnerGroupBookings === 'function') {
            await loadOwnerGroupBookings();
        }

        setTimeout(function () {
            ownerSwitchTab('ownerApptsView');
        }, 800);

    } catch (error) {
        console.error(error);
        showOwnerError('finalizeErrorNote', 'Server error while finalizing meeting.');
    }
}

/* ═══════════════════════════════════════════
   TAB 5: Pending Requests — accept / decline
   ═══════════════════════════════════════════ */

async function acceptRequest(meetingID, studentEmail) {
    try {
        const response = await fetch('/api/type1/accept', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meetingID: meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('pendingErrorNote', data.error || 'Could not accept request.');
            return;
        }

        await loadPendingRequests();
        await loadOwnerType1Meetings();

        showOwnerMsg('pendingSuccessNote', 'Request ' + meetingID + ' accepted.');
    } catch (error) {
        console.error('Accept request error:', error);
        showOwnerError('pendingErrorNote', 'Could not connect to server.');
    }
}

async function declineRequest(meetingID, studentEmail) {
    try {
        const response = await fetch('/api/type1/decline', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meetingID: meetingID })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('pendingErrorNote', data.error || 'Could not decline request.');
            return;
        }

        await loadPendingRequests();

        showOwnerMsg('pendingSuccessNote', 'Request ' + meetingID + ' declined.');
    } catch (error) {
        console.error('Decline request error:', error);
        showOwnerError('pendingErrorNote', 'Could not connect to server.');
    }
}

async function loadPendingRequests() {
    const tbody = document.querySelector('#pendingRequestsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="appt-table-empty">Loading pending requests...</td>
        </tr>
    `;

    try {
        const meResponse = await fetch('/api/me');
        const me = await meResponse.json();

        if (!meResponse.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="appt-table-empty">Could not load owner info.</td>
                </tr>
            `;
            return;
        }

        const response = await fetch(`/api/type1/pending/${encodeURIComponent(me.email)}`);
        const requests = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="appt-table-empty">Could not load pending requests.</td>
                </tr>
            `;
            return;
        }

        if (!requests || requests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="appt-table-empty">No pending requests.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        requests.forEach(function (request) {
            const row = document.createElement('tr');
            row.id = `pending-row-${request.meetingID}`;

            row.innerHTML = `
                <td>${request.meetingID}</td>
                <td>
                    ${request.student_email}
                    <br>
                    <span class="no-link">${request.student_email}</span>
                </td>
                <td>${request.message || ''}</td>
                <td>${request.date || ''}</td>
                <td>${request.start_time || ''}</td>
                <td>${request.end_time || ''}</td>

                <td>
                    <div class="table-actions">
                        <button class="table-action vote" onclick="acceptRequest(${request.meetingID}, '${request.student_email}')">Accept</button>
                        <button class="table-action danger" onclick="declineRequest(${request.meetingID}, '${request.student_email}')">Decline</button>
                        <a class="table-action" href="mailto:${request.student_email}?subject=Bookly%20-%20Meeting%20request">Email</a>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Load pending requests error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="appt-table-empty">Could not connect to server.</td>
            </tr>
        `;
    }
}

async function loadOwnerType1Meetings() {
    const tbody = document.querySelector('#ownerIndividualTable tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="appt-table-empty">Loading individual meetings...</td>
        </tr>
    `;

    try {
        const response = await fetch('/api/type1/owner_meetings');
        const data = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="appt-table-empty">Could not load individual meetings.</td>
                </tr>
            `;
            return;
        }

        const meetings = data.meetings || [];

        if (meetings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="appt-table-empty">No accepted individual meetings yet.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        meetings.forEach(function (meeting) {
            const zoomCell = meeting.zoom_link
                ? `<a class="table-action primary" href="${meeting.zoom_link}" target="_blank">Join</a>`
                : `<button class="table-action" disabled style="opacity:0.45; cursor:not-allowed;">Join</button>`;

            const row = document.createElement('tr');

            const actionHtml = meeting.status === 'cancelled'
                ? `
                    <button class="table-action danger" onclick="deleteOwnerType1Meeting(${meeting.meetingID})">
                        Remove
                    </button>
                `
                : `
                    <a class="table-action" href="mailto:${escapeHtml(meeting.student_email || '')}">
                        Email
                    </a>
                    <button class="table-action danger" onclick="cancelOwnerType1Meeting(${meeting.meetingID})">
                        Cancel
                    </button>
                `;

            row.innerHTML = `
                <td>${meeting.meetingID}</td>
                <td>
                    ${meeting.student_name}
                    <br>
                    <span class="no-link">${meeting.student_email}</span>
                </td>
                <td>${meeting.date}</td>
                <td>${meeting.start_time}</td>
                <td>${meeting.end_time}</td>
                <td>${zoomCell}</td>
                <td>
                    <span class="status-badge ${escapeHtml(meeting.status || '')}">
                        ${escapeHtml(meeting.status || '')}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        ${actionHtml}
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Load owner Type 1 meetings error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="appt-table-empty">Could not connect to server.</td>
            </tr>
        `;
    }
}

async function loadOwnerGroupMeetings() {
    const table = document.getElementById('groupMeetingsManageTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="appt-table-empty">Loading group meetings...</td>
        </tr>
    `;

    try {
        const response = await fetch('/api/type2/group_meeting/owner');

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load group meetings.');
        }

        const meetings = data.meetings || [];

        if (meetings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="appt-table-empty">
                        No group meetings created yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        meetings.forEach(function (meeting) {
            const status = meeting.status || 'open';
            const inviteUrl = meeting.invite_url || `/group/${meeting.meetingID}`;
            const dateRange = `${meeting.startDate || ''} to ${meeting.endDate || ''}`;

            const actionHtml = status === 'booked'
                ? `
                    <button class="table-action danger" onclick="cancelGroupMeeting(${meeting.meetingID})">
                        Cancel
                    </button>
                `
                : status === 'cancelled'
                    ? `
                        <button class="table-action danger" onclick="deleteGroupMeeting(${meeting.meetingID})">
                            Remove
                        </button>
                    `
                    : `
                        <button class="table-action vote" onclick="openFinalizeView(${meeting.meetingID}, '${escapeForJs(meeting.title || '')}')">
                            View votes
                        </button>
                        <button class="table-action danger" onclick="deleteGroupMeeting(${meeting.meetingID})">
                            Remove
                        </button>
                    `;


            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${escapeHtml(meeting.title || 'Untitled group meeting')}</td>
                <td>${escapeHtml(dateRange)}</td>
                <td>
                    <span class="invite-url-text">${escapeHtml(inviteUrl)}</span>
                    <button class="table-action" onclick="copyInviteUrl(this)" style="margin-left:4px;">Copy</button>
                </td>
                <td><span class="status-badge ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
                <td>
                    <div class="table-actions">
                        ${actionHtml}
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="appt-table-empty">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}


document.addEventListener('DOMContentLoaded', async function () {
    if (typeof loadCurrentUser === 'function') {
        await loadCurrentUser();
    }

    ownerSwitchTab('ownerApptsView');

    if (typeof loadPendingRequests === 'function') {
        loadPendingRequests();
    }

    if (typeof loadOwnerGroupMeetings === 'function') {
        loadOwnerGroupMeetings();
    }

    if (typeof loadOwnerSlots === 'function') {
        loadOwnerSlots();
    }
});


/* ═══════════════════════════════════════════
            Cancel / Remove
   ═══════════════════════════════════════════ */

async function cancelGroupMeeting(meetingID) {
    if (!confirm('Cancel this finalized group meeting?')) {
        return;
    }

    try {
        const response = await fetch('/api/type2/group_meeting/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meetingID: meetingID
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('mgmErrorNote', data.error || 'Failed to cancel group meeting.');
            return;
        }

        showOwnerMsg('mgmSuccessNote', data.message || 'Group meeting cancelled.');

        if (typeof loadOwnerGroupMeetings === 'function') {
            await loadOwnerGroupMeetings();
        }

        if (typeof loadOwnerGroupBookings === 'function') {
            await loadOwnerGroupBookings();
        }

    } catch (error) {
        console.error(error);
        showOwnerError('mgmErrorNote', 'Server error while cancelling group meeting.');
    }
}

async function deleteGroupMeeting(meetingID) {
    if (!confirm('Remove this group meeting permanently? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/type2/group_meeting/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meetingID: meetingID
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('mgmErrorNote', data.error || 'Failed to remove group meeting.');
            return;
        }

        showOwnerMsg('mgmSuccessNote', data.message || 'Group meeting removed.');

        if (typeof loadOwnerGroupMeetings === 'function') {
            await loadOwnerGroupMeetings();
        }

        if (typeof loadOwnerGroupBookings === 'function') {
            await loadOwnerGroupBookings();
        }

    } catch (error) {
        console.error(error);
        showOwnerError('mgmErrorNote', 'Server error while removing group meeting.');
    }
}

async function cancelOwnerType1Meeting(meetingID) {
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
            alert(data.error || 'Failed to cancel individual meeting.');
            return;
        }

        if (typeof loadOwnerType1Meetings === 'function') {
            await loadOwnerType1Meetings();
        }

    } catch (error) {
        console.error(error);
        alert('Server error while cancelling individual meeting.');
    }
}

async function deleteOwnerType1Meeting(meetingID) {
    if (!confirm('Remove this individual meeting permanently?')) {
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
            alert(data.error || 'Failed to remove individual meeting.');
            return;
        }

        if (typeof loadOwnerType1Meetings === 'function') {
            await loadOwnerType1Meetings();
        }

    } catch (error) {
        console.error(error);
        alert('Server error while removing individual meeting.');
    }
}

/* ═══════════════════════════════════════════
   Shared message helpers
   ═══════════════════════════════════════════ */

function showOwnerMsg(id, text) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.classList.add('show');
}

function showOwnerError(id, text) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.classList.add('show');
}

function hideMsg(id) {
    var el = document.getElementById(id);
    el.textContent = '';
    el.classList.remove('show');
}