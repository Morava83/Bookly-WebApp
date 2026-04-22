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

function view_appointments(){
    document.getElementsByClassName('make-appointment-tab-view')[0].style.display = 'none';
    document.getElementsByClassName('view-appointment-tab-view')[0].style.display = 'block';
}
function make_appointment(){
    document.getElementsByClassName('make-appointment-tab-view')[0].style.display = 'block';
    document.getElementsByClassName('view-appointment-tab-view')[0].style.display = 'none';
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
function buildSlotOptions() {
    var options = [];
    var minutes = [0, 15, 30, 45];
    for (var hour = 7; hour < 19; hour++) {
        for (var i = 0; i < minutes.length; i++) {
            options.push({
                value: padNumber(hour) + ':' + padNumber(minutes[i]),
                label: formatTime(hour, minutes[i])
            });
        }
    }
    return options;
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
        render: renderCalendar,
        getSelectedDate: function () { return selectedDate; },
        clearSelection: function () { selectedDate = null; renderCalendar(); }
    };
}

/* Booking calendar w/ backend integration */
(function () {
    var selectedSlot = null;
    var currentUser = null;
    var slotOptions = buildSlotOptions();
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
        },
        onNavigate: function () {
            selectedSlot = null;
            renderSlots();
            renderAvailability();
        }
    });

    renderSlots();
    renderAvailability();
    loadCurrentUser();
    loadOwners();
    setupSocket();

    logoutButton.addEventListener('click', async function(){
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                header: {
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


    bookButton.addEventListener('click', function () {
        clearMessages();

        if (!cal.getSelectedDate() || !selectedSlot) {
            showError('Please choose a date and a 15-minute time slot first.');
            return;
        }

        showSuccess('Selected slot: ' + formatSelectedSlot());
    });

    sendRequestButton.addEventListener('click', async function () {
        clearMessages();

        if (!cal.getSelectedDate() || !selectedSlot) {
            showError('Please choose a date and a 15-minute time slot first.');
            return;
        }

        if (!currentUser || !currentUser.email) {
            showError('You must be logged in.');
            return;
        }

        if (!ownerSelect.value) {
            showError('Please choose an owner.');
            return;
        }

        if (!meetingMessage.value.trim()) {
            showError('Please enter a request message.');
            return;
        }

        try {
            const response = await fetch('/api/type1/request_meeting', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    student_email: currentUser.email,
                    owner_email: ownerSelect.value,
                    message: meetingMessage.value.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showError(data.error || 'Could not create meeting request.');
                return;
            }

            showSuccess(
                'Successfully requested a meeting for ' +
                formatSelectedSlot() +
                '. Request ID: ' + data.meetingID
            );
        } catch (error) {
            console.error('Error:', error);
            showError('Could not connect to the server.');
        }
    });

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

            currentUserName.textContent = currentUser.name || 'Unknown';
            currentUserEmail.textContent = currentUser.email || 'Unknown';
            currentUserRole.textContent = currentUser.role || 'Unknown';
        } catch (error) {
            console.error('Error loading current user:', error);
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

    function renderSlots() {
        var d = cal.getSelectedDate();
        slotsGrid.innerHTML = '';
        clearMessages();

        if (!d) {
            slotsNote.textContent = 'Select a date from the calendar to view 15-minute booking times.';
            selectedSlotText.textContent = 'Choose a date and a 15-minute time slot.';
            bookArea.classList.remove('show');
            return;
        }

        slotsNote.textContent = 'Available 15-minute booking times for ' + formatDateOnly(d) + '.';

        for (var i = 0; i < slotOptions.length; i++) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot-button';
            btn.textContent = slotOptions[i].label;
            if (selectedSlot && selectedSlot.value === slotOptions[i].value) {
                btn.classList.add('selected');
            }
            (function (slot) {
                btn.addEventListener('click', function () {
                    selectedSlot = slot;
                    renderSlots();
                    renderAvailability();
                });
            })(slotOptions[i]);
            slotsGrid.appendChild(btn);
        }

        if (selectedSlot) {
            selectedSlotText.textContent = formatSelectedSlot();
            bookArea.classList.add('show');
        } else {
            selectedSlotText.textContent = formatDateOnly(d) + ' selected. Choose a 15-minute time slot.';
            bookArea.classList.remove('show');
        }
    }

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
        return formatDateOnly(cal.getSelectedDate()) + ' at ' + selectedSlot.label;
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