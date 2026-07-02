// ============================================
//  app.js — Frontend Logic
//  Handles login form, API calls, session check
// ============================================

const loginCard     = document.getElementById('loginCard');
const dashCard      = document.getElementById('dashCard');
const loginForm     = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePwBtn   = document.getElementById('togglePw');
const errorMsg      = document.getElementById('errorMsg');
const signinBtn     = document.getElementById('signinBtn');
const btnText       = document.getElementById('btnText');
const btnIcon       = document.getElementById('btnIcon');
const dashName      = document.getElementById('dashName');
const logoutBtn     = document.getElementById('logoutBtn');

// ---- Toggle Password Visibility ----
togglePwBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';

  // Swap icon
  togglePwBtn.innerHTML = isPassword
    ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>`;
});

// ---- Show Error ----
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('show');
}

function hideError() {
  errorMsg.classList.remove('show');
}

// ---- Set Button Loading State ----
function setLoading(loading) {
  signinBtn.disabled = loading;

  if (loading) {
    btnText.textContent = 'Signing in...';
    btnIcon.innerHTML = '<div class="spinner"></div>';
  } else {
    btnText.textContent = 'Sign In';
    btnIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>`;
  }
}

// ---- Show Dashboard ----
function showDashboard(username) {
  loginCard.classList.add('hidden');
  dashCard.classList.add('active');
  dashName.textContent = username;
}

// ---- Show Login ----
function showLogin() {
  dashCard.classList.remove('active');
  loginCard.classList.remove('hidden');

  usernameInput.value = '';
  passwordInput.value = '';

  hideError();
}

// ---- Login Submit ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError('Please fill in all fields.');
    return;
  }

  setLoading(true);

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
      window.location.href = "/dashboard.html";
    } else {
      showError(data.error || 'Invalid username or password.');
    }
  } catch (err) {
    showError('Unable to connect to the server. Please try again.');
  } finally {
    setLoading(false);
  }
});

// ---- Logout ----
logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', {
    method: 'POST'
  });

  showLogin();
});

// ---- Check Session on Page Load ----
(async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.loggedIn) {
      window.location.href = "/dashboard.html";
    }
  } catch {
    // User is not logged in — display the login page by default.
  }
})();