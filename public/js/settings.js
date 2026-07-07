// ============================================
//  settings.js — Settings Page Logic
// ============================================

let originalData = {};  // for Discard Changes

// ---- Session Check ----
(async function checkSession() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.loggedIn) { window.location.href = '/'; return; }
    loadProfile();
    loadDatetimeConfig();
  } catch { window.location.href = '/'; }
})();

// ---- Open tab based on ?tab= query param (e.g. from Profile icon links) ----
(function openTabFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab === 'account' || tab === 'datetime') {
    switchTab(tab);
  }
})();

// ---- Logout ----
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

// ---- Toast ----
let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}

// ---- Tab Switch ----
function switchTab(tab) {
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

  if (tab === 'account') {
    document.getElementById('menuAccountInfo').classList.add('active');
    document.getElementById('sectionAccount').classList.add('active');
  } else if (tab === 'datetime') {
    document.getElementById('menuDateTime').classList.add('active');
    document.getElementById('sectionDateTime').classList.add('active');
  } else if (tab === 'activitylogs') {
    document.getElementById('menuActivityLogs').classList.add('active');
    document.getElementById('sectionActivityLogs').classList.add('active');
    loadActivityLogs();
  }
}

// ---- Load Profile ----
async function loadProfile() {
  try {
    const res  = await fetch('/api/settings/profile');
    const data = await res.json();

    document.getElementById('fieldFirstName').value = data.first_name || '';
    document.getElementById('fieldLastName').value  = data.last_name  || '';
    document.getElementById('fieldEmail').value     = data.email      || '';

    // Store original for discard
    originalData = {
      first_name: data.first_name || '',
      last_name:  data.last_name  || '',
      email:      data.email      || '',
      profile_pic: data.profile_pic || null
    };

    // Set avatar
    updateAvatarDisplay(data.profile_pic, data.first_name || data.username || 'A');

    // Sidebar info
    const displayName = data.first_name
      ? `${data.first_name}${data.last_name ? ' ' + data.last_name : ''}`
      : (data.username || 'Admin');
    document.getElementById('sidebarName').textContent = displayName;
    document.getElementById('sidebarEmail').textContent = data.email || 'admin@lorma.edu';

  } catch {
    showToast('Failed to load profile.', 'error');
  }
}

// ---- Update Avatar Display ----
function updateAvatarDisplay(picBase64, fallbackLetter) {
  const preview     = document.getElementById('avatarPreview');
  const sidebarAv   = document.getElementById('sidebarAvatar');
  const topbarAv    = document.getElementById('topbarAvatar');
  const letter      = (fallbackLetter || 'A').charAt(0).toUpperCase();

  if (picBase64) {
    const imgTag = `<img src="${picBase64}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    preview.innerHTML   = imgTag;
    sidebarAv.innerHTML = `<img src="${picBase64}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    topbarAv.innerHTML  = `<img src="${picBase64}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    preview.innerHTML   = letter;
    sidebarAv.innerHTML = letter;
    topbarAv.innerHTML  = letter;
  }
}

// ---- Avatar Upload ----
let pendingAvatar = null;
document.getElementById('avatarInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be under 2MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingAvatar = ev.target.result; // base64
    updateAvatarDisplay(pendingAvatar, document.getElementById('fieldFirstName').value || 'A');
  };
  reader.readAsDataURL(file);
});

