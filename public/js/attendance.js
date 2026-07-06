/**
 * attendance.js — RFID Kiosk / Scanner page logic
 *
 * Flow:
 *  1. On page load, read ?id= from the URL (the School ID Number).
 *     If found → immediately trigger a scan.
 *  2. User can also type a School ID in the sim box and click Scan.
 *  3. POST to /api/rfid/scan with { id_number }
 *     → success: show result panel
 *     → error:   show error panel
 *  4. After DISPLAY_MS milliseconds, reset to idle.
 */

'use strict';

// ---- Config ----
const DISPLAY_MS    = 5000;
const IDLE_PANEL    = document.getElementById('panelIdle');
const SUCCESS_PANEL = document.getElementById('panelSuccess');
const ERROR_PANEL   = document.getElementById('panelError');

// Clock
const clockTimeEl = document.getElementById('clockTime');
const clockDateEl = document.getElementById('clockDate');

// Success panel
const resultBadge    = document.getElementById('resultBadge');
const badgeIconIn    = document.getElementById('badgeIconIn');
const badgeIconOut   = document.getElementById('badgeIconOut');
const resultAction   = document.getElementById('resultAction');
const resultAvatar   = document.getElementById('resultAvatar');
const resultName     = document.getElementById('resultName');
const resultId       = document.getElementById('resultId');
const resultTime     = document.getElementById('resultTime');
const resultDate     = document.getElementById('resultDate');
const resultProgress = document.getElementById('resultProgressBar');

// Error panel
const errorTitle    = document.getElementById('errorTitle');
const errorMsg      = document.getElementById('errorMsg');
const errorProgress = document.getElementById('errorProgressBar');

// Footer
const footerCardId = document.getElementById('footerCardId');

// Sim box
const simInput   = document.getElementById('simCardInput');
const simScanBtn = document.getElementById('simScanBtn');

// ------------------------------------------------------------------ clock --
function updateClock() {
  const now = new Date();
  clockTimeEl.textContent = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  clockDateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}
updateClock();
setInterval(updateClock, 1000);

// ------------------------------------------------------------------ panels --
let resetTimer = null;

function showPanel(which) {
  IDLE_PANEL.style.display    = 'none';
  SUCCESS_PANEL.style.display = 'none';
  ERROR_PANEL.style.display   = 'none';
  which.style.display = 'block';
}

function resetToIdle() {
  clearTimeout(resetTimer);
  footerCardId.textContent = '';
  showPanel(IDLE_PANEL);
  simInput.value = '';
  simInput.focus();
}

function startProgressBar(barEl, durationMs, cb) {
  barEl.style.transition = 'none';
  barEl.style.transform  = 'scaleX(1)';
  void barEl.offsetWidth; // force reflow
  barEl.style.transition = `transform ${durationMs}ms linear`;
  barEl.style.transform  = 'scaleX(0)';
  resetTimer = setTimeout(cb, durationMs);
}

// ------------------------------------------------------------------ scan --
async function doScan(rawId) {
  const idNumber = String(rawId).trim().toUpperCase();
  if (!idNumber) return;

  footerCardId.textContent = `ID: ${idNumber}`;

  try {
    const res  = await fetch('/api/rfid/scan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id_number: idNumber })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showSuccessPanel(data);
    } else {
      showErrorPanel(data.error || 'Unknown error.', idNumber, res.status);
    }
  } catch {
    showErrorPanel('Cannot reach the server. Check your connection.', idNumber);
  }
}

