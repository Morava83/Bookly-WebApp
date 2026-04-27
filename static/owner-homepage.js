/* ═══════════════════════════════════════════
   Owner Homepage JS — all dummy data for now
   ═══════════════════════════════════════════ */

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

function ownerSwitchTab(viewId) {
    var views = document.querySelectorAll('.owner-tab-view');
    for (var i = 0; i < views.length; i++) {
        views[i].style.display = 'none';
    }

    document.getElementById(viewId).style.display = 'block';

    if (viewId === 'mySlotsView') {
        loadOwnerSlots();
    }
    if (viewId === 'ownerApptsView') {
        loadOwnerAppointments();
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
            '<tr>' +
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

function toggleSlotStatus(btn) {
    /*
     * BACKEND TODO: replace with fetch to /api/type3/activate_slot
     * body: { slotID: ..., is_active: true/false }
     */
    var row = btn.closest('tr');
    var badge = row.querySelector('.status-badge');

    if (badge.textContent.trim() === 'Active') {
        badge.textContent = 'Private';
        badge.className = 'status-badge private';
        btn.textContent = 'Activate';
        btn.className = 'table-action vote';
    } else if (badge.textContent.trim() === 'Private') {
        badge.textContent = 'Active';
        badge.className = 'status-badge open';
        btn.textContent = 'Deactivate';
        btn.className = 'table-action';
    }
}

async function deleteSlot(btn, notifyEmail) {
    /*
     * BACKEND TODO: replace with fetch to /api/type3/delete_slot
     * body: { slotID: ... }
     * If response includes notify_email, open mailto:
     */
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
            showOwnerMsg('slotsMsg', 'A mailto: window was opened to notify the student.');

            window.location.href = 'mailto:' + notifyEmail +
                '?subject=' + encodeURIComponent('Bookly - Slot cancelled') +
                '&body=' + encodeURIComponent('Your booked slot has been cancelled by the owner.');
        }

    } catch (error) {
        showOwnerError('slotsError', 'Could not delete slot.');
    }
}

function activateAllSlots() {
    /*
     * BACKEND TODO: replace with fetch to /api/type3/activate_all
     * for each meetingID owned by this user
     */
    var badges = document.querySelectorAll('#ownerSlotsTable .status-badge');
    badges.forEach(function (b) {
        if (b.textContent.trim() === 'Private') {
            b.textContent = 'Active';
            b.className = 'status-badge open';
        }
    });
    // Update buttons
    var btns = document.querySelectorAll('#ownerSlotsTable .table-action.vote');
    btns.forEach(function (btn) {
        if (btn.textContent.trim() === 'Activate') {
            btn.textContent = 'Deactivate';
            btn.className = 'table-action';
        }
    });
    showOwnerMsg('slotsMsg', 'All slots activated.');
}

function deactivateAllSlots() {
    /*
     * BACKEND TODO: replace with fetch to /api/type3/activate_all { is_active: false }
     */
    var rows = document.querySelectorAll('#ownerSlotsTable tbody tr');
    rows.forEach(function (row) {
        var badge = row.querySelector('.status-badge');
        if (badge && badge.textContent.trim() === 'Active') {
            badge.textContent = 'Private';
            badge.className = 'status-badge private';
        }
        // Find the toggle button (not the Delete button)
        var toggleBtn = row.querySelector('.table-action:not(.danger):not(.vote)');
        if (toggleBtn && toggleBtn.textContent.trim() === 'Deactivate') {
            toggleBtn.textContent = 'Activate';
            toggleBtn.className = 'table-action vote';
        }
    });
    showOwnerMsg('slotsMsg', 'All slots deactivated.');
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
                '<label class="request-label">Date</label>' +
                '<input type="date" class="request-select gm-date">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">Start</label>' +
                '<input type="time" class="request-select gm-start" value="14:00">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">End</label>' +
                '<input type="time" class="request-select gm-end" value="15:00">' +
            '</div>' +
            '<div style="align-self:end;">' +
                '<button class="table-action danger" onclick="this.closest(\'.gm-slot-entry\').remove()" ' +
                    'style="margin-bottom:12px;">✕</button>' +
            '</div>' +
        '</div>';
    container.appendChild(entry);
}

