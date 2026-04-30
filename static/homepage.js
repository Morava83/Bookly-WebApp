// ------- User booking page --------- //
// Contributer: 
// Brian Morava - 261032388 
// Omer Ege Ozyaba - 261069925
// Hoi Kin Chiu - 261142005
// Enoch Chan - 261160969




var ownerSlots = [];

/* Professor search bar — Searches owners from the backend */
function initProfSearch() {
    var selectedOwner = null;
    var searchTimer = null;

    var profSearch = document.getElementById('profSearch');
    var profDropdown = document.getElementById('profDropdown');
    var profBanner = document.getElementById('profBanner');
    var profBannerText = document.getElementById('profBannerText');
    var profClear = document.getElementById('profClear');

    if (!profSearch || !profDropdown || !profBanner || !profBannerText || !profClear) {
        return;
    }

    window.getSelectedOwner = function () { return selectedOwner; };

    profSearch.addEventListener('input', function () {
        var q = profSearch.value.trim();
        if (q.length < 1) {
            profDropdown.classList.remove('open');
            return;
        }
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            searchOwners(q);
        }, 250);
    });

    profSearch.addEventListener('focus', function () {
        if (profSearch.value.trim().length >= 1) {
            searchOwners(profSearch.value.trim());
        }
    });

    document.addEventListener('click', function (e) {
        if (!profSearch.contains(e.target) && !profDropdown.contains(e.target)) {
            profDropdown.classList.remove('open');
        }
    });

    profClear.addEventListener('click', function () {
        selectedOwner = null;
        profSearch.value = '';
        profBanner.style.display = 'none';
        ownerSlots = [];
        window.renderSlots();
    });

    async function searchOwners(query) {
        var res = await fetch('/api/owners/search?q=' + encodeURIComponent(query));
        var data = await res.json();
        var results = data.owners || [];

        profDropdown.innerHTML = '';

        if (results.length === 0) {
            profDropdown.innerHTML = '<div class="search-dropdown-empty">No professors found.</div>';
            profDropdown.classList.add('open');
            return;
        }

        results.forEach(function (owner) {
            var item = document.createElement('div');
            item.className = 'search-dropdown-item';
            item.innerHTML =
                '<div class="search-name">' + owner.name + '</div>' +
                '<div class="search-email">' + owner.email + '</div>';
            item.addEventListener('click', function () {
                selectOwner(owner);
            });
            profDropdown.appendChild(item);
        });

        profDropdown.classList.add('open');
    }

    async function selectOwner(owner) {
        selectedOwner = owner;
        profDropdown.classList.remove('open');
        profSearch.value = '';
        profBanner.style.display = 'flex';
        profBannerText.textContent = owner.name + ' (' + owner.email + ')';

        // fetch owner's slots
        var res = await fetch('/api/type3/available_slots?owner_id=' + owner.userID);
        var data = await res.json();
        ownerSlots = data.slots || [];

        // render slot grid
        window.renderSlots();
    }
}