// ------------------------------------------------------------------ success panel --
function showSuccessPanel(data) {
  const isIn = data.action === 'time_in';

  resultBadge.className      = `result-badge result-badge--${isIn ? 'in' : 'out'}`;
  badgeIconIn.style.display  = isIn ? 'block' : 'none';
  badgeIconOut.style.display = isIn ? 'none'  : 'block';

  resultAction.textContent = isIn ? 'TIME IN' : 'TIME OUT';
  resultAction.className   = `result-action result-action--${isIn ? 'in' : 'out'}`;

  resultAvatar.textContent      = (data.first_name || '?').charAt(0).toUpperCase();
  resultAvatar.style.background = isIn ? 'var(--green-main)' : 'var(--blue-main)';

  resultName.textContent = data.full_name || `${data.first_name} ${data.last_name}`;
  resultId.textContent   = `ID: ${data.id_number}`;

  resultTime.textContent = data.time;
  resultTime.style.color = isIn ? 'var(--green-main)' : 'var(--blue-main)';
  resultDate.textContent = new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  showPanel(SUCCESS_PANEL);
  startProgressBar(resultProgress, DISPLAY_MS, resetToIdle);
}

// ------------------------------------------------------------------ error panel --
function showErrorPanel(message, idNumber, status) {
  const titles = {
    404: 'ID Not Registered',
    403: 'ID Deactivated',
    400: 'Invalid Request',
  };
  errorTitle.textContent   = titles[status] || 'Scan Failed';
  errorMsg.textContent     = message;
  footerCardId.textContent = idNumber ? `ID attempted: ${idNumber}` : '';

  showPanel(ERROR_PANEL);
  startProgressBar(errorProgress, DISPLAY_MS, resetToIdle);
}

// ------------------------------------------------------------------ sim box --
simScanBtn.addEventListener('click', () => {
  const val = simInput.value.trim();
  if (!val) { simInput.focus(); return; }
  doScan(val);
});

simInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') simScanBtn.click();
});

// ------------------------------------------------------------------ URL param --
(function checkUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  if (id) {
    setTimeout(() => doScan(id), 300);
  } else {
    simInput.focus();
  }
})();

// ================================================================
//  CARD MANAGER MODAL
// ================================================================

const cmOverlay    = document.getElementById('cardManagerOverlay');
const openCmBtn    = document.getElementById('openCardManager');
const closeCmBtn   = document.getElementById('closeCardManager');
const cmToast      = document.getElementById('cmToast');
const cmCountBadge = document.getElementById('cmCountBadge');

// -- Tabs --
const tabBtns     = document.querySelectorAll('.cm-tab');
const tabRegPane  = document.getElementById('tabRegister');
const tabListPane = document.getElementById('tabList');

function switchTab(name) {
  tabBtns.forEach(btn => btn.classList.toggle('cm-tab--active', btn.dataset.tab === name));
  tabRegPane.classList.toggle('cm-pane--hidden',  name !== 'register');
  tabListPane.classList.toggle('cm-pane--hidden', name !== 'list');
  if (name === 'list') loadCardList();
}

tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// -- Open / Close --
openCmBtn.addEventListener('click', () => {
  cmOverlay.classList.add('show');
  document.getElementById('reg_id_number').focus();
  loadCardList();
});
closeCmBtn.addEventListener('click', closeModal);
cmOverlay.addEventListener('click', (e) => { if (e.target === cmOverlay) closeModal(); });

function closeModal() { cmOverlay.classList.remove('show'); }

// -- Toast --
let cmToastTimer;
function showCmToast(msg, type = 'success') {
  cmToast.textContent  = msg;
  cmToast.className    = `cm-toast show-${type}`;
  clearTimeout(cmToastTimer);
  cmToastTimer = setTimeout(() => { cmToast.className = 'cm-toast'; }, 3000);
}

// ----------------------------------------------------------------
//  REGISTER STUDENT
// ----------------------------------------------------------------
const regSubmitBtn = document.getElementById('regSubmitBtn');
const regError     = document.getElementById('regError');

function showRegError(msg) { regError.textContent = msg; regError.classList.add('show'); }
function clearRegError()   { regError.textContent = '';  regError.classList.remove('show'); }

