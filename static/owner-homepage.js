// ======= Owner Dashboard =========


// ======= Helper Functions ========
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

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

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

function showOwnerMsg(id, text) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = text;
    el.classList.add('show');
}

function showOwnerError(id, text) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = text;
    el.classList.add('show');
}

function hideMsg(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = '';
    el.classList.remove('show');
}

function formatRoleLabel(role) {
    if (!role) return 'Unknown';
    return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatStatusBadge(status) {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'booked') {
        return '<span class="status-badge booked">Booked</span>';
    }

    if (normalized === 'private') {
        return '<span class="status-badge private">Private</span>';
    }

    if (normalized === 'cancelled') {
        return '<span class="status-badge cancelled">Cancelled</span>';
    }

    if (normalized === 'accepted') {
        return '<span class="status-badge accepted">Accepted</span>';
    }

    if (normalized === 'pending') {
        return '<span class="status-badge pending">Pending</span>';
    }

    return '<span class="status-badge open">Active</span>';
}

function updateOwnerBookingInviteUrl(user) {
    const el = document.getElementById('ownerBookingInviteUrl');

    if (!el || !user || !user.userID) {
        return;
    }

    el.textContent = `${window.location.origin}/book/owner/${user.userID}`;
}

// ========================================================

// ======= Current Owner Information ========
async function loadCurrentUser() {
    const currentUserName = document.getElementById('currentUserName');
    const currentUserEmail = document.getElementById('currentUserEmail');
    const currentUserRole = document.getElementById('currentUserRole');

    try {
        const response = await fetch('/api/me');
        const data = await response.json();

        if (!response.ok) {
            if (currentUserName) currentUserName.textContent = 'Unavailable';
            if (currentUserEmail) currentUserEmail.textContent = 'Unavailable';
            if (currentUserRole) currentUserRole.textContent = 'Unavailable';
            return;
        }

        if (currentUserName) currentUserName.textContent = data.name || 'Unknown';
        if (currentUserEmail) currentUserEmail.textContent = data.email || 'Unknown';
        if (currentUserRole) currentUserRole.textContent = formatRoleLabel(data.role);
        updateOwnerBookingInviteUrl(data);

    } catch (error) {
        console.error('Error loading current user:', error);

        if (currentUserName) currentUserName.textContent = 'Unavailable';
        if (currentUserEmail) currentUserEmail.textContent = 'Unavailable';
        if (currentUserRole) currentUserRole.textContent = 'Unavailable';
    }
}


// =========== Main Tab Switching ===========
function ownerSwitchTab(tabId) {
    const views = document.querySelectorAll('.owner-tab-view');

    views.forEach(function (view) {
        view.style.display = 'none';
    });

    const selectedView = document.getElementById(tabId);
    if (selectedView) {
        selectedView.style.display = 'block';
    }

    if (tabId === 'mySlotsView') {
        if (typeof loadOwnerSlots === 'function') {
            loadOwnerSlots();
        }
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
    }
}



// ======== Notifications ========

async function toggleNotifications(e) {
    e.stopPropagation();

    const panel = document.getElementById('notifPanel');

    if (!panel) {
        return;
    }

    panel.classList.toggle('open');

    if (panel.classList.contains('open')) {
        await loadOwnerNotifications();
        await markOwnerNotificationsRead();
    }
}

async function loadOwnerNotifications() {
    const notifList = document.getElementById('notifList');
    const notifCount = document.getElementById('notifCount');

    if (!notifList || !notifCount) {
        return;
    }

    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();

        if (!response.ok) {
            console.error(data.error || 'Could not load owner notifications.');
            return;
        }

        const notifications = data.notifications || [];
        const unreadCount = data.unread_count || 0;

        notifCount.textContent = unreadCount > 0 ? String(unreadCount) : '';

        notifList.innerHTML = '';

        if (notifications.length === 0) {
            notifList.innerHTML =
                '<div class="notif-item">' +
                    '<div class="notif-text">No notifications yet.</div>' +
                '</div>';
            return;
        }

        notifications.forEach(function (notification) {
            const item = document.createElement('div');
            item.className = 'notif-item' + (notification.is_read ? '' : ' unread');

            item.innerHTML =
                '<div class="notif-text">' + escapeHtml(notification.message) + '</div>' +
                '<div class="notif-time">' + formatOwnerNotificationTime(notification.created_at) + '</div>';

            notifList.appendChild(item);
        });

    } catch (error) {
        console.error('Owner notification load error:', error);
    }
}

