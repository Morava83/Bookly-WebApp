var ownerSlots = [];
/*Function for opening timeslot selection for group meetings:*/
function open_vote_view(meetingID, title, ownerName) {
    document.getElementsByClassName('make-appointment-tab-view')[0].style.display = 'none';
    document.getElementsByClassName('view-appointment-tab-view')[0].style.display = 'none';
    document.getElementsByClassName('vote-meeting-tab-view')[0].style.display = 'block';
    document.getElementsByClassName('right-panel')[0].style.display = 'none';

    document.getElementById('voteIntro').textContent =
        'Voting on "' + title + '" by ' + ownerName + '.';
    document.getElementById('voteSelectionText').textContent =
        'Check the time slots that work for you.';
    document.getElementById('voteSuccessNote').classList.remove('show');
    document.getElementById('voteErrorNote').classList.remove('show');

    // TODO: replace with real fetch from /api/type2/meeting/<meetingID>
    var dummySlots = [
        { slotID: 1, date: '2026-04-28', start_time: '13:00', end_time: '14:00' },
        { slotID: 2, date: '2026-04-28', start_time: '15:00', end_time: '16:00' },
        { slotID: 3, date: '2026-04-29', start_time: '10:00', end_time: '11:00' },
        { slotID: 4, date: '2026-04-30', start_time: '14:00', end_time: '15:00' }
    ];

    var list = document.getElementById('voteSlotList');
    var selectionText = document.getElementById('voteSelectionText');
    list.innerHTML = '';

    dummySlots.forEach(function (slot) {
        var row = document.createElement('div');
        row.className = 'vote-slot-row';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = slot.slotID;
        cb.id = 'vote-slot-' + slot.slotID;

        var lbl = document.createElement('label');
        lbl.className = 'vote-slot-label';
        lbl.htmlFor = cb.id;
        lbl.innerHTML =
            '<span class="vote-slot-date">' + slot.date + '</span>' +
            '<span class="vote-slot-time">' + slot.start_time + ' – ' + slot.end_time + '</span>';

        cb.addEventListener('change', function () {
            row.classList.toggle('checked', cb.checked);
            updateVoteCount();
        });

        row.addEventListener('click', function (e) {
            if (e.target !== cb) {
                cb.checked = !cb.checked;
                row.classList.toggle('checked', cb.checked);
                updateVoteCount();
            }
        });

        row.appendChild(cb);
        row.appendChild(lbl);
        list.appendChild(row);
    });

    function updateVoteCount() {
        var count = list.querySelectorAll('input[type=checkbox]:checked').length;
        if (count === 0) {
            selectionText.textContent = 'Check the time slots that work for you.';
        } else {
            selectionText.textContent = count + ' slot(s) selected.';
        }
    }

    document.getElementById('submitVoteBtn').onclick = function () {
        var checked = list.querySelectorAll('input[type=checkbox]:checked');
        var ids = [];
        checked.forEach(function (cb) { ids.push(parseInt(cb.value)); });

        if (ids.length === 0) {
            document.getElementById('voteErrorNote').textContent = 'Select at least one slot.';
            document.getElementById('voteErrorNote').classList.add('show');
            return;
        }

        // TODO: replace with real fetch to /api/type2/submit_availability
        document.getElementById('voteErrorNote').classList.remove('show');
        document.getElementById('voteSuccessNote').textContent =
            'Submitted ' + ids.length + ' slot(s) successfully.';
        document.getElementById('voteSuccessNote').classList.add('show');
    };

    document.getElementById('backToApptsBtn').onclick = function () {
        document.getElementsByClassName('right-panel')[0].style.display = 'block';
        view_appointments();
    };
}

/* Professor search bar — currently uses dummy data */
function initProfSearch() {
    var selectedOwner = null;
    var searchTimer = null;

    var profSearch = document.getElementById('profSearch');
    var profDropdown = document.getElementById('profDropdown');
    var profBanner = document.getElementById('profBanner');
    var profBannerText = document.getElementById('profBannerText');
    var profClear = document.getElementById('profClear');

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
    

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

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

document.addEventListener("DOMContentLoaded", async function () {
    if (typeof loadType1Meetings === "function") {
        await loadType1Meetings();
    }

    if (typeof loadType2Meetings === "function") {
        await loadType2Meetings();
    }

    if (typeof loadType3Bookings === "function") {
        await loadType3Bookings();
    }
});

function view_appointments(){
    document.getElementsByClassName('make-appointment-tab-view')[0].style.display = 'none';
    document.getElementsByClassName('view-appointment-tab-view')[0].style.display = 'block';
    document.getElementsByClassName('vote-meeting-tab-view')[0].style.display = 'none';

    if (typeof loadType1Meetings === 'function') {
        loadType1Meetings();
    }
    if (typeof loadType3Meetings === 'function') {
        loadType3Meetings();
    }
}
function make_appointment(){
    document.getElementsByClassName('make-appointment-tab-view')[0].style.display = 'block';
    document.getElementsByClassName('view-appointment-tab-view')[0].style.display = 'none';
    document.getElementsByClassName('vote-meeting-tab-view')[0].style.display = 'none';
}

/* Helpers */
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
function formatTime(hour, minute) {
    var suffix = hour >= 12 ? 'PM' : 'AM';
    var displayHour = hour % 12;
    if (displayHour === 0) displayHour = 12;
    return displayHour + ':' + padNumber(minute) + ' ' + suffix;
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
        render: renderCalendar,
        getSelectedDate: function () { return selectedDate; },
        clearSelection: function () { selectedDate = null; renderCalendar(); }
    };
}

