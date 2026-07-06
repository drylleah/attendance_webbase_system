const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { logActivity } = require('../logger');

const router = express.Router();

// ---- Login ----
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username at password ay required.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Save session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    await logActivity(req, 'LOGIN', 'users', `User "${user.username}" logged in`);

    res.json({
      message: 'Login successful.',
      user: { username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '' });
  }
});

// ---- Logout ----
router.post('/logout', (req, res) => {
  const username = req.session?.username || 'unknown';
  const userId   = req.session?.userId   || null;
  req.session.destroy(async () => {
    // Build a minimal req-like object since session is gone
    await logActivity(
      { session: { userId, username }, headers: req.headers, socket: req.socket },
      'LOGOUT', 'users', `User "${username}" logged out`
    );
    res.json({ message: 'Logged out successfully.' });
  });
});

// ---- Check Session ----
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    username: req.session.username,
    role: req.session.role
  });
});

module.exports = router;