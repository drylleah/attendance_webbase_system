// ============================================
//  dashboard.js — Dashboard Frontend Logic
//  Clock, Attendance CRUD, Search, Session
// ============================================

// ---- Elements ----
const welcomeName    = document.getElementById('welcomeName');
const userDisplayName= document.getElementById('userDisplayName');
const userEmail      = document.getElementById('userEmail');
const userAvatar     = document.getElementById('userAvatar');
const topbarAvatar   = document.getElementById('topbarAvatar');
const liveDate       = document.getElementById('liveDate');
const liveTime       = document.getElementById('liveTime');
const totalPresent   = document.getElementById('totalPresent');
const attendanceBody = document.getElementById('attendanceBody');
const emptyState     = document.getElementById('emptyState');
const searchInput    = document.getElementById('searchInput');
const selectAll      = document.getElementById('selectAll');
const toast          = document.getElementById('toast');
const modalOverlay   = document.getElementById('modalOverlay');

// ---- Digits-only enforcement for ID Number inputs ----
function enforceDigitsOnly(input) {
  // Block non-digit keys at keydown (catches e, +, -, ., arrows still work)
  input.addEventListener('keydown', (e) => {
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return; // allow copy/paste shortcuts
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });
  // Strip any non-digits that get in via paste or autofill
  input.addEventListener('input', () => {
    const cleaned = input.value.replace(/\D/g, '');
    if (input.value !== cleaned) input.value = cleaned;
  });
}

// Apply to both Add and Edit modals once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  enforceDigitsOnly(document.getElementById('f_id'));
  enforceDigitsOnly(document.getElementById('ef_id'));
});