// ---- Save All Configurations ----
document.getElementById('btnSaveConfig').addEventListener('click', async () => {
  const first_name = document.getElementById('fieldFirstName').value.trim();
  const last_name  = document.getElementById('fieldLastName').value.trim();
  const email      = document.getElementById('fieldEmail').value.trim();

  try {
    // Save profile info
    const res = await fetch('/api/settings/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, email })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Failed to save.', 'error'); return; }

    // Save avatar if changed
    if (pendingAvatar) {
      await fetch('/api/settings/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_pic: pendingAvatar })
      });
      originalData.profile_pic = pendingAvatar;
      pendingAvatar = null;
    }

    // Save date & time mode (covers switching to Automatic, or re-saving Manual as-is)
    if (currentDtMode === 'automatic') {
      await fetch('/api/settings/datetime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'automatic' })
      });
      originalDtData = { mode: 'automatic' };
    }

    // Update original data
    originalData = { first_name, last_name, email, profile_pic: originalData.profile_pic };

    // Update sidebar
    const displayName = first_name ? `${first_name}${last_name ? ' ' + last_name : ''}` : 'Admin';
    document.getElementById('sidebarName').textContent  = displayName;
    document.getElementById('sidebarEmail').textContent = email || 'admin@lorma.edu';

    showToast('All configurations saved successfully.');
  } catch {
    showToast('Server error. Try again.', 'error');
  }
});

// ---- Discard Changes ----
document.getElementById('btnDiscard').addEventListener('click', () => {
  document.getElementById('fieldFirstName').value = originalData.first_name || '';
  document.getElementById('fieldLastName').value  = originalData.last_name  || '';
  document.getElementById('fieldEmail').value     = originalData.email      || '';
  pendingAvatar = null;
  updateAvatarDisplay(originalData.profile_pic, originalData.first_name || 'A');

  // Revert Date and Time section
  document.getElementById('dtStartDate').value = toDateInputValue(originalDtData.start_date);
  document.getElementById('dtStartTime').value = toTimeInputValue(originalDtData.start_time);
  document.getElementById('dtEndDate').value   = toDateInputValue(originalDtData.end_date);
  document.getElementById('dtEndTime').value   = toTimeInputValue(originalDtData.end_time);
  setDtMode(originalDtData.mode || 'automatic');

  showToast('Changes discarded.');
});

// ---- Change Password Modal ----
const pwModal   = document.getElementById('pwModal');
const pwError   = document.getElementById('pwError');

document.getElementById('btnChangePw').addEventListener('click', () => {
  document.getElementById('pwCurrent').value = '';
  document.getElementById('pwNew').value     = '';
  document.getElementById('pwConfirm').value = '';
  pwError.className = 'modal-error';
  pwModal.classList.add('show');
});
document.getElementById('pwCancel').addEventListener('click', () => pwModal.classList.remove('show'));
pwModal.addEventListener('click', e => { if (e.target === pwModal) pwModal.classList.remove('show'); });

document.getElementById('pwSave').addEventListener('click', async () => {
  const current = document.getElementById('pwCurrent').value;
  const newPw   = document.getElementById('pwNew').value;
  const confirm = document.getElementById('pwConfirm').value;

  pwError.className = 'modal-error';

  if (!current || !newPw || !confirm) {
    pwError.textContent = 'Please fill in all fields.';
    pwError.classList.add('show'); return;
  }
  if (newPw.length < 6) {
    pwError.textContent = 'New password must be at least 6 characters.';
    pwError.classList.add('show'); return;
  }
  if (newPw !== confirm) {
    pwError.textContent = 'New passwords do not match.';
    pwError.classList.add('show'); return;
  }

  try {
    const res  = await fetch('/api/settings/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: current, new_password: newPw })
    });
    const data = await res.json();
    if (res.ok) {
      pwModal.classList.remove('show');
      showToast('Password changed successfully.');
    } else {
      pwError.textContent = data.error || 'Failed to change password.';
      pwError.classList.add('show');
    }
  } catch {
    pwError.textContent = 'Server error. Try again.';
    pwError.classList.add('show');
  }
});

// ============================================
//  DATE AND TIME SETTINGS
// ============================================

let originalDtData = { mode: 'automatic' };

// ---- Helpers: format DB values for <input type="date"/"time"> ----
function toDateInputValue(val) {
  if (!val) return '';
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10); // already plain YYYY-MM-DD
  const d = new Date(val);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toTimeInputValue(val) {
  if (!val) return '';
  return String(val).slice(0, 5); // "HH:MM:SS" -> "HH:MM"
}