async function markOwnerNotificationsRead() {
    const notifCount = document.getElementById('notifCount');

    try {
        await fetch('/api/notifications/mark-read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (notifCount) {
            notifCount.textContent = '';
        }

        document.querySelectorAll('.notif-item.unread').forEach(function (item) {
            item.classList.remove('unread');
        });

    } catch (error) {
        console.error('Could not mark owner notifications as read:', error);
    }
}

function formatOwnerNotificationTime(value) {
    if (!value) {
        return '';
    }

    const date = new Date(String(value).replace(' ', 'T'));

    if (isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function setupOwnerSocket() {
    try {
        const socket = io();

        socket.on('notification', async function (data) {
            if (data && data.message) {
                await loadOwnerNotifications();
            }
        });

    } catch (error) {
        console.error('Owner SocketIO setup error:', error);
    }
}

function setupNotificationPanelClose() {
    document.addEventListener('click', function (e) {
        const panel = document.getElementById('notifPanel');
        const toggle = document.getElementById('notifToggle');

        if (!panel) {
            return;
        }

        if (toggle && toggle.contains(e.target)) {
            return;
        }

        if (!panel.contains(e.target)) {
            panel.classList.remove('open');
        }
    });
}



// ========= Logout =============

function setupLogoutButton() {
    const logoutButton = document.getElementById('logoutButton');

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener('click', async function () {
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
}

// ============ Invite URL ==============
function copyInviteUrl(btn) {
    const textEl = btn.previousElementSibling || btn.parentElement.querySelector('.invite-url-text');

    if (!textEl) {
        return;
    }

    const rawText = textEl.textContent.trim();

    const url = rawText.startsWith('http')
        ? rawText
        : window.location.origin + rawText;

    navigator.clipboard.writeText(url).then(function () {
        btn.textContent = 'Copied!';

        setTimeout(function () {
            btn.textContent = 'Copy';
        }, 2000);
    });
}

// ============= Type 1 ===============
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
            const studentEmail = request.student_email || '';
            const row = document.createElement('tr');

            row.id = `pending-row-${request.meetingID}`;

            row.innerHTML = `
                <td>${escapeHtml(request.meetingID)}</td>
                <td>
                    ${escapeHtml(studentEmail)}
                    <br>
                    <span class="no-link">${escapeHtml(studentEmail)}</span>
                </td>
                <td>${escapeHtml(request.message || '')}</td>
                <td>${escapeHtml(request.date || '')}</td>
                <td>${escapeHtml(request.start_time || '')}</td>
                <td>${escapeHtml(request.end_time || '')}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action vote" onclick="acceptRequest(${request.meetingID}, '${escapeForJs(studentEmail)}')">Accept</button>
                        <button class="table-action danger" onclick="declineRequest(${request.meetingID}, '${escapeForJs(studentEmail)}')">Decline</button>
                        <a class="table-action" href="mailto:${escapeHtml(studentEmail)}?subject=Bookly%20-%20Meeting%20request">Email</a>
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
                    <td colspan="8" class="appt-table-empty">No individual meetings yet.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        meetings.forEach(function (meeting) {
            const row = document.createElement('tr');

            const zoomCell = meeting.zoom_link && meeting.status !== 'cancelled'
                ? `<a class="table-action primary" href="${escapeHtml(meeting.zoom_link)}" target="_blank">Join</a>`
                : `<button class="table-action" disabled style="opacity:0.45; cursor:not-allowed;">Join</button>`;

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
                <td>${escapeHtml(meeting.meetingID)}</td>
                <td>
                    ${escapeHtml(meeting.student_name || '')}
                    <br>
                    <span class="no-link">${escapeHtml(meeting.student_email || '')}</span>
                </td>
                <td>${escapeHtml(meeting.date || '')}</td>
                <td>${escapeHtml(meeting.start_time || '')}</td>
                <td>${escapeHtml(meeting.end_time || '')}</td>
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

        await loadOwnerType1Meetings();

    } catch (error) {
        console.error('Cancel owner Type 1 meeting error:', error);
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

        await loadOwnerType1Meetings();

    } catch (error) {
        console.error('Delete owner Type 1 meeting error:', error);
        alert('Server error while removing individual meeting.');
    }
}


// ============ Type 2 ==============
function addGMSlotEntry() {
    const container = document.getElementById('gmSlotEntries');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'gm-slot-entry';

    entry.innerHTML =
        '<div class="oh-slot-row">' +
            '<div>' +
                '<label class="request-label">Date</label>' +
                '<input type="date" class="request-select gm-date">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">Start Time</label>' +
                '<input type="time" class="request-select gm-start" value="14:00">' +
            '</div>' +
            '<div>' +
                '<label class="request-label">End Time</label>' +
                '<input type="time" class="request-select gm-end" value="15:00">' +
            '</div>' +
            '<div style="align-self:end;">' +
                '<button class="table-action danger" onclick="this.closest(\'.gm-slot-entry\').remove()" style="margin-bottom:12px;">✕</button>' +
            '</div>' +
        '</div>';

    container.appendChild(entry);
}

function toggleGMRecurrenceFields() {
    const checkbox = document.getElementById('gmIsRecurring');
    const fields = document.getElementById('gmRecurrenceFields');

    if (!checkbox || !fields) return;

    fields.style.display = checkbox.checked ? 'block' : 'none';
}

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

    const slots = [];

    entries.forEach(function (entry) {
        const date = entry.querySelector('.gm-date')?.value;
        const start_time = entry.querySelector('.gm-start')?.value;
        const end_time = entry.querySelector('.gm-end')?.value;

        if (date && start_time && end_time) {
            slots.push({
                date,
                start_time,
                end_time
            });
        }
    });

    if (slots.length === 0) {
        showOwnerError('gmErrorNote', 'Please fill all slot fields.');
        return;
    }

    for (let i = 0; i < slots.length; i++) {
        if (slots[i].start_time >= slots[i].end_time) {
            showOwnerError('gmErrorNote', 'Each time option must end after it starts.');
            return;
        }
    }

    const isRecurring = document.getElementById('gmIsRecurring')?.checked ? 1 : 0;
    const recurrenceType = isRecurring
        ? document.getElementById('gmRecurrenceType').value
        : null;

    const recurrenceEndDate = isRecurring
        ? document.getElementById('gmRecurrenceEndDate').value
        : null;

    if (isRecurring && !recurrenceEndDate) {
        showOwnerError('gmErrorNote', 'Please choose a recurrence end date.');
        return;
    }

    const minSlotDate = slots.reduce(function (min, slot) {
        return slot.date < min ? slot.date : min;
    }, slots[0].date);

    if (isRecurring && recurrenceEndDate < minSlotDate) {
        showOwnerError('gmErrorNote', 'Recurrence end date must be after the first meeting option.');
        return;
    }

    const inviteText = document.getElementById('gmInvitees').value.trim();
    const invitees = inviteText
        ? inviteText.split('\n').map(function (email) {
            return email.trim();
        }).filter(Boolean)
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
                slots,
                invitees,
                isRecurring,
                recurrenceType,
                recurrenceEndDate
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('gmErrorNote', data.error || 'Failed to create meeting.');
            return;
        }

        hideMsg('gmErrorNote');

        showOwnerMsg(
            'gmSuccessNote',
            `Meeting "${title}" created successfully. Invite URL: ${data.invite_url || ''}`
        );

        if (typeof loadOwnerGroupMeetings === 'function') {
            await loadOwnerGroupMeetings();
        }

        if (invitees.length > 0 && data.invite_url) {
            window.open(
                'mailto:' + invitees.join(',') +
                '?subject=' + encodeURIComponent('Bookly – Please vote: ' + title) +
                '&body=' + encodeURIComponent('Vote here: ' + window.location.origin + data.invite_url),
                '_self'
            );
        }

    } catch (error) {
        console.error('Create group meeting error:', error);
        showOwnerError('gmErrorNote', 'Server error.');
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
        console.error('Load owner group meetings error:', error);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="appt-table-empty">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

async function openFinalizeView(meetingID, title) {
    ownerSwitchTab('finalizeGMView');

    const finalizeIntro = document.getElementById('finalizeIntro');
    const finalizeTitle = document.getElementById('finalizeTitle');
    const list = document.getElementById('finalizeSlotList');
    const backBtn = document.getElementById('backToManageGMBtn');

    if (finalizeIntro) {
        finalizeIntro.textContent = 'Review vote counts for "' + title + '" and pick the best time.';
    }

    if (finalizeTitle) {
        finalizeTitle.textContent = title;
    }

    hideMsg('finalizeSuccessNote');
    hideMsg('finalizeErrorNote');

    if (!list) return;

    list.innerHTML = '<p class="slots-note">Loading vote results...</p>';

    try {
        const response = await fetch(`/api/type2/group_meeting?meetingID=${meetingID}`);
        const data = await response.json();

        if (!response.ok) {
            showOwnerError('finalizeErrorNote', data.error || 'Could not load vote results.');
            list.innerHTML = '';
            return;
        }

        const slots = data.availabilities || [];
        list.innerHTML = '';

        if (slots.length === 0) {
            list.innerHTML = '<p class="slots-note">No availability options found.</p>';
            return;
        }

        slots.forEach(function (slot) {
            const row = document.createElement('div');
            row.className = 'vote-slot-row';

            const lbl = document.createElement('div');
            lbl.className = 'vote-slot-label';
            lbl.innerHTML =
                '<span class="vote-slot-date">' + escapeHtml(slot.date) + '</span>' +
                '<span class="vote-slot-time">' + escapeHtml(slot.start_time) + ' – ' + escapeHtml(slot.end_time) + '</span>';

            const count = document.createElement('span');
            count.className = 'finalize-count';
            count.textContent = (slot.vote_count || 0) + ' vote(s)';

            const pickBtn = document.createElement('button');
            pickBtn.className = 'table-action vote';
            pickBtn.textContent = 'Pick this';

            if (slot.status !== 'open') {
                pickBtn.disabled = true;
                pickBtn.style.opacity = '0.45';
                pickBtn.style.cursor = 'not-allowed';
            } else {
                pickBtn.addEventListener('click', function () {
                    finalizeMeeting(meetingID, slot);
                });
            }

            row.appendChild(lbl);
            row.appendChild(count);
            row.appendChild(pickBtn);
            list.appendChild(row);
        });

        if (backBtn) {
            backBtn.onclick = function () {
                ownerSwitchTab('manageGMView');
            };
        }

    } catch (error) {
        console.error('Open finalize view error:', error);
        list.innerHTML = '';
        showOwnerError('finalizeErrorNote', 'Server error while loading vote results.');
    }
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
        console.error('Finalize meeting error:', error);
        showOwnerError('finalizeErrorNote', 'Server error while finalizing meeting.');
    }
}

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

        await loadOwnerGroupMeetings();

        if (typeof loadOwnerGroupBookings === 'function') {
            await loadOwnerGroupBookings();
        }

    } catch (error) {
        console.error('Cancel group meeting error:', error);
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

        await loadOwnerGroupMeetings();

        if (typeof loadOwnerGroupBookings === 'function') {
            await loadOwnerGroupBookings();
        }

    } catch (error) {
        console.error('Delete group meeting error:', error);
        showOwnerError('mgmErrorNote', 'Server error while removing group meeting.');
    }
}

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

            const actionHtml = status === 'cancelled'
                ? `
                    <button class="table-action danger" onclick="deleteGroupMeeting(${meeting.meetingID})">
                        Remove
                    </button>
                `
                : `
                    <button class="table-action danger" onclick="cancelGroupMeeting(${meeting.meetingID})">
                        Cancel
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
                <td>
                    <div class="table-actions">
                        ${actionHtml}
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Load owner group bookings error:', error);

        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="appt-table-empty">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}



// ========== Type 3 =================
function addOHSlotEntry() {
    const container = document.getElementById('ohSlotEntries');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'oh-slot-entry';

    entry.innerHTML =
        '<div class="oh-slot-row">' +
            '<div>' +
                '<label class="request-label">Day</label>' +
                '<select class="request-select oh-day">' +
                    '<option>Monday</option>' +
                    '<option>Tuesday</option>' +
                    '<option>Wednesday</option>' +
                    '<option>Thursday</option>' +
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
                '<button class="table-action danger" onclick="this.closest(\'.oh-slot-entry\').remove()" style="margin-bottom:12px;">✕</button>' +
            '</div>' +
        '</div>';

    container.appendChild(entry);
}

async function createOfficeHours() {
    const startDate = document.getElementById('ohStartDate').value;
    const weeks = parseInt(document.getElementById('ohWeeks').value, 10);

    if (!startDate || !weeks || weeks <= 0) {
        showOwnerError('ohErrorNote', 'Please fill in start date and number of weeks.');
        return;
    }

    const entries = document.querySelectorAll('.oh-slot-entry');

    if (entries.length === 0) {
        showOwnerError('ohErrorNote', 'Add at least one slot definition.');
        return;
    }

    const weeklySlots = [];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const day = entry.querySelector('.oh-day')?.value;
        const start = entry.querySelector('.oh-start')?.value;
        const end = entry.querySelector('.oh-end')?.value;

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


function renderOwnerSlots(slots) {
    const tbody = document.querySelector('#ownerSlotsTable tbody');
    if (!tbody) return;

    if (!slots || slots.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" class="appt-table-empty">No office-hours slots yet.</td></tr>';
        return;
    }

    tbody.innerHTML = slots.map(function (slot) {
        let bookedByHtml = '<span class="no-link">—</span>';

        if (slot.student_name && slot.student_email) {
            bookedByHtml =
                escapeHtml(slot.student_name) +
                ' <a class="table-link" href="mailto:' + encodeURIComponent(slot.student_email) + '">(email)</a>';
        }

        let actionsHtml = '';

        if (slot.status === 'Booked') {
            actionsHtml =
                '<div class="table-actions">' +
                    '<button class="table-action danger" onclick="deleteSlot(this, \'' + escapeForJs(slot.student_email || '') + '\')">Delete</button>' +
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

async function toggleSlotStatus(btn) {
    const row = btn.closest('tr');
    const slotId = row ? row.getAttribute('data-slot-id') : null;

    if (!slotId) {
        showOwnerError('slotsError', 'Could not identify slot.');
        return;
    }

    const isActivating = btn.textContent.trim() === 'Activate';

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

async function deleteSlot(btn, notifyEmail) {
    const row = btn.closest('tr');
    const slotID = row ? Number(row.children[0].textContent.trim()) : null;

    if (!slotID) {
        showOwnerError('slotsError', 'Could not identify slot.');
        return;
    }

    if (!confirm('Delete this slot?')) return;

    try {
        const response = await fetch('/api/type3/delete_slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slotID: slotID })
        });

        const data = await response.json();

        if (!response.ok) {
            showOwnerError('slotsError', data.error || 'Could not delete slot.');
            return;
        }

        hideMsg('slotsError');
        showOwnerMsg('slotsMsg', 'Slot deleted successfully.');
        await loadOwnerSlots();

        if (notifyEmail) {
            window.location.href =
                'mailto:' + notifyEmail +
                '?subject=' + encodeURIComponent('Bookly - Slot cancelled') +
                '&body=' + encodeURIComponent('Your booked slot has been cancelled by the owner.');
        }

    } catch (error) {
        console.error('Delete slot error:', error);
        showOwnerError('slotsError', 'Could not delete slot.');
    }
}


async function loadOwnerAppointments() {
    const ohBody = document.getElementById('ownerOHTableBody');
    if (!ohBody) return;

    ohBody.innerHTML = `
        <tr>
            <td colspan="7" class="appt-table-empty">Loading office hours bookings...</td>
        </tr>
    `;

    try {
        const response = await fetch('/api/type3/my_bookings');
        const data = await response.json();

        if (!response.ok) {
            ohBody.innerHTML = `
                <tr>
                    <td colspan="7" class="appt-table-empty">Error loading bookings.</td>
                </tr>
            `;
            return;
        }

        const bookings = data.bookings || [];

        if (bookings.length === 0) {
            ohBody.innerHTML = `
                <tr>
                    <td colspan="7" class="appt-table-empty">No office hours bookings.</td>
                </tr>
            `;
            return;
        }

        ohBody.innerHTML = '';

        bookings.forEach(function (booking) {
            const tr = document.createElement('tr');

            const zoomHtml = booking.zoom_link
                ? `<a class="table-link" href="${escapeHtml(booking.zoom_link)}" target="_blank">Join</a>`
                : '<span class="no-link">—</span>';

            tr.innerHTML = `
                <td>${escapeHtml(booking.slotID)}</td>
                <td>
                    ${escapeHtml(booking.student_name || '')}
                    <br>
                    <span class="no-link">${escapeHtml(booking.student_email || '')}</span>
                </td>
                <td>${escapeHtml(booking.start_date || '')}</td>
                <td>${escapeHtml(booking.start_time || '')}</td>
                <td>${escapeHtml(booking.end_time || '')}</td>
                <td>${zoomHtml}</td>
                <td>
                    <div class="table-actions">
                        <a class="table-action" href="mailto:${escapeHtml(booking.student_email || '')}">Email</a>
                        <button class="table-action danger" onclick="cancelOHBooking(${booking.booking3ID}, '${escapeForJs(booking.student_email || '')}')">
                            Cancel
                        </button>
                    </div>
                </td>
            `;

            ohBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Load owner appointments error:', error);

        ohBody.innerHTML = `
            <tr>
                <td colspan="7" class="appt-table-empty">Error loading bookings.</td>
            </tr>
        `;
    }
}

async function cancelOHBooking(bookingID, studentEmail) {
    if (!confirm('Cancel this booking?')) return;

    try {
        const response = await fetch('/api/type3/cancel_booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking3ID: bookingID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to cancel booking.');
            return;
        }

        await loadOwnerAppointments();

        if (studentEmail) {
            window.location.href =
                'mailto:' + studentEmail +
                '?subject=' + encodeURIComponent('Bookly - Booking cancelled') +
                '&body=' + encodeURIComponent('Your office hours booking has been cancelled.');
        }

    } catch (error) {
        console.error('Cancel office hours booking error:', error);
        alert('Server error while cancelling booking.');
    }
}


// ========== Page initialization ==========
async function initializeOwnerDashboard() {
    setupLogoutButton();
    setupNotificationPanelClose();

    await loadCurrentUser();
    await loadOwnerNotifications();

    setupOwnerSocket();

    ownerSwitchTab('ownerApptsView');

    await loadPendingRequests();
    await loadOwnerGroupMeetings();
    await loadOwnerSlots();
}

document.addEventListener('DOMContentLoaded', initializeOwnerDashboard);