async function createGroupMeeting() {
    /*
     * BACKEND TODO: replace with fetch to /api/type2/create
     * body: {
     *   title: document.getElementById('gmTitle').value,
     *   description: document.getElementById('gmDesc').value,
     *   slots: [ { date, start_time, end_time }, ... ],
     *   invitees: [ "email1", "email2", ... ]
     * }
     * Response will include invite_token and invite_url
     */

    var title = document.getElementById('gmTitle').value.trim();
    if (!title) {
        showOwnerError('gmErrorNote', 'Please enter a meeting title.');
        return;
    }

    var entries = document.querySelectorAll('.gm-slot-entry');
    if (entries.length === 0) {
        showOwnerError('gmErrorNote', 'Add at least one time option.');
        return;
    }

        var slots = [];

    entries.forEach(function (entry) {
        var date = entry.querySelector('.gm-date').value;
        var start = entry.querySelector('.gm-start').value;
        var end = entry.querySelector('.gm-end').value;

        if (!date || !start || !end) {
            return;
        }

        slots.push({
            date: date,
            start_time: start,
            end_time: end
        });
    });

    if (slots.length === 0) {
        showOwnerError('gmErrorNote', 'Please fill all slot fields.');
        return;
    }


    var inviteText = document.getElementById('gmInvitees').value.trim();
    var invitees = inviteText ? inviteText.split('\n').filter(function (e) { return e.trim(); }) : [];

    var dummyUrl = window.location.origin + '/book/new_' + Date.now();

    hideMsg('gmErrorNote');
    // var msg = 'Group meeting "' + title + '" created (dummy). Invite URL: ' + dummyUrl;
    // if (invitees.length > 0) {
    //     msg += '\nSend invite to ' + invitees.length + ' user(s).';
    // }
    // showOwnerMsg('gmSuccessNote', msg);

    try {
        const response = await fetch('/goup_meeting', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            description: document.getElementById('gmDesc').value,
            slots: slots,
            invitees: invitees
        })
    });

    const data = await response.json();

    if (!response.ok) {
        showOwnerError('gmErrorNote', data.error || 'Failed to create meeting.');
        return;
    }

    hideMsg('gmErrorNote');

    // Use backend-generated invite URL if available
    //var inviteUrl = data.invite_url || (window.location.origin + '/book/' + data.token);
    var inviteUrl = data.invite_url || null;

    if (!inviteUrl) {
        showOwnerError('gmErrorNote', 'Meeting created but no invite URL returned.');
        return;
    }

    var msg = 'Meeting "' + title + '" created. Invite URL: ' + inviteUrl;
    showOwnerMsg('gmSuccessNote', msg);

    //email invite
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

    // Open mailto: with invite link if there are invitees
    // if (invitees.length > 0) {
    //     window.open(
    //         'mailto:' + invitees.join(',') +
    //         '?subject=' + encodeURIComponent('Bookly – Please vote: ' + title) +
    //         '&body=' + encodeURIComponent('Vote on your availability here: ' + dummyUrl),
    //         '_self'
    //     );
    // }
}

/* ═══════════════════════════════════════════
   TAB 4: Manage Group Meetings — finalize
   ═══════════════════════════════════════════ */

function openFinalizeView(meetingID, title) {
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
    var dummySlots = [
        { slotID: 1, date: '2026-04-28', start_time: '13:00', end_time: '14:00', count: 3 },
        { slotID: 2, date: '2026-04-28', start_time: '15:00', end_time: '16:00', count: 1 },
        { slotID: 3, date: '2026-04-29', start_time: '10:00', end_time: '11:00', count: 2 },
        { slotID: 4, date: '2026-04-30', start_time: '14:00', end_time: '15:00', count: 3 }
    ];

    var list = document.getElementById('finalizeSlotList');
    list.innerHTML = '';

    dummySlots.forEach(function (slot) {
        var row = document.createElement('div');
        row.className = 'vote-slot-row';

        var lbl = document.createElement('div');
        lbl.className = 'vote-slot-label';
        lbl.innerHTML =
            '<span class="vote-slot-date">' + slot.date + '</span>' +
            '<span class="vote-slot-time">' + slot.start_time + ' – ' + slot.end_time + '</span>';

        var count = document.createElement('span');
        count.className = 'finalize-count';
        count.textContent = slot.count + ' vote(s)';

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

function finalizeMeeting(meetingID, slot) {
    /*
     * BACKEND TODO: replace with fetch to /api/type2/finalize
     * body: { meetingID, slotID: slot.slotID, is_recurring: ..., num_weeks: ... }
     */
    var recurring = confirm('Make this a recurring meeting?');
    var weeks = 1;
    if (recurring) {
        var w = prompt('How many weeks?', '5');
        weeks = parseInt(w) || 1;
    }

    hideMsg('finalizeErrorNote');
    showOwnerMsg('finalizeSuccessNote',
        'Meeting finalized (dummy) for ' + slot.date + ' at ' + slot.start_time +
        (recurring ? ' — recurring for ' + weeks + ' weeks.' : '.')
    );
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
            <td colspan="5" class="appt-table-empty">Loading pending requests...</td>
        </tr>
    `;

    try {
        const meResponse = await fetch('/api/me');
        const me = await meResponse.json();

        if (!meResponse.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="appt-table-empty">Could not load owner info.</td>
                </tr>
            `;
            return;
        }

        const response = await fetch(`/api/type1/pending/${encodeURIComponent(me.email)}`);
        const requests = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="appt-table-empty">Could not load pending requests.</td>
                </tr>
            `;
            return;
        }

        if (!requests || requests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="appt-table-empty">No pending requests.</td>
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
                <td colspan="5" class="appt-table-empty">Could not connect to server.</td>
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
                <td><span class="status-badge accepted">${meeting.status}</span></td>
                <td>
                    <div class="table-actions">
                        <a class="table-action" href="mailto:${meeting.student_email}">Email</a>
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

document.addEventListener('DOMContentLoaded', function () {
    loadPendingRequests();
    loadOwnerType1Meetings();
});

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