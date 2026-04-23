/* ═══════════════════════════════════════════
   Owner Homepage JS — all dummy data for now
   ═══════════════════════════════════════════ */

/* ── Tab switching ── */

function ownerSwitchTab(viewId) {
    var views = document.querySelectorAll('.owner-tab-view');
    for (var i = 0; i < views.length; i++) {
        views[i].style.display = 'none';
    }
    document.getElementById(viewId).style.display = 'block';
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

function deleteSlot(btn, notifyEmail) {
    /*
     * BACKEND TODO: replace with fetch to /api/type3/delete_slot
     * body: { slotID: ... }
     * If response includes notify_email, open mailto:
     */
    if (!confirm('Delete this slot?')) return;

    var row = btn.closest('tr');
    row.remove();

    if (notifyEmail) {
        // Open mailto: to notify the student whose booking was cancelled
        window.open(
            'mailto:' + notifyEmail +
            '?subject=Bookly%20-%20Slot%20cancelled' +
            '&body=' + encodeURIComponent('Your booked slot has been cancelled by the owner.'),
            '_self'
        );
        showOwnerMsg('slotsMsg', 'Slot deleted. A mailto: window was opened to notify the student.');
    } else {
        showOwnerMsg('slotsMsg', 'Slot deleted.');
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

function createOfficeHours() {
    /*
     * BACKEND TODO: replace with fetch to /api/type3/create_office_hours
     * body: {
     *   start_date: document.getElementById('ohStartDate').value,
     *   num_weeks: parseInt(document.getElementById('ohWeeks').value),
     *   weekly_slots: [ { weekday, start_time, end_time }, ... ]
     * }
     */
    var startDate = document.getElementById('ohStartDate').value;
    var weeks = document.getElementById('ohWeeks').value;

    if (!startDate || !weeks || parseInt(weeks) <= 0) {
        showOwnerError('ohErrorNote', 'Please fill in start date and number of weeks.');
        return;
    }

    var entries = document.querySelectorAll('.oh-slot-entry');
    if (entries.length === 0) {
        showOwnerError('ohErrorNote', 'Add at least one slot definition.');
        return;
    }

    // Dummy: count how many slots would be created
    var count = entries.length * parseInt(weeks);
    hideMsg('ohErrorNote');
    showOwnerMsg('ohSuccessNote',
        'Created ' + count + ' slots (dummy). Starting ' + startDate +
        ' for ' + weeks + ' weeks. Go to "My Slots" to activate them.'
    );
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

function createGroupMeeting() {
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

    var inviteText = document.getElementById('gmInvitees').value.trim();
    var invitees = inviteText ? inviteText.split('\n').filter(function (e) { return e.trim(); }) : [];

    var dummyUrl = window.location.origin + '/book/new_' + Date.now();

    hideMsg('gmErrorNote');
    var msg = 'Group meeting "' + title + '" created (dummy). Invite URL: ' + dummyUrl;
    if (invitees.length > 0) {
        msg += '\nSend invite to ' + invitees.length + ' user(s).';
    }
    showOwnerMsg('gmSuccessNote', msg);

    // Open mailto: with invite link if there are invitees
    if (invitees.length > 0) {
        window.open(
            'mailto:' + invitees.join(',') +
            '?subject=' + encodeURIComponent('Bookly – Please vote: ' + title) +
            '&body=' + encodeURIComponent('Vote on your availability here: ' + dummyUrl),
            '_self'
        );
    }
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

function acceptRequest(meetingID, studentEmail) {
    /*
     * BACKEND TODO: replace with fetch to /api/type1/accept
     * body: { meetingID }
     */
    var row = document.getElementById('pending-row-' + meetingID);
    if (row) row.remove();

    showOwnerMsg('pendingSuccessNote', 'Request ' + meetingID + ' accepted.');

    // Open mailto: to notify the student
    window.open(
        'mailto:' + studentEmail +
        '?subject=Bookly%20-%20Meeting%20accepted' +
        '&body=' + encodeURIComponent('Your meeting request has been accepted.'),
        '_self'
    );
}

function declineRequest(meetingID, studentEmail) {
    /*
     * BACKEND TODO: replace with fetch to /api/type1/decline
     * body: { meetingID }
     */
    var row = document.getElementById('pending-row-' + meetingID);
    if (row) row.remove();

    showOwnerMsg('pendingSuccessNote', 'Request ' + meetingID + ' declined.');

    // Open mailto: to notify the student
    window.open(
        'mailto:' + studentEmail +
        '?subject=Bookly%20-%20Meeting%20declined' +
        '&body=' + encodeURIComponent('Your meeting request has been declined.'),
        '_self'
    );
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