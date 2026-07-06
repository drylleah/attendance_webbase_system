const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { logActivity } = require('../logger');
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
    await logActivity(req, 'UPDATE_PROFILE', 'users',
      `Updated profile — name: "${first_name || ''} ${last_name || ''}".trim(), email: "${email || ''}"`);
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
    await logActivity(req, 'UPDATE_AVATAR', 'users', 'Updated profile picture');
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
    await logActivity(req, 'CHANGE_PASSWORD', 'users', 'Changed account password');
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('PUT password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ---- GET activity logs (with search, action filter, date range, pagination) ----
router.get('/activity-logs', requireLogin, async (req, res) => {
  const { search, action, from, to, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push('(username LIKE ? OR description LIKE ? OR ip_address LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (from) { conditions.push('DATE(created_at) >= ?'); params.push(from); }
  if (to)   { conditions.push('DATE(created_at) <= ?'); params.push(to);   }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM activity_logs ${where}`, params
    );
    const [logs] = await db.query(
      `SELECT id, user_id, username, action, target, description, ip_address, created_at
       FROM activity_logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('GET activity-logs error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

// ---- DELETE activity logs (clear all — admin only) ----
router.delete('/activity-logs', requireLogin, async (req, res) => {
  try {
    await db.query('DELETE FROM activity_logs');
    // Log the clear action itself after clearing (fresh entry)
    await logActivity(req, 'CLEAR_ACTIVITY_LOGS', 'activity_logs', 'Cleared all activity logs');
    res.json({ message: 'Activity logs cleared.' });
  } catch (err) {
    console.error('DELETE activity-logs error:', err);
    res.status(500).json({ error: 'Failed to clear logs.' });
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
    const dtDesc = mode === 'manual'
      ? `Set Date/Time to Manual mode — start: ${start_date} ${start_time}, end: ${end_date} ${end_time}`
      : 'Set Date/Time to Automatic mode';
    await logActivity(req, 'UPDATE_DATETIME_CONFIG', 'datetime_config', dtDesc);
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