/* Booking calendar w/ backend integration */
(function () {
    var selectedSlot = null;
    var currentUser = null;
    var logoutButton = document.getElementById('logoutButton');

    var slotsGrid = document.getElementById('slotsGrid');
    var slotsNote = document.getElementById('slotsNote');
    var selectedSlotText = document.getElementById('selectedSlotText');
    var availabilityIntro = document.getElementById('availabilityIntro');
    var availabilityCard = document.getElementById('availabilityCard');
    var availabilitySlotText = document.getElementById('availabilitySlotText');
    var bookArea = document.getElementById('bookArea');
    var bookButton = document.getElementById('bookButton');
    var sendRequestButton = document.getElementById('sendRequestButton');
    var bookingNote = document.getElementById('bookingNote');
    var errorNote = document.getElementById('errorNote');
    var ownerSelect = document.getElementById('ownerSelect');
    var meetingMessage = document.getElementById('meetingMessage');

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
        ownerSlots = ownerSlots.filter(function (s) { return s.slotID !== bookedID; });

        // Refresh slots so the booked one disappears
        var owner = window.getSelectedOwner();
        if (owner) {

            showSuccess('Booked slot: ' + formatSelectedSlot() + '. Wait for the popup window  to send a notification email.');

            window.location.href = 'mailto:' + owner.email +
                '?subject=' + encodeURIComponent('Bookly - New office hour booking') +
                '&body=' + encodeURIComponent('Hello,\n\nI have made a new office hour booking. You can find it on your dashboard.\n\nKind regards,');
        }
    } catch (err) {
        console.error('Booking error:', err);
        showError('Could not connect to the server.');
    }
    });

    // Handled in type1.js
    // sendRequestButton.addEventListener('click', async function () {
    //     clearMessages();

    //     if (!cal.getSelectedDate() || !selectedSlot) {
    //         showError('Please choose a date and a 15-minute time slot first.');
    //         return;
    //     }

    //     if (!currentUser || !currentUser.email) {
    //         showError('You must be logged in.');
    //         return;
    //     }

    //     if (!ownerSelect.value) {
    //         showError('Please choose an owner.');
    //         return;
    //     }

    //     if (!meetingMessage.value.trim()) {
    //         showError('Please enter a request message.');
    //         return;
    //     }

    //     try {
    //         const response = await fetch('/api/type1/request_meeting', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({
    //                 student_email: currentUser.email,
    //                 owner_email: ownerSelect.value,
    //                 message: meetingMessage.value.trim()
    //             })
    //         });

    //         const data = await response.json();

    //         if (!response.ok) {
    //             showError(data.error || 'Could not create meeting request.');
    //             return;
    //         }

    //         showSuccess(
    //             'Successfully requested a meeting for ' +
    //             formatSelectedSlot() +
    //             '. Request ID: ' + data.meetingID
    //         );
    //     } catch (error) {
    //         console.error('Error:', error);
    //         showError('Could not connect to the server.');
    //     }
    // });

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

            socket.on('notification', function (data) {
                if (data && data.message) {
                    showSuccess(data.message);
                }
            });
        } catch (error) {
            console.error('Socket setup error:', error);
        }
    }

    function formatTimeStr(timeStr) {
        var parts = timeStr.split(':');
        var h = parseInt(parts[0], 10);
        var m = parts[1];
        var suffix = h >= 12 ? 'PM' : 'AM';
        var displayH = h % 12;
        if (displayH === 0) displayH = 12;
        return displayH + ':' + m + ' ' + suffix;
    }

    function renderSlots() {
        var d = cal.getSelectedDate();
        slotsGrid.innerHTML = '';
        clearMessages();

        if (ownerSlots.length === 0) {
            slotsNote.textContent = 'Search for a professor above to see their available slots.';
            selectedSlotText.textContent = 'Choose a professor, then a date and time slot.';
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