/* Load all available slots from searched owner */
async function loadAvailableSlots() {
    var ownerID = window.BOOKLY_INVITE_OWNER_ID;

    if (!ownerID) {
        return;
    }

    var profSearch = document.getElementById("profSearch");
    var profDropdown = document.getElementById("profDropdown");
    var profBanner = document.getElementById("profBanner");
    var profBannerText = document.getElementById("profBannerText");
    var profClear = document.getElementById("profClear");
    var slotsNote = document.getElementById("slotsNote");
    var selectedSlotText = document.getElementById("selectedSlotText");

    try {
        var selectedOwner = null;

        try {
            var ownersRes = await fetch("/api/owners");
            var ownersData = await ownersRes.json();

            if (ownersRes.ok) {
                var owners = ownersData.owners || [];
                selectedOwner = owners.find(function (owner) {
                    return String(owner.userID) === String(ownerID);
                }) || null;
            }
        } catch (ownerError) {
            console.error("Could not load invited owner details:", ownerError);
        }

        var res = await fetch("/api/type3/available_slots?owner_id=" + encodeURIComponent(ownerID));
        var data = await res.json();

        if (!res.ok) {
            console.error(data.error || "Could not load invitation slots.");

            if (slotsNote) {
                slotsNote.textContent = data.error || "Could not load this owner's available slots.";
            }

            if (selectedSlotText) {
                selectedSlotText.textContent = "Please try again later.";
            }

            ownerSlots = [];

            if (typeof window.renderSlots === "function") {
                window.renderSlots();
            }

            return;
        }

        ownerSlots = data.slots || [];

        if (!selectedOwner && ownerSlots.length > 0) {
            selectedOwner = {
                userID: ownerSlots[0].ownerID,
                name: ownerSlots[0].owner_name,
                email: ownerSlots[0].owner_email
            };
        }

        window.getSelectedOwner = function () {
            return selectedOwner;
        };

        if (profSearch) {
            profSearch.value = "";
            profSearch.style.display = "none";
        }

        if (profDropdown) {
            profDropdown.classList.remove("open");
            profDropdown.innerHTML = "";
        }

        if (profClear) {
            profClear.style.display = "none";
        }

        if (profBanner && profBannerText) {
            profBanner.style.display = "flex";
            profBannerText.textContent = selectedOwner
                ? selectedOwner.name + " (" + selectedOwner.email + ")"
                : "Invited owner";
        }

        if (slotsNote) {
            slotsNote.textContent = "Select a date from the calendar to see this owner's activated slots.";
        }

        if (typeof window.renderSlots === "function") {
            window.renderSlots();
        }

    } catch (error) {
        console.error("Invitation slot load error:", error);

        ownerSlots = [];

        if (slotsNote) {
            slotsNote.textContent = "Could not connect to the server to load this owner's slots.";
        }

        if (selectedSlotText) {
            selectedSlotText.textContent = "Please try again later.";
        }
    }
}

window.loadAvailableSlots = loadAvailableSlots;

/* Viewing all user related appointments */
async function view_appointments() {
    const makeView = document.querySelector('.make-appointment-tab-view');
    const appointmentView = document.querySelector('.view-appointment-tab-view');
    const voteView = document.getElementById('voteMeetingView');

    if (makeView) {
        makeView.style.display = 'none';
    }

    if (voteView) {
        voteView.style.display = 'none';
    }

    if (appointmentView) {
        appointmentView.style.display = 'block';
    }

    if (typeof loadType1Meetings === 'function') {
        await loadType1Meetings();
    }

    if (typeof loadAllStudentGroupRows === 'function') {
        await loadAllStudentGroupRows();
    }

    if (typeof loadType3Meetings === 'function') {
        await loadType3Meetings();
    }
}

/* Make appointment */
function make_appointment() {
    var makeView = document.getElementsByClassName('make-appointment-tab-view')[0];
    var appointmentView = document.getElementsByClassName('view-appointment-tab-view')[0];
    var voteView = document.getElementById('voteMeetingView');

    if (makeView) {
        makeView.style.display = 'block';
    }

    if (appointmentView) {
        appointmentView.style.display = 'none';
    }

    if (voteView) {
        voteView.style.display = 'none';
    }
}

/* Notifications */

async function toggleNotifications(e) {
    e.stopPropagation();

    var panel = document.getElementById('notifPanel');

    if (!panel) {
        return;
    }

    panel.classList.toggle('open');

    if (panel.classList.contains('open')) {
        await loadNotifications();
        await markNotificationsRead();
    }
}

