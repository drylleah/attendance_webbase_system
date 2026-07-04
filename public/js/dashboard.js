// ============================================
//  dashboard.js — Dashboard Frontend Logic
//  Clock, Attendance CRUD, Search, Session
// ============================================

// ---- Elements ----
const welcomeName    = document.getElementById('welcomeName');
const userDisplayName= document.getElementById('userDisplayName');
const userEmail      = document.getElementById('userEmail');
const userAvatar     = document.getElementById('userAvatar');
const liveDate       = document.getElementById('liveDate');
const liveTime       = document.getElementById('liveTime');
const totalPresent   = document.getElementById('totalPresent');
const attendanceBody = document.getElementById('attendanceBody');
const emptyState     = document.getElementById('emptyState');
const searchInput    = document.getElementById('searchInput');
const selectAll      = document.getElementById('selectAll');
const toast          = document.getElementById('toast');
const modalOverlay   = document.getElementById('modalOverlay');

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
      // Show profile pic if set
      if (profileData.profile_pic) {
        userAvatar.innerHTML = `<img src="${profileData.profile_pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      }
    } catch {
      const name = data.username || 'Admin';
      welcomeName.textContent     = name.charAt(0).toUpperCase() + name.slice(1);
      userDisplayName.textContent = name.charAt(0).toUpperCase() + name.slice(1) + ' User';
      userAvatar.textContent      = name.charAt(0).toUpperCase();
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
    `;
    attendanceBody.appendChild(tr);
  });

  // Sync select-all
  selectAll.checked = false;
}

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

  if (!id_number || !last_name || !first_name) {
    showToast('ID Number, Last Name, and First Name are required.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_number, last_name, first_name, middle_initial, time_in, time_out, date })
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