regSubmitBtn.addEventListener('click', async () => {
  clearRegError();

  const id_number  = document.getElementById('reg_id_number').value.trim().toUpperCase();
  const last_name  = document.getElementById('reg_last_name').value.trim();
  const first_name = document.getElementById('reg_first_name').value.trim();
  const mi         = document.getElementById('reg_mi').value.trim();

  if (!id_number)  { showRegError('School ID Number is required.'); return; }
  if (!last_name)  { showRegError('Last Name is required.');        return; }
  if (!first_name) { showRegError('First Name is required.');       return; }

  regSubmitBtn.disabled     = true;
  regSubmitBtn.textContent  = 'Registering…';

  try {
    const res  = await fetch('/api/rfid/cards', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id_number, last_name, first_name, middle_initial: mi || null })
    });
    const data = await res.json();

    if (res.ok) {
      ['reg_id_number', 'reg_last_name', 'reg_first_name', 'reg_mi']
        .forEach(id => { document.getElementById(id).value = ''; });
      showCmToast(`${first_name} ${last_name} (${id_number}) registered successfully.`);
      loadCardList();
    } else {
      showRegError(data.error || 'Failed to register student.');
    }
  } catch {
    showRegError('Server error. Make sure you are logged in as admin.');
  } finally {
    regSubmitBtn.disabled   = false;
    regSubmitBtn.innerHTML  = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      Register Student`;
  }
});

// ----------------------------------------------------------------
//  LIST STUDENTS
// ----------------------------------------------------------------
let allCards = [];

async function loadCardList() {
  try {
    const res = await fetch('/api/rfid/cards');
    if (!res.ok) {
      if (res.status === 401) {
        document.getElementById('cmTableBody').innerHTML =
          `<tr><td colspan="5" style="text-align:center;padding:24px;color:#b91c1c;">
            Not logged in. <a href="/" style="color:var(--green-main);font-weight:600;">Log in as admin</a> to manage students.
          </td></tr>`;
        document.getElementById('cmEmpty').style.display = 'none';
      }
      return;
    }
    const data = await res.json();
    allCards = data.cards || [];
    cmCountBadge.textContent = allCards.length;
    renderCardList(allCards);
  } catch { /* server not reachable */ }
}

function renderCardList(cards) {
  const tbody = document.getElementById('cmTableBody');
  const empty = document.getElementById('cmEmpty');
  tbody.innerHTML = '';

  if (!cards.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  cards.forEach(card => {
    const fullName = `${card.first_name}${card.middle_initial ? ' ' + card.middle_initial + '.' : ''} ${card.last_name}`;
    const date     = new Date(card.registered_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cm-id-number-cell">${card.id_number}</td>
      <td class="cm-name-cell">${fullName}</td>
      <td><span class="cm-status-${card.is_active ? 'active' : 'inactive'}">${card.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="cm-date-cell">${date}</td>
      <td>
        <button class="cm-btn-delete" title="Remove student" data-id="${card.id_number}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </td>
    `;

    tr.querySelector('.cm-btn-delete').addEventListener('click', async (e) => {
      const idNum = e.currentTarget.dataset.id;
      if (!confirm(`Remove student ID "${idNum}"? They will no longer be able to scan in.`)) return;
      try {
        const res = await fetch(`/api/rfid/cards/${encodeURIComponent(idNum)}`, { method: 'DELETE' });
        const d   = await res.json();
        if (res.ok) {
          showCmToast(`Student "${idNum}" removed.`);
          loadCardList();
        } else {
          showCmToast(d.error || 'Failed to remove student.', 'error');
        }
      } catch {
        showCmToast('Server error.', 'error');
      }
    });

    tbody.appendChild(tr);
  });
}

// -- Search --
document.getElementById('cmSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderCardList(allCards.filter(c =>
    c.id_number.toLowerCase().includes(q)  ||
    c.last_name.toLowerCase().includes(q)  ||
    c.first_name.toLowerCase().includes(q)
  ));
});
