const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const router  = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized.' });
  next();
}

// ---- GET profile ----
router.get('/profile', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT username, first_name, last_name, email, profile_pic FROM users WHERE id = ?',
      [req.session.userId]
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error('GET profile error:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// ---- PUT update profile (first_name, last_name, email) ----
router.put('/profile', requireLogin, async (req, res) => {
  const { first_name, last_name, email } = req.body;
  try {
    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
      [first_name || null, last_name || null, email || null, req.session.userId]
    );
    // Update session username display if first_name changed
    if (first_name) req.session.firstName = first_name;
    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('PUT profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ---- PUT update avatar (base64) ----
router.put('/avatar', requireLogin, async (req, res) => {
  const { profile_pic } = req.body;
  try {
    await db.query(
      'UPDATE users SET profile_pic = ? WHERE id = ?',
      [profile_pic || null, req.session.userId]
    );
    res.json({ message: 'Profile picture updated.' });
  } catch (err) {
    console.error('PUT avatar error:', err);
    res.status(500).json({ error: 'Failed to update profile picture.' });
  }
});

// ---- PUT change password ----
router.put('/password', requireLogin, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both fields are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.session.userId]);
    const match  = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.userId]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('PUT password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;