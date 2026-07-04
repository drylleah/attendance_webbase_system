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
  } else {
    document.getElementById('menuDateTime').classList.add('active');
    document.getElementById('sectionDateTime').classList.add('active');
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