async function loadNotifications() {
    var notifList = document.getElementById('notifList');
    var notifCount = document.getElementById('notifCount');

    if (!notifList || !notifCount) {
        return;
    }

    try {
        var res = await fetch('/api/notifications');
        var data = await res.json();

        if (!res.ok) {
            console.error(data.error || 'Could not load notifications.');
            return;
        }

        var notifications = data.notifications || [];
        var unreadCount = data.unread_count || 0;

        notifCount.textContent = unreadCount > 0 ? String(unreadCount) : '';

        notifList.innerHTML = '';

        if (notifications.length === 0) {
            notifList.innerHTML =
                '<div class="notif-item">' +
                    '<div class="notif-text">No notifications yet.</div>' +
                '</div>';
            return;
        }

        notifications.forEach(function (n) {
            var item = document.createElement('div');
            item.className = 'notif-item' + (n.is_read ? '' : ' unread');

            item.innerHTML =
                '<div class="notif-text">' + escapeHtml(n.message) + '</div>' +
                '<div class="notif-time">' + formatNotificationTime(n.created_at) + '</div>';

            notifList.appendChild(item);
        });

    } catch (error) {
        console.error('Notification load error:', error);
    }
}

async function markNotificationsRead() {
    var notifCount = document.getElementById('notifCount');

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

        var unreadItems = document.querySelectorAll('.notif-item.unread');
        unreadItems.forEach(function (item) {
            item.classList.remove('unread');
        });

    } catch (error) {
        console.error('Could not mark notifications as read:', error);
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNotificationTime(value) {
    if (!value) {
        return '';
    }

    var date = new Date(value.replace(' ', 'T'));
    if (isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}



/* Reusable calendar factory
    Pass element IDs + optional callbacks */
function createCalendar(opts) {
    var monthOffset = 0;
    var selectedDate = null;

    var monthTitle = document.getElementById(opts.monthTitleId);
    var calendarHeader = document.getElementById(opts.calendarHeaderId);
    var calendarGrid = document.getElementById(opts.calendarGridId);
    var prevBtn = document.getElementById(opts.prevBtnId);
    var nextBtn = document.getElementById(opts.nextBtnId);
    var onDateClick = opts.onDateClick || null;

    renderWeekdays();
    renderCalendar();

    prevBtn.addEventListener('click', function () {
        if (monthOffset === 0) return;
        monthOffset -= 1;
        selectedDate = null;
        renderCalendar();
        if (opts.onNavigate) opts.onNavigate();
    });

    nextBtn.addEventListener('click', function () {
        if (monthOffset === 11) return;
        monthOffset += 1;
        selectedDate = null;
        renderCalendar();
        if (opts.onNavigate) opts.onNavigate();
    });

    function renderWeekdays() {
        calendarHeader.innerHTML = '';
        for (var i = 0; i < weekdayNames.length; i++) {
            var el = document.createElement('div');
            el.className = 'weekday';
            el.textContent = weekdayNames[i];
            calendarHeader.appendChild(el);
        }
    }

    function renderCalendar() {
        var visibleMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
        var year = visibleMonth.getFullYear();
        var month = visibleMonth.getMonth();
        var firstDayIndex = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();

        monthTitle.textContent = monthNames[month] + ' ' + year;
        calendarGrid.innerHTML = '';
        prevBtn.disabled = monthOffset === 0;
        nextBtn.disabled = monthOffset === 11;

        for (var blank = 0; blank < firstDayIndex; blank++) {
            var blankDay = document.createElement('div');
            blankDay.className = 'blank-day';
            calendarGrid.appendChild(blankDay);
        }

        for (var day = 1; day <= daysInMonth; day++) {
            var date = new Date(year, month, day);
            var isPastDate = date < startOfToday;
            var button = document.createElement('button');
            var dayNumber = document.createElement('span');
            var dayText = document.createElement('span');

            button.type = 'button';
            button.className = 'day-button';
            button.disabled = isPastDate;

            if (selectedDate && isSameDate(date, selectedDate)) {
                button.classList.add('selected');
            }

            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayText.className = 'day-text';
            dayText.textContent = isPastDate ? 'Unavailable' : 'Select day';

            button.appendChild(dayNumber);
            button.appendChild(dayText);

            if (!isPastDate && onDateClick) {
                (function (d) {
                    button.addEventListener('click', function () {
                        selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        renderCalendar();
                        onDateClick(selectedDate);
                    });
                })(date);
            }

            calendarGrid.appendChild(button);
        }
    }

    return {
        getSelectedDate: function () { return selectedDate; }
    };
}

/* Booking calendar w/ backend integration */
(function () {
    var selectedSlot = null;
    var currentUser = null;
    var logoutButton = document.getElementById('logoutButton');

    var slotsGrid = document.getElementById('slotsGrid');
    if (!slotsGrid) {
        console.error('Missing #slotsGrid element. Time slot buttons cannot be displayed.');
    }

    var slotsNote = document.getElementById('slotsNote');
    var selectedSlotText = document.getElementById('selectedSlotText');
    var availabilityIntro = document.getElementById('availabilityIntro');
    var availabilityCard = document.getElementById('availabilityCard');
    var availabilitySlotText = document.getElementById('availabilitySlotText');
    var bookArea = document.getElementById('bookArea');
    var bookButton = document.getElementById('bookButton');
    var bookingNote = document.getElementById('bookingNote');
    var errorNote = document.getElementById('errorNote');
    var ownerSelect = document.getElementById('ownerSelect');

    var currentUserName = document.getElementById('currentUserName');
    var currentUserEmail = document.getElementById('currentUserEmail');
    var currentUserRole = document.getElementById('currentUserRole');

    var cal = createCalendar({
        monthTitleId: 'monthTitle',
        calendarHeaderId: 'calendarHeader',
        calendarGridId: 'calendarGrid',
        prevBtnId: 'prevMonthButton',
        nextBtnId: 'nextMonthButton',
        onDateClick: function () {
            selectedSlot = null;
            renderSlots();
            renderAvailability();
            syncSharedBookingState();
        },
        onNavigate: function () {
            selectedSlot = null;
            renderSlots();
            renderAvailability();
            syncSharedBookingState();
        }
    });

    function syncSharedBookingState() {
        window.selectedDate = cal.getSelectedDate();
        window.selectedSlotValue = selectedSlot ? selectedSlot.value : null;
    }

    renderSlots();
    renderAvailability();
    syncSharedBookingState();
    loadCurrentUser();
    loadOwners();
    setupSocket();

    logoutButton.addEventListener('click', async function(){
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                showError(data.error || 'Could not log out.');
                return;
            }

            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            showError('Could not log out.')
        }
    });


    bookButton.addEventListener('click', async function () {
        clearMessages();

        if (!cal.getSelectedDate() || !selectedSlot) {
            showError('Please choose a date and a time slot first.');
            return;
        }

        try {
            var res = await fetch('/api/type3/book_slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slotID: selectedSlot.slotID })
            });

            var data = await res.json();

            if (!res.ok) {
                showError(data.error || 'Could not book the slot.');
                return;
            }

            var bookedID = selectedSlot.slotID;
            var bookedSlotText = formatSelectedSlot();

            ownerSlots = ownerSlots.filter(function (s) {
                return s.slotID !== bookedID;
            });

            selectedSlot = null;
            renderSlots();
            renderAvailability();
            syncSharedBookingState();

            var owner = window.getSelectedOwner();

            if (owner) {
                showSuccess('Booked slot: ' + bookedSlotText + '. Wait for the popup window to send a notification email.');

                window.location.href = 'mailto:' + owner.email +
                    '?subject=' + encodeURIComponent('Bookly - New office hour booking') +
                    '&body=' + encodeURIComponent('Hello,\n\nI have made a new office hour booking. You can find it on your dashboard.\n\nKind regards,');
            } else {
                showSuccess('Booked slot: ' + bookedSlotText + '.');
            }

        } catch (err) {
            console.error('Booking error:', err);
            showError('Could not connect to the server.');
        }
    });

    async function loadCurrentUser() {
        try {
            const response = await fetch('/api/me', {
                method: 'GET',
                credentials: 'same-origin'
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('/api/me failed:', response.status, data);

                currentUserName.textContent = 'Unavailable';
                currentUserEmail.textContent = 'Unavailable';
                currentUserRole.textContent = 'Unavailable';
                return;
            }

            currentUser = {
                userID: data.userID,
                email: data.email,
                name: data.name,
                role: data.role
            };

            window.currentUser = currentUser;

            currentUserName.textContent = currentUser.name || 'Unknown';
            currentUserEmail.textContent = currentUser.email || 'Unknown';
            currentUserRole.textContent = currentUser.role || 'Unknown';

            var ownerHomeButton = document.getElementById('ownerHomeButton');
            if (ownerHomeButton && currentUser.role === 'owner') {
                ownerHomeButton.style.display = 'block';
            }

        } catch (error) {
            console.error('Error loading current user:', error);

            window.currentUser = null;
            currentUserName.textContent = 'Unavailable';
            currentUserEmail.textContent = 'Unavailable';
            currentUserRole.textContent = 'Unavailable';
        }
    }

    async function loadOwners() {
        try {
            const response = await fetch('/api/owners');
            const data = await response.json();

            if (!response.ok) {
                showError(data.error || 'Could not load owners.');
                return;
            }

            ownerSelect.innerHTML = '<option value="">Choose an owner</option>';

            data.owners.forEach(function (owner) {
                var option = document.createElement('option');
                option.value = owner.email;
                option.textContent = owner.name + ' (' + owner.email + ')';
                ownerSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading owners:', error);
            showError('Could not load owner list.');
        }
    }

    function setupSocket() {
        try {
            const socket = io();

            socket.on('notification', async function (data) {
                if (data && data.message) {
                    showSuccess(data.message);
                }

                if (typeof loadNotifications === 'function') {
                    await loadNotifications();
                }
            });
        } catch (error) {
            console.error('Socket setup error:', error);
        }
    }
    
    function renderSlots() {
        var d = cal.getSelectedDate();
        slotsGrid.innerHTML = '';
        clearMessages();

        if (ownerSlots.length === 0) {
            if (window.BOOKLY_INVITE_OWNER_ID) {
                slotsNote.textContent = 'This owner does not have any activated office-hour slots right now.';
                selectedSlotText.textContent = 'No available slots for this invitation link.';
            } else {
                slotsNote.textContent = 'Search for a professor above to see their available slots.';
                selectedSlotText.textContent = 'Choose a professor, then a date and time slot.';
            }
            bookArea.classList.remove('show');
            return;
        }

        if (!d) {
            slotsNote.textContent = 'Select a date from the calendar to see available slots.';
            selectedSlotText.textContent = 'Pick a date from the calendar.';
            bookArea.classList.remove('show');
            return;
        }

        var dateStr = d.getFullYear() + '-' + padNumber(d.getMonth() + 1) + '-' + padNumber(d.getDate());
        var daySlots = ownerSlots.filter(function (s) { return s.date === dateStr; });

        if (daySlots.length === 0) {
            slotsNote.textContent = 'No available slots on ' + formatDateOnly(d) + '.';
            selectedSlotText.textContent = 'Try another date.';
            bookArea.classList.remove('show');
            return;
        }

        slotsNote.textContent = daySlots.length + ' slot(s) available on ' + formatDateOnly(d) + '.';

        daySlots.forEach(function (slot) {
            var btn = document.createElement('button');

            btn.type = 'button';
            btn.className = 'slot-button';
            btn.textContent = formatTimeStr(slot.start_time) + ' – ' + formatTimeStr(slot.end_time);

            if (selectedSlot && selectedSlot.slotID === slot.slotID) {
                btn.classList.add('selected');
            }

            btn.addEventListener('click', function () {
                selectedSlot = slot;
                renderSlots();
                renderAvailability();
                syncSharedBookingState();
            });

            slotsGrid.appendChild(btn);
        });

        if (selectedSlot) {
            selectedSlotText.textContent = formatSelectedSlot();
            bookArea.classList.add('show');
        } else {
            selectedSlotText.textContent = formatDateOnly(d) + ' — pick a time slot.';
            bookArea.classList.remove('show');
        }
    }

    window.renderSlots = renderSlots;

    function renderAvailability() {
        var d = cal.getSelectedDate();
        if (!d || !selectedSlot) {
            availabilityIntro.style.display = 'block';
            availabilityCard.classList.remove('show');
            availabilitySlotText.textContent = '';
            return;
        }
        availabilityIntro.style.display = 'none';
        availabilitySlotText.textContent = formatSelectedSlot();
        availabilityCard.classList.add('show');
    }

    function formatSelectedSlot() {
        return formatDateOnly(cal.getSelectedDate()) + ' at ' +
            formatTimeStr(selectedSlot.start_time) + ' – ' + formatTimeStr(selectedSlot.end_time);
    }

    function clearMessages() {
        bookingNote.classList.remove('show');
        bookingNote.textContent = '';
        errorNote.classList.remove('show');
        errorNote.textContent = '';
    }

    function showSuccess(message) {
        bookingNote.textContent = message;
        bookingNote.classList.add('show');
        errorNote.classList.remove('show');
        errorNote.textContent = '';
    }

    function showError(message) {
        errorNote.textContent = message;
        errorNote.classList.add('show');
        bookingNote.classList.remove('show');
        bookingNote.textContent = '';
    }
})();

/* ======= Helpers ===========*/
var monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
var weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var today = new Date();
var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

function padNumber(value) {
    return value < 10 ? '0' + value : String(value);
}

function formatTimeStr(timeStr) {
    if (!timeStr) {
        return '';
    }

    var parts = timeStr.split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parts[1] || '00';

    var suffix = hour >= 12 ? 'PM' : 'AM';
    var displayHour = hour % 12;

    if (displayHour === 0) {
        displayHour = 12;
    }

    return displayHour + ':' + minute + ' ' + suffix;
}

function formatDateOnly(date) {
    return weekdayNames[date.getDay()] + ', ' + monthNames[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}
function isSameDate(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateForApi(dateObj) {
    var year = dateObj.getFullYear();
    var month = String(dateObj.getMonth() + 1).padStart(2, '0');
    var day = String(dateObj.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function calculateEndTime(startTime) {
    var parts = startTime.split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parseInt(parts[1], 10);

    minute += 15;
    if (minute >= 60) {
        hour += 1;
        minute -= 60;
    }

    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

window.formatDateForApi = formatDateForApi;
window.calculateEndTime = calculateEndTime;
window.formatTimeStr = formatTimeStr;

document.addEventListener('click', function (e) {
    var panel = document.getElementById('notifPanel');

    if (!panel) {
        return;
    }

    if (!panel.contains(e.target)) {
        panel.classList.remove('open');
    }
});


async function loadInitialAppointmentData() {
    if (typeof loadType1Meetings === 'function') {
        await loadType1Meetings();
    }

    if (typeof loadType2Meetings === 'function') {
        await loadType2Meetings();
    }

    if (typeof loadType3Bookings === 'function') {
        await loadType3Bookings();
    }

    if (typeof loadNotifications === 'function') {
        await loadNotifications();
    }
}

async function loadInviteOwnerContext() {
    if (!window.BOOKLY_INVITE_OWNER_ID) {
        return;
    }

    if (typeof make_appointment === 'function') {
        make_appointment();
    }

    if (typeof loadAvailableSlots === 'function') {
        await loadAvailableSlots();
    }

    var intro = document.getElementById('availabilityIntro');
    if (intro) {
        intro.textContent = 'You are viewing activated office-hour slots for this owner.';
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    await loadInitialAppointmentData();
    await loadInviteOwnerContext();
});