// ---- Toggle Automatic / Manual view ----
function setDtMode(mode) {
  document.getElementById('dtModeAutomatic').classList.toggle('active', mode === 'automatic');
  document.getElementById('dtModeManual').classList.toggle('active', mode === 'manual');
  document.getElementById('dtAutomaticView').style.display = mode === 'automatic' ? 'block' : 'none';
  document.getElementById('dtManualView').style.display    = mode === 'manual'    ? 'block' : 'none';
  currentDtMode = mode;
}
let currentDtMode = 'automatic';

// ---- Live current time (Automatic view) ----
function updateDtCurrentTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const el = document.getElementById('dtCurrentValue');
  if (el) el.textContent = `${dateStr} - ${timeStr}`;
}
updateDtCurrentTime();
setInterval(updateDtCurrentTime, 1000);

// ---- Load datetime config ----
async function loadDatetimeConfig() {
  try {
    const res  = await fetch('/api/settings/datetime');
    const data = await res.json();

    originalDtData = {
      mode: data.mode || 'automatic',
      start_date: data.start_date || '',
      start_time: data.start_time || '',
      end_date: data.end_date || '',
      end_time: data.end_time || ''
    };

    document.getElementById('dtStartDate').value = toDateInputValue(data.start_date);
    document.getElementById('dtStartTime').value = toTimeInputValue(data.start_time);
    document.getElementById('dtEndDate').value   = toDateInputValue(data.end_date);
    document.getElementById('dtEndTime').value   = toTimeInputValue(data.end_time);

    setDtMode(data.mode || 'automatic');
  } catch {
    // Silently keep defaults if this fails; Account Information still works.
  }
}

// ---- Apply (Manual schedule) ----
document.getElementById('dtApplyBtn').addEventListener('click', async () => {
  const start_date = document.getElementById('dtStartDate').value;
  const start_time = document.getElementById('dtStartTime').value;
  const end_date    = document.getElementById('dtEndDate').value;
  const end_time    = document.getElementById('dtEndTime').value;

  if (!start_date || !start_time || !end_date || !end_time) {
    showToast('Please fill in both Start and End date and time.', 'error');
    return;
  }
  if (new Date(`${end_date}T${end_time}`) <= new Date(`${start_date}T${start_time}`)) {
    showToast('End date/time must be after Start date/time.', 'error');
    return;
  }

  try {
    const res  = await fetch('/api/settings/datetime', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'manual', start_date, start_time, end_date, end_time })
    });
    const data = await res.json();
    if (res.ok) {
      originalDtData = { mode: 'manual', start_date, start_time, end_date, end_time };
      showToast('Schedule applied. Attendance will auto-save to Time Record at the End date and time.');
    } else {
      showToast(data.error || 'Failed to apply schedule.', 'error');
    }
  } catch {
    showToast('Server error. Try again.', 'error');
  }
});


// ============================================
//  ACTIVITY LOGS
// ============================================

const AL_LIMIT = 15;
let alPage     = 1;
let alTotal    = 0;
let alSearch   = '';
let alAction   = '';
let alFrom     = '';
let alTo       = '';

// Action label map — converts DB action codes to friendly display text
const ACTION_LABELS = {
  LOGIN:                    { label: 'Login',                  color: 'al-tag-info'    },
  LOGOUT:                   { label: 'Logout',                 color: 'al-tag-muted'   },
  ADD_ATTENDANCE:           { label: 'Add Attendance',          color: 'al-tag-success' },
  EDIT_ATTENDANCE:          { label: 'Edit Attendance',         color: 'al-tag-warning' },
  DELETE_ATTENDANCE:        { label: 'Delete Attendance',       color: 'al-tag-danger'  },
  CLEAR_ATTENDANCE:         { label: 'Clear Attendance',        color: 'al-tag-danger'  },
  ADD_TIME_RECORD:          { label: 'Add Time Record',         color: 'al-tag-success' },
  EDIT_TIME_RECORD:         { label: 'Edit Time Record',        color: 'al-tag-warning' },
  DELETE_TIME_RECORD:       { label: 'Delete Time Record',      color: 'al-tag-danger'  },
  SAVE_TO_TIME_RECORDS:     { label: 'Save to Time Records',    color: 'al-tag-success' },
  UPDATE_PROFILE:           { label: 'Update Profile',          color: 'al-tag-info'    },
  UPDATE_AVATAR:            { label: 'Update Avatar',           color: 'al-tag-info'    },
  CHANGE_PASSWORD:          { label: 'Change Password',         color: 'al-tag-warning' },
  UPDATE_DATETIME_CONFIG:   { label: 'Date/Time Config',        color: 'al-tag-info'    },
  CLEAR_ACTIVITY_LOGS:      { label: 'Clear Logs',              color: 'al-tag-danger'  },
  BULK_DELETE_LOGS:         { label: 'Bulk Delete Logs',        color: 'al-tag-danger'  },
  ARCHIVE_LOGS:             { label: 'Archive Logs',            color: 'al-tag-warning' },
  EXPORT_LOGS:              { label: 'Export Logs',             color: 'al-tag-info'    },
  CREATE_INCIDENT_REPORT:   { label: 'Report Incident',         color: 'al-tag-danger'  },
  UPDATE_INCIDENT_REPORT:   { label: 'Update Incident',         color: 'al-tag-warning' },
  DELETE_INCIDENT_REPORT:   { label: 'Delete Incident',         color: 'al-tag-danger'  },
};

function alFormatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
}

function alActionTag(action) {
  const info = ACTION_LABELS[action] || { label: action, color: 'al-tag-muted' };
  return `<span class="al-tag ${info.color}">${info.label}</span>`;
}

// ---- Render logs table ----
function renderActivityLogs(logs) {
  const tbody      = document.getElementById('alTableBody');
  const emptyEl    = document.getElementById('alEmpty');
  const totalLabel = document.getElementById('alTotalLabel');

  tbody.innerHTML = '';
  totalLabel.textContent = `${alTotal.toLocaleString()} total log entr${alTotal === 1 ? 'y' : 'ies'}`;

  // Show a warning banner if there are many logs
  const warnBanner = document.getElementById('alLargeLogWarning');
  if (alTotal >= 1000) {
    warnBanner.style.display = 'flex';
    warnBanner.querySelector('.al-warn-count').textContent =
      `${alTotal.toLocaleString()} log entries detected.`;
  } else {
    warnBanner.style.display = 'none';
  }

  if (!logs || logs.length === 0) {
    emptyEl.style.display = 'flex';
    renderAlPagination();
    return;
  }
  emptyEl.style.display = 'none';

  const offset = (alPage - 1) * AL_LIMIT;
  logs.forEach((log, i) => {
    const tr = document.createElement('tr');
    tr.classList.add('al-log-row');
    tr.title = 'Click to view details';
    tr.dataset.log = JSON.stringify(log);
    tr.innerHTML = `
      <td class="al-num">${offset + i + 1}</td>
      <td>
        <div class="al-user-cell">
          <span class="al-avatar">${(log.username || '?').charAt(0).toUpperCase()}</span>
          <span class="al-username">${log.username || '—'}</span>
        </div>
      </td>
      <td>${alActionTag(log.action)}</td>
      <td><span class="al-target">${log.target || '—'}</span></td>
      <td class="al-desc">${log.description || '—'}</td>
      <td class="al-remarks">${log.remarks
        ? `<span class="al-remarks-text">${log.remarks}</span>`
        : '<span class="al-remarks-empty">—</span>'}</td>
      <td class="al-dt">${alFormatDateTime(log.created_at)}</td>
    `;
    tr.addEventListener('click', () => openLogDetail(log));
    tbody.appendChild(tr);
  });

  renderAlPagination();
}

// ---- Pagination ----
function renderAlPagination() {
  const container = document.getElementById('alPagination');
  container.innerHTML = '';
  const totalPages = Math.ceil(alTotal / AL_LIMIT);
  if (totalPages <= 1) return;

  const mkBtn = (label, page, disabled, active) => {
    const btn = document.createElement('button');
    btn.className = `al-page-btn${active ? ' active' : ''}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => { alPage = page; loadActivityLogs(); });
    return btn;
  };

  container.appendChild(mkBtn('‹ Prev', alPage - 1, alPage === 1, false));

  // Window of up to 5 page numbers
  const start = Math.max(1, alPage - 2);
  const end   = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p++) {
    container.appendChild(mkBtn(p, p, false, p === alPage));
  }

  container.appendChild(mkBtn('Next ›', alPage + 1, alPage === totalPages, false));

  const info = document.createElement('span');
  info.className = 'al-page-info';
  info.textContent = `Page ${alPage} of ${totalPages}`;
  container.appendChild(info);
}

// ---- Fetch logs from API ----
async function loadActivityLogs() {
  try {
    const params = new URLSearchParams({
      search: alSearch,
      action: alAction,
      from:   alFrom,
      to:     alTo,
      page:   alPage,
      limit:  AL_LIMIT
    });
    const res  = await fetch(`/api/settings/activity-logs?${params}`);
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Failed to load logs.', 'error'); return; }
    alTotal = data.total || 0;
    renderActivityLogs(data.logs || []);
  } catch {
    showToast('Failed to load activity logs.', 'error');
  }
}

// ---- Filters ----
let alSearchTimer;
document.getElementById('alSearch').addEventListener('input', (e) => {
  clearTimeout(alSearchTimer);
  alSearchTimer = setTimeout(() => {
    alSearch = e.target.value.trim();
    alPage   = 1;
    loadActivityLogs();
  }, 300);
});

document.getElementById('alActionFilter').addEventListener('change', (e) => {
  alAction = e.target.value;
  alPage   = 1;
  loadActivityLogs();
});

document.getElementById('alDateFrom').addEventListener('change', (e) => {
  alFrom = e.target.value;
  alPage = 1;
  loadActivityLogs();
});

document.getElementById('alDateTo').addEventListener('change', (e) => {
  alTo   = e.target.value;
  alPage = 1;
  loadActivityLogs();
});

document.getElementById('alRefresh').addEventListener('click', () => {
  alPage = 1;
  loadActivityLogs();
  showToast('Activity logs refreshed.');
});

// ---- Clear Logs ----
document.getElementById('alClearBtn').addEventListener('click', async () => {
  if (!confirm('Clear ALL activity logs? This cannot be undone.')) return;
  try {
    const res  = await fetch('/api/settings/activity-logs', { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alPage = 1;
      loadActivityLogs();
      showToast('All activity logs cleared.');
    } else {
      showToast(data.error || 'Failed to clear logs.', 'error');
    }
  } catch {
    showToast('Server error.', 'error');
  }
});

// ---- Log Detail Modal ----
// Create modal element once and reuse
const alDetailModal = document.createElement('div');
alDetailModal.className = 'modal-overlay al-detail-overlay';
alDetailModal.id = 'alDetailModal';
alDetailModal.innerHTML = `
  <div class="modal al-detail-modal">
    <div class="al-detail-header">
      <div class="al-detail-title">Log Entry Detail</div>
      <button class="al-detail-close" id="alDetailClose">&times;</button>
    </div>
    <div class="al-detail-body" id="alDetailBody"></div>
  </div>
`;
document.body.appendChild(alDetailModal);

document.getElementById('alDetailClose').addEventListener('click', () => {
  alDetailModal.classList.remove('show');
});
alDetailModal.addEventListener('click', (e) => {
  if (e.target === alDetailModal) alDetailModal.classList.remove('show');
});

function openLogDetail(log) {
  const info  = ACTION_LABELS[log.action] || { label: log.action, color: 'al-tag-muted' };
  const body  = document.getElementById('alDetailBody');

  body.innerHTML = `
    <div class="al-detail-grid">
      <div class="al-detail-row">
        <span class="al-detail-key">User</span>
        <span class="al-detail-val">
          <span class="al-avatar" style="width:26px;height:26px;font-size:11px;margin-right:8px;">
            ${(log.username || '?').charAt(0).toUpperCase()}
          </span>
          ${log.username || '—'}
        </span>
      </div>
      <div class="al-detail-row">
        <span class="al-detail-key">Action</span>
        <span class="al-detail-val"><span class="al-tag ${info.color}">${info.label}</span></span>
      </div>
      <div class="al-detail-row">
        <span class="al-detail-key">Target Table</span>
        <span class="al-detail-val al-mono">${log.target || '—'}</span>
      </div>
      <div class="al-detail-row al-detail-row--full">
        <span class="al-detail-key">Description</span>
        <span class="al-detail-val al-detail-desc">${log.description || '—'}</span>
      </div>
      <div class="al-detail-row al-detail-row--full">
        <span class="al-detail-key">Remarks</span>
        <span class="al-detail-val al-detail-desc ${log.remarks ? '' : 'al-detail-empty'}">${log.remarks || 'No remarks.'}</span>
      </div>
      <div class="al-detail-row">
        <span class="al-detail-key">Date &amp; Time</span>
        <span class="al-detail-val">${alFormatDateTime(log.created_at)}</span>
      </div>
    </div>
  `;
  alDetailModal.classList.add('show');
}

// ---- Export Logs ----
document.getElementById('alExportBtn').addEventListener('click', () => {
  document.getElementById('exportFrom').value = alFrom || '';
  document.getElementById('exportTo').value   = alTo   || '';
  document.getElementById('exportModal').classList.add('show');
});
document.getElementById('exportCancel').addEventListener('click', () => {
  document.getElementById('exportModal').classList.remove('show');
});
document.getElementById('exportModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('exportModal'))
    document.getElementById('exportModal').classList.remove('show');
});
document.getElementById('exportConfirm').addEventListener('click', () => {
  const format = document.getElementById('exportFormat').value;
  const from   = document.getElementById('exportFrom').value;
  const to     = document.getElementById('exportTo').value;

  const params = new URLSearchParams({ format });
  if (from) params.append('from', from);
  if (to)   params.append('to',   to);

  // Trigger download via hidden anchor
  const a = document.createElement('a');
  a.href = `/api/settings/activity-logs/export?${params}`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  document.getElementById('exportModal').classList.remove('show');
  showToast('Export started — check your downloads.');
});

// ---- Archive Logs ----
document.getElementById('alArchiveBtn').addEventListener('click', () => {
  document.getElementById('archiveModal').classList.add('show');
});
document.getElementById('alWarnArchiveBtn').addEventListener('click', () => {
  document.getElementById('archiveModal').classList.add('show');
});
document.getElementById('archiveCancel').addEventListener('click', () => {
  document.getElementById('archiveModal').classList.remove('show');
});
document.getElementById('archiveModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('archiveModal'))
    document.getElementById('archiveModal').classList.remove('show');
});
document.getElementById('archiveConfirm').addEventListener('click', async () => {
  const days = document.getElementById('archiveDays').value;
  try {
    const res  = await fetch('/api/settings/activity-logs/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: parseInt(days) })
    });
    const data = await res.json();
    document.getElementById('archiveModal').classList.remove('show');
    if (res.ok) {
      alPage = 1;
      loadActivityLogs();
      showToast(data.count > 0
        ? `${data.count} old log(s) archived and removed.`
        : 'No logs were old enough to archive.');
    } else {
      showToast(data.error || 'Failed to archive logs.', 'error');
    }
  } catch {
    showToast('Server error.', 'error');
  }
});

// Warning banner buttons
document.getElementById('alWarnExportBtn').addEventListener('click', () => {
  document.getElementById('alExportBtn').click();
});
