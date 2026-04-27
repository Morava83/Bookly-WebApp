/* ═══════════════════════════════════════════
   TYPE 2: GROUP MEETING (OWNER)
   Compatible with ownerhomepage.js
   ═══════════════════════════════════════════ */

/* ─────────────────────────────
   CREATE SLOT ENTRY
   ───────────────────────────── */

function addGMSlotEntry() {
    const container = document.getElementById('gmSlotEntries');

    const entry = document.createElement('div');
    entry.className = 'gm-slot-entry';

    entry.innerHTML = `
        <div class="oh-slot-row">

            <div>
                <label class="request-label">Date</label>
                <input type="date" class="request-select gm-date">
            </div>

            <div>
                <label class="request-label">Start</label>
                <input type="time" class="request-select gm-start">
            </div>

            <div>
                <label class="request-label">End</label>
                <input type="time" class="request-select gm-end">
            </div>

            <div style="align-self:end;">
                <button class="table-action danger"
                        onclick="this.closest('.gm-slot-entry').remove()"
                        style="margin-bottom:12px;">✕</button>
            </div>

        </div>
    `;

    container.appendChild(entry);
}

/* ─────────────────────────────
   CREATE GROUP MEETING
   ───────────────────────────── */

async function createGroupMeeting() {
    try {
        const title = document.getElementById('gmTitle').value.trim();
        const description = document.getElementById('gmDesc').value.trim();

        const startDate = document.getElementById('gmStartDate').value;
        const endDate = document.getElementById('gmEndDate').value;

        if (!title) return showOwnerError('gmErrorNote', 'Please enter a meeting title.');
        if (!startDate || !endDate)
            return showOwnerError('gmErrorNote', 'Please select start and end dates.');
        if (startDate > endDate)
            return showOwnerError('gmErrorNote', 'Start date must be before end date.');

        const entries = document.querySelectorAll('.gm-slot-entry');

        if (!entries.length)
            return showOwnerError('gmErrorNote', 'Add at least one time slot.');

        const slots = [];

        entries.forEach(entry => {
            const date = entry.querySelector('.gm-date')?.value;
            const start_time = entry.querySelector('.gm-start')?.value;
            const end_time = entry.querySelector('.gm-end')?.value;

            if (!date || !start_time || !end_time) return;
            if (start_time >= end_time) return;

            slots.push({
                date,
                start_time,
                end_time
            });
        });

        if (!slots.length)
            return showOwnerError('gmErrorNote', 'Please fill valid slots.');

        const inviteText = document.getElementById('gmInvitees').value.trim();
        const invitees = inviteText
            ? inviteText.split('\n').map(e => e.trim()).filter(Boolean)
            : [];

        const payload = {
            title,
            description,
            start_date: startDate,
            end_date: endDate,
            slots,
            invitees
        };

        const result = await postJson('/group_meeting', payload);

        if (!result.response.ok) {
            return showOwnerError(
                'gmErrorNote',
                result.data.error || 'Failed to create meeting.'
            );
        }

        showOwnerMsg('gmSuccessNote', 'Group meeting created.');

        if (result.data.invite_url) {
            showOwnerMsg('gmSuccessNote', 'Invite: ' + result.data.invite_url);
        }

        return result.data;

    } catch (err) {
        console.error(err);
        showOwnerError('gmErrorNote', 'Server error.');
    }
}

/* ─────────────────────────────
   FINALIZE VIEW
   ───────────────────────────── */

async function openFinalizeView(meetingID, title) {
    ownerSwitchTab('finalizeGMView');

    document.getElementById('finalizeIntro').textContent =
        `Select final time for "${title}"`;

    document.getElementById('finalizeTitle').textContent = title;

    hideMsg('finalizeSuccessNote');
    hideMsg('finalizeErrorNote');

    try {
        const res = await fetch(`/group_meeting?meetingID=${meetingID}`);
        const data = await res.json();

        const slots = data.availabilities || [];

        const list = document.getElementById('finalizeSlotList');
        list.innerHTML = '';

        slots.forEach(slot => {
            const row = document.createElement('div');
            row.className = 'vote-slot-row';

            row.innerHTML = `
                <div class="vote-slot-label">
                    <span class="vote-slot-date">${slot.date}</span>
                    <span class="vote-slot-time">${slot.start_time} – ${slot.end_time}</span>
                </div>
                <span class="finalize-count">${slot.count} vote(s)</span>
            `;

            const btn = document.createElement('button');
            btn.className = 'table-action vote';
            btn.textContent = 'Pick this';

            btn.onclick = () => finalizeMeeting(meetingID, slot);

            row.appendChild(btn);
            list.appendChild(row);
        });

        document.getElementById('backToManageGMBtn').onclick = () => {
            ownerSwitchTab('manageGMView');
        };

    } catch (err) {
        console.error(err);
        showOwnerError('finalizeErrorNote', 'Could not load meeting.');
    }
}

/* ─────────────────────────────
   FINALIZE MEETING
   ───────────────────────────── */

async function finalizeMeeting(meetingID, slot) {
    const recurring = confirm('Make recurring meeting?');

    let weeks = 1;
    if (recurring) {
        const input = prompt('Number of weeks?', '5');
        weeks = parseInt(input) || 1;
    }

    const res = await postJson('/api/type2/finalize', {
        meetingID,
        slotID: slot.slotID,
        is_recurring: recurring,
        num_weeks: weeks
    });

    if (!res.response.ok) {
        return showOwnerError('finalizeErrorNote', 'Could not finalize meeting.');
    }

    showOwnerMsg(
        'finalizeSuccessNote',
        `Finalized for ${slot.date} ${slot.start_time}`
    );
}