// ---- Session Check (redirect to login if not logged in) ----
(async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = '/';
      return;
    }
    // Load first name from profile
    try {
      const profileRes  = await fetch('/api/settings/profile');
      const profileData = await profileRes.json();
      const firstName   = profileData.first_name || data.username || 'Admin';
      welcomeName.textContent     = firstName.charAt(0).toUpperCase() + firstName.slice(1);
      userDisplayName.textContent = firstName.charAt(0).toUpperCase() + firstName.slice(1) + ' User';
      userAvatar.textContent      = firstName.charAt(0).toUpperCase();
      topbarAvatar.textContent    = firstName.charAt(0).toUpperCase();
      // Show profile pic if set
      if (profileData.profile_pic) {
        const avatarImg = `<img src="${profileData.profile_pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        userAvatar.innerHTML   = avatarImg;
        topbarAvatar.innerHTML = avatarImg;
      }
    } catch {
      const name = data.username || 'Admin';
      welcomeName.textContent     = name.charAt(0).toUpperCase() + name.slice(1);
      userDisplayName.textContent = name.charAt(0).toUpperCase() + name.slice(1) + ' User';
      userAvatar.textContent      = name.charAt(0).toUpperCase();
      topbarAvatar.textContent    = name.charAt(0).toUpperCase();
    }
  } catch {
    window.location.href = '/';
  }
})();

// ---- Logout ----
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

// ---- Live Clock ----
function updateClock() {
  const now = new Date();
  const dateOpts = { year: 'numeric', month: 'long', day: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  liveDate.textContent = now.toLocaleDateString('en-US', dateOpts);
  liveTime.textContent = now.toLocaleTimeString('en-US', timeOpts);
}
updateClock();
setInterval(updateClock, 1000);

// ---- Manual Schedule Auto-Save (Settings > Date and Time) ----
function updateModeIndicator(mode) {
  const el   = document.getElementById('modeIndicator');
  const text = document.getElementById('modeIndicatorText');
  if (!el || !text) return;
  const isManual = mode === 'manual';
  el.classList.toggle('manual', isManual);
  text.textContent = isManual ? 'Manual Mode' : 'Automatic Mode';
}

async function checkScheduledAutoSave() {
  try {
    const res  = await fetch('/api/settings/datetime');
    const data = await res.json();
    updateModeIndicator(data.mode);

    if (data.mode !== 'manual' || !data.end_date || !data.end_time || data.last_triggered_at) return;

    const endDateTime = new Date(`${data.end_date}T${String(data.end_time).slice(0, 5)}:00`);
    if (new Date() >= endDateTime) {
      const saveRes  = await fetch('/api/timerecord/save', { method: 'POST' });
      const saveData = await saveRes.json();
      await fetch('/api/settings/datetime/triggered', { method: 'PUT' });
      if (saveRes.ok) {
        showToast(`Scheduled save: ${saveData.count} record(s) moved to Time Record.`);
        loadAttendance();
      }
    }
  } catch {
    // Fail silently — this is a background check, not a user-initiated action.
  }
}
checkScheduledAutoSave();
setInterval(checkScheduledAutoSave, 15000); // check every 15 seconds

// ---- Toast Notification ----
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}

// ---- Format Time ----
function formatTime(datetime) {
  if (!datetime) return null;
  const d = new Date(datetime);
  if (isNaN(d)) return null;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDate(datetime) {
  if (!datetime) return '—';
  const d = new Date(datetime);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
}

// ---- Render Table ----
let allRecords = [];

function renderTable(records) {
  attendanceBody.innerHTML = '';
  if (!records || records.length === 0) {
    emptyState.style.display = 'block';
    totalPresent.textContent = '0';
    return;
  }
  emptyState.style.display = 'none';
  totalPresent.textContent = records.length.toString().padStart(1, '0');

  records.forEach((rec) => {
    const timeIn  = formatTime(rec.time_in);
    const timeOut = formatTime(rec.time_out);
    const dateStr = formatDate(rec.time_in || rec.date);

    const tr = document.createElement('tr');
    tr.dataset.id = rec.id;
    tr.classList.add('clickable-row');
    tr.title = 'Click to edit this record';
    tr.innerHTML = `
      <td class="row-check"><input type="checkbox" class="row-cb" data-id="${rec.id}"></td>
      <td><span class="id-link">${rec.id_number || '—'}</span></td>
      <td>${rec.last_name || '—'}</td>
      <td>${rec.first_name || '—'}</td>
      <td>${rec.middle_initial || '—'}</td>
      <td>
        ${timeIn
          ? `<div class="time-block"><div class="time">${timeIn.split(' ')[0]}</div><div class="ampm">${timeIn.split(' ')[1]}</div></div>`
          : '<span class="time-empty">- : - -</span>'}
      </td>
      <td>
        ${timeOut
          ? `<div class="time-block"><div class="time">${timeOut.split(' ')[0]}</div><div class="ampm">${timeOut.split(' ')[1]}</div></div>`
          : '<span class="time-empty">- : - -</span>'}
      </td>
      <td>${dateStr}</td>
      <td class="td-remarks">${rec.remarks ? `<span class="remarks-text">${rec.remarks}</span>` : '<span class="remarks-empty">—</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="btn-report-row" data-id="${rec.id}" title="Report incident">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
          </button>
          <button class="btn-edit-row" data-id="${rec.id}" title="Edit record">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
          </button>
        </div>
      </td>
    `;

    // Store raw record data on the row for the edit modal
    tr.dataset.record = JSON.stringify(rec);
    attendanceBody.appendChild(tr);
  });

  // Sync select-all
  selectAll.checked = false;

  // Attach row button listeners
  document.querySelectorAll('.btn-report-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id  = btn.dataset.id;
      const row = attendanceBody.querySelector(`tr[data-id="${id}"]`);
      const rec = JSON.parse(row.dataset.record);
      openReportModal(rec);
    });
  });

  document.querySelectorAll('.btn-edit-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id  = btn.dataset.id;
      const row = attendanceBody.querySelector(`tr[data-id="${id}"]`);
      const rec = JSON.parse(row.dataset.record);
      openEditModal(rec);
    });
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
    const res  = await fetch(`/api/attendance/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks })
    });
    const data = await res.json();
    if (res.ok) {
      editModalOverlay.classList.remove('show');
      editingId = null;
      showToast('Record updated successfully.');
      loadAttendance(searchInput.value.trim());
    } else {
      showToast(data.error || 'Failed to update record.', 'error');
    }
  } catch {
    showToast('Server error. Please try again.', 'error');
  }
});

