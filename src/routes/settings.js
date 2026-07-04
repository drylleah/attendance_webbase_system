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

// ---- GET datetime config ----
router.get('/datetime', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        mode,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
        TIME_FORMAT(start_time, '%H:%i:%s') AS start_time,
        DATE_FORMAT(end_date, '%Y-%m-%d')   AS end_date,
        TIME_FORMAT(end_time, '%H:%i:%s')   AS end_time,
        last_triggered_at
      FROM datetime_config WHERE id = 1
    `);
    res.json(rows[0] || { mode: 'automatic' });
  } catch (err) {
    console.error('GET datetime config error:', err);
    res.status(500).json({ error: 'Failed to load date and time settings.' });
  }
});

// ---- PUT update datetime config ----
router.put('/datetime', requireLogin, async (req, res) => {
  const { mode, start_date, start_time, end_date, end_time } = req.body;

  if (!['automatic', 'manual'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode.' });
  }
  if (mode === 'manual' && (!start_date || !start_time || !end_date || !end_time)) {
    return res.status(400).json({ error: 'Start and End date/time are required for Manual mode.' });
  }

  try {
    await db.query(
      `UPDATE datetime_config
       SET mode = ?, start_date = ?, start_time = ?, end_date = ?, end_time = ?, last_triggered_at = NULL
       WHERE id = 1`,
      [mode, start_date || null, start_time || null, end_date || null, end_time || null]
    );
    res.json({ message: 'Date and Time settings saved.' });
  } catch (err) {
    console.error('PUT datetime config error:', err);
    res.status(500).json({ error: 'Failed to save date and time settings.' });
  }
});

// ---- PUT mark manual schedule as triggered (prevents repeat auto-saves) ----
router.put('/datetime/triggered', requireLogin, async (req, res) => {
  try {
    await db.query('UPDATE datetime_config SET last_triggered_at = NOW() WHERE id = 1');
    res.json({ message: 'Marked as triggered.' });
  } catch (err) {
    console.error('PUT datetime triggered error:', err);
    res.status(500).json({ error: 'Failed to update.' });
  }
});

module.exports = router;