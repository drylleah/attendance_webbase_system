// ============================================
//  timerecord.js — Time Record Page Logic
//  Session, Table, Search, Pagination, PDF
// ============================================

const recordsBody  = document.getElementById('recordsBody');
const emptyState   = document.getElementById('emptyState');
const totalRecords = document.getElementById('totalRecords');
const searchInput  = document.getElementById('searchInput');
const dateFrom     = document.getElementById('dateFrom');
const dateTo       = document.getElementById('dateTo');
const monthFilter  = document.getElementById('monthFilter');
const modalOverlay = document.getElementById('modalOverlay');
const toast        = document.getElementById('toast');

let currentSearch = '';
let currentFrom   = '';
let currentTo     = '';
let currentMonth  = '';

// ---- Session Check ----
(async function checkSession() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.loggedIn) { window.location.href = '/'; return; }

    const userAvatar   = document.getElementById('userAvatar');
    const topbarAvatar = document.getElementById('topbarAvatar');

    try {
      const profileRes  = await fetch('/api/settings/profile');
      const profileData = await profileRes.json();
      const firstName   = profileData.first_name || data.username || 'Admin';
      document.getElementById('userDisplayName').textContent =
        firstName.charAt(0).toUpperCase() + firstName.slice(1) + ' User';
      userAvatar.textContent   = firstName.charAt(0).toUpperCase();
      topbarAvatar.textContent = firstName.charAt(0).toUpperCase();
      if (profileData.profile_pic) {
        const avatarImg = `<img src="${profileData.profile_pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        userAvatar.innerHTML   = avatarImg;
        topbarAvatar.innerHTML = avatarImg;
      }
    } catch {
      const name = data.username || 'Admin';
      document.getElementById('userDisplayName').textContent =
        name.charAt(0).toUpperCase() + name.slice(1) + ' User';
      userAvatar.textContent   = name.charAt(0).toUpperCase();
      topbarAvatar.textContent = name.charAt(0).toUpperCase();
    }
  } catch { window.location.href = '/'; }
})();

// ---- Logout ----
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

// ---- Toast ----
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}

// ---- Format Helpers ----
function formatTime(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  if (isNaN(d)) return null;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Render Table ----
function renderTable(records, total) {
  recordsBody.innerHTML = '';
  totalRecords.textContent = total.toLocaleString();

  if (!records || records.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  records.forEach((rec) => {
    const timeIn  = formatTime(rec.time_in);
    const timeOut = formatTime(rec.time_out);
    const dateStr = formatDate(rec.time_in || rec.date);
    const [tiTime, tiAmPm] = timeIn  ? timeIn.split(' ')  : [null, null];
    const [toTime, toAmPm] = timeOut ? timeOut.split(' ') : [null, null];
    const fullName = rec.last_name || rec.first_name
      ? `${rec.last_name || ''}, ${rec.first_name || ''}${rec.middle_initial ? ' ' + rec.middle_initial + '.' : ''}`.trim()
      : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-id">${rec.id_number || '—'}</td>
      <td class="col-last">${rec.last_name  || '—'}</td>
      <td class="col-first">${rec.first_name || '—'}</td>
      <td class="col-mi">${rec.middle_initial || '—'}</td>
      <td class="col-fullname">${fullName || '—'}</td>
      <td>${tiTime
        ? `<div class="time-in-block"><div class="t">${tiTime}</div><div class="ap">${tiAmPm}</div></div>`
        : '<span class="time-empty">--:--</span>'}</td>
      <td>${toTime
        ? `<div class="time-out-block"><div class="t">${toTime}</div><div class="ap">${toAmPm}</div></div>`
        : '<span class="time-empty">--:--</span>'}</td>
      <td class="td-date">${dateStr}</td>
    `;
    recordsBody.appendChild(tr);
  });
}



// ---- Load Records ----
async function loadRecords() {
  try {
    const params = new URLSearchParams({
      search: currentSearch,
      from:   currentFrom,
      to:     currentTo,
      month:  currentMonth,
      limit:  9999 // load all
    });
    const res  = await fetch(`/api/timerecord?${params}`);
    const data = await res.json();
    renderTable(data.records, data.total);
  } catch {
    showToast('Failed to load records.', 'error');
  }
}
loadRecords();

// ---- Search ----
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = searchInput.value.trim();
    loadRecords();
  }, 300);
});

// ---- Date Range ----
dateFrom.addEventListener('change', () => { currentFrom = dateFrom.value; loadRecords(); });
dateTo.addEventListener('change',   () => { currentTo   = dateTo.value;   loadRecords(); });

// ---- Month Filter ----
monthFilter.addEventListener('change', () => { currentMonth = monthFilter.value; loadRecords(); });

// ---- Export PDF ----
document.getElementById('btnExport').addEventListener('click', () => {
  window.print();
});

// ---- New Entry Modal ----
document.getElementById('btnNewEntry').addEventListener('click', () => {
  const now = new Date();
  document.getElementById('f_timein').value  = now.toTimeString().slice(0, 8);
  document.getElementById('f_timeout').value = '';
  document.getElementById('f_date').value    = now.toISOString().slice(0, 10);
  document.getElementById('f_id').value    = '';
  document.getElementById('f_last').value  = '';
  document.getElementById('f_first').value = '';
  document.getElementById('f_mi').value    = '';
  modalOverlay.classList.add('show');
});

document.getElementById('modalCancel').addEventListener('click', () => modalOverlay.classList.remove('show'));
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('show'); });

document.getElementById('modalSave').addEventListener('click', async () => {
  const id_number      = document.getElementById('f_id').value.trim();
  const last_name      = document.getElementById('f_last').value.trim();
  const first_name     = document.getElementById('f_first').value.trim();
  const middle_initial = document.getElementById('f_mi').value.trim();
  const time_in        = document.getElementById('f_timein').value;
  const time_out       = document.getElementById('f_timeout').value;
  const date           = document.getElementById('f_date').value;

  if (!id_number || !last_name || !first_name) {
    showToast('ID Number, Last Name, and First Name are required.', 'error');
    return;
  }
  try {
    const res = await fetch('/api/timerecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_number, last_name, first_name, middle_initial, time_in, time_out, date })
    });
    const data = await res.json();
    if (res.ok) {
      modalOverlay.classList.remove('show');
      showToast('Entry added successfully.');
      currentPage = 1;
      loadRecords();
    } else {
      showToast(data.error || 'Failed to add entry.', 'error');
    }
  } catch {
    showToast('Server error. Try again.', 'error');
  }
});