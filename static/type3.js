async function loadType3Meetings() {
    const table = document.getElementById('officeHoursTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="appt-table-empty">Loading office hours...</td>
        </tr>
    `;

    try {
        const response = await fetch('/api/type3/my_bookings');
        const data = await response.json();

        if (!response.ok) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="appt-table-empty">Could not load office hours.</td>
                </tr>
            `;
            return;
        }

        renderType3Meetings(data.bookings || []);
    } catch (error) {
        console.error('Type3 meetings load error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="appt-table-empty">Could not load office hours.</td>
            </tr>
        `;
    }
}

function renderType3Meetings(bookings) {
    const table = document.getElementById('officeHoursTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="appt-table-empty">No office hours booked yet.</td>
            </tr>
        `;
        return;
    }

    bookings.forEach(function (booking) {
        const ownerName = booking.owner_name || booking.student_name || '-';
        const ownerEmail = booking.owner_email || booking.student_email || '';
        const zoomCell = booking.zoom_link
            ? `<a class="table-link" href="${booking.zoom_link}" target="_blank" rel="noopener noreferrer">Join</a>`
            : `<span class="no-link">—</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${booking.slotID}</td>
            <td>${ownerName}</td>
            <td>${booking.start_date}</td>
            <td>${booking.start_time}</td>
            <td>${booking.end_time}</td>
            <td>${zoomCell}</td>
            <td><span class="status-badge booked">Booked</span></td>
            <td>
                <div class="table-actions">
                    ${ownerEmail ? `<a class="table-action" href="mailto:${ownerEmail}">Email</a>` : ''}
                    <button class="table-action danger" type="button" data-booking-id="${booking.booking3ID}">Cancel</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    bindType3CancelButtons();
}

function bindType3CancelButtons() {
    const buttons = document.querySelectorAll('#officeHoursTable .table-action.danger[data-booking-id]');
    buttons.forEach(function (button) {
        button.addEventListener('click', async function () {
            const booking3ID = this.getAttribute('data-booking-id');
            await cancelType3Booking(booking3ID);
        });
    });
}

async function cancelType3Booking(booking3ID) {
    try {
        const response = await fetch('/api/type3/cancel_booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ booking3ID: booking3ID })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Could not cancel office hours booking.');
            return;
        }

        await loadType3Meetings();
    } catch (error) {
        console.error('Type3 cancel error:', error);
        alert('Could not cancel office hours booking.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Load on page load only if the appointments view is already visible
});