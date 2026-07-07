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

// ---- Digits-only enforcement for ID Number inputs ----
function enforceDigitsOnly(input) {
  input.addEventListener('keydown', (e) => {
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });
  input.addEventListener('input', () => {
    const cleaned = input.value.replace(/\D/g, '');
    if (input.value !== cleaned) input.value = cleaned;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  enforceDigitsOnly(document.getElementById('f_id'));
  enforceDigitsOnly(document.getElementById('ef_id'));
});

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
    tr.dataset.record = JSON.stringify(rec);
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
      <td class="td-remarks">${rec.remarks ? `<span class="remarks-text">${rec.remarks}</span>` : '<span class="remarks-empty">—</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="btn-report-row" title="Report incident" data-record='${JSON.stringify(rec).replace(/'/g, "&apos;")}'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
          </button>
          <button class="btn-edit-row" title="Edit record">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
          </button>
          <button class="btn-delete-row" title="Delete record">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
          </button>
        </div>
      </td>
    `;

    // Report button
    tr.querySelector('.btn-report-row').addEventListener('click', (e) => {
      e.stopPropagation();
      openReportModal(rec);
    });

    // Edit button
    tr.querySelector('.btn-edit-row').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(rec);
    });

    // Delete button
    tr.querySelector('.btn-delete-row').addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = `${rec.first_name} ${rec.last_name} (${rec.id_number})`;
      if (!confirm(`Delete the record for ${name}? This cannot be undone.`)) return;
      try {
        const res  = await fetch(`/api/timerecord/${rec.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          showToast('Record deleted.');
          loadRecords();
        } else {
          showToast(data.error || 'Failed to delete record.', 'error');
        }
      } catch {
        showToast('Server error. Try again.', 'error');
      }
    });

    recordsBody.appendChild(tr);
  });
}

// ---- Edit Modal ----
const editModalOverlay = document.getElementById('editModalOverlay');
let editingId = null;

function toTimeInput(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d)) return '';
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
function toDateInput(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
}

function openEditModal(rec) {
  editingId = rec.id;
  document.getElementById('ef_id').value      = rec.id_number      || '';
  document.getElementById('ef_last').value    = rec.last_name      || '';
  document.getElementById('ef_first').value   = rec.first_name     || '';
  document.getElementById('ef_mi').value      = rec.middle_initial || '';
  document.getElementById('ef_timein').value  = toTimeInput(rec.time_in);
  document.getElementById('ef_timeout').value = toTimeInput(rec.time_out);
  document.getElementById('ef_date').value    = toDateInput(rec.time_in || rec.date);
  document.getElementById('ef_remarks').value = rec.remarks || '';
  editModalOverlay.classList.add('show');
}

document.getElementById('editModalCancel').addEventListener('click', () => {
  editModalOverlay.classList.remove('show');
  editingId = null;
});
editModalOverlay.addEventListener('click', (e) => {
  if (e.target === editModalOverlay) { editModalOverlay.classList.remove('show'); editingId = null; }
});

document.getElementById('editModalSave').addEventListener('click', async () => {
  if (!editingId) return;
  const id_number      = document.getElementById('ef_id').value.trim();
  const last_name      = document.getElementById('ef_last').value.trim();
  const first_name     = document.getElementById('ef_first').value.trim();
  const middle_initial = document.getElementById('ef_mi').value.trim();
  const time_in        = document.getElementById('ef_timein').value;
  const time_out       = document.getElementById('ef_timeout').value;
  const date           = document.getElementById('ef_date').value;
  const remarks        = document.getElementById('ef_remarks').value.trim();

  if (!id_number || !last_name || !first_name) {
    showToast('ID Number, Last Name, and First Name are required.', 'error');
    return;
  }
  try {
    const res  = await fetch(`/api/timerecord/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks })
    });
    const data = await res.json();
    if (res.ok) {
      editModalOverlay.classList.remove('show');
      editingId = null;
      showToast('Record updated successfully.');
      loadRecords();
    } else {
      showToast(data.error || 'Failed to update record.', 'error');
    }
  } catch {
    showToast('Server error. Try again.', 'error');
  }
});



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
  const remarks        = document.getElementById('f_remarks').value.trim();

  if (!id_number || !last_name || !first_name) {
    showToast('ID Number, Last Name, and First Name are required.', 'error');
    return;
  }
  try {
    const res = await fetch('/api/timerecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks })
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


// ========== REPORT INCIDENT MODAL ==========
const reportModal = document.getElementById('reportModal');

function openReportModal(rec) {
  const fullName = `${rec.first_name} ${rec.last_name}`;
  document.getElementById('reportSubjectName').value  = fullName;
  document.getElementById('reportSubjectId').value    = rec.id_number || '';
  document.getElementById('reportIncidentDate').value = rec.date
    ? new Date(rec.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  document.getElementById('reportDescription').value  = '';
  reportModal.classList.add('show');
}

document.getElementById('reportCancel').addEventListener('click', () => {
  reportModal.classList.remove('show');
});
reportModal.addEventListener('click', (e) => {
  if (e.target === reportModal) reportModal.classList.remove('show');
});

document.getElementById('reportSubmit').addEventListener('click', async () => {
  const subject_name  = document.getElementById('reportSubjectName').value.trim();
  const subject_id_no = document.getElementById('reportSubjectId').value.trim();
  const incident_date = document.getElementById('reportIncidentDate').value;
  const incident_type = document.getElementById('reportIncidentType').value;
  const description   = document.getElementById('reportDescription').value.trim();

  if (!subject_name || !description) {
    showToast('Subject name and description are required.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_name, subject_id_no, incident_date, incident_type, description })
    });
    const data = await res.json();
    if (res.ok) {
      reportModal.classList.remove('show');
      showToast('Incident report submitted successfully.');
    } else {
      showToast(data.error || 'Failed to submit incident report.', 'error');
    }
  } catch {
    showToast('Server error. Please try again.', 'error');
  }
});