// ---- Fetch Attendance ----
async function loadAttendance(query = '') {
  try {
    const url = query ? `/api/attendance?search=${encodeURIComponent(query)}` : '/api/attendance';
    const res = await fetch(url);
    const data = await res.json();
    allRecords = data.records || [];
    renderTable(allRecords);
  } catch {
    showToast('Failed to load attendance records.', 'error');
  }
}
loadAttendance();

// ---- Search ----
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadAttendance(searchInput.value.trim());
  }, 300);
});

// ---- Select All ----
selectAll.addEventListener('change', () => {
  document.querySelectorAll('.row-cb').forEach(cb => cb.checked = selectAll.checked);
});

// ---- NEW Record Modal ----
document.getElementById('btnNew').addEventListener('click', () => {
  // Pre-fill time and date
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('f_timein').value = `${hh}:${mm}:${ss}`;
  document.getElementById('f_timeout').value = '';
  document.getElementById('f_date').value = now.toISOString().slice(0, 10);
  document.getElementById('f_id').value = '';
  document.getElementById('f_last').value = '';
  document.getElementById('f_first').value = '';
  document.getElementById('f_mi').value = '';
  modalOverlay.classList.add('show');
});

document.getElementById('modalCancel').addEventListener('click', () => {
  modalOverlay.classList.remove('show');
});
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('show');
});

document.getElementById('modalSave').addEventListener('click', async () => {
  const id_number     = document.getElementById('f_id').value.trim();
  const last_name     = document.getElementById('f_last').value.trim();
  const first_name    = document.getElementById('f_first').value.trim();
  const middle_initial= document.getElementById('f_mi').value.trim();
  const time_in       = document.getElementById('f_timein').value;
  const time_out      = document.getElementById('f_timeout').value;
  const date          = document.getElementById('f_date').value;
  const remarks       = document.getElementById('f_remarks').value.trim();

  if (!id_number || !last_name || !first_name) {
    showToast('ID Number, Last Name, and First Name are required.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks })
    });
    const data = await res.json();
    if (res.ok) {
      modalOverlay.classList.remove('show');
      showToast('Record added successfully.');
      loadAttendance(searchInput.value.trim());
    } else {
      showToast(data.error || 'Failed to add record.', 'error');
    }
  } catch {
    showToast('Server error. Please try again.', 'error');
  }
});

// ---- DELETE Selected ----
document.getElementById('btnDelete').addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('.row-cb:checked')].map(cb => cb.dataset.id);
  if (checked.length === 0) {
    showToast('Please select at least one record to delete.', 'error');
    return;
  }
  if (!confirm(`Delete ${checked.length} selected record(s)?`)) return;

  try {
    const res = await fetch('/api/attendance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: checked })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`${checked.length} record(s) deleted.`);
      loadAttendance(searchInput.value.trim());
    } else {
      showToast(data.error || 'Failed to delete.', 'error');
    }
  } catch {
    showToast('Server error.', 'error');
  }
});

// ---- SAVE TO TIME RECORD ----
document.getElementById('btnSaveToTimeRecord').addEventListener('click', async () => {
  if (!confirm('Save all current attendance records to Time Record and clear the live list?')) return;
  try {
    const res  = await fetch('/api/timerecord/save', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast(`${data.count} record(s) saved to Time Record.`);
      loadAttendance();
    } else {
      showToast(data.error || 'Failed to save.', 'error');
    }
  } catch {
    showToast('Server error.', 'error');
  }
});

// ---- REFRESH ----
document.getElementById('btnRefresh').addEventListener('click', () => {
  loadAttendance(searchInput.value.trim());
  showToast('Attendance stream refreshed.');
});

// ========== REPORT INCIDENT MODAL ==========
const reportModal = document.getElementById('reportModal');

function openReportModal(rec) {
  document.getElementById('reportSubjectName').value  = `${rec.first_name} ${rec.last_name}`;
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
      showToast(data.error || 'Failed to submit report.', 'error');
    }
  } catch {
    showToast('Server error. Please try again.', 'error');
  }
});
