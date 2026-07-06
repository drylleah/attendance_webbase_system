const express = require('express');
const db = require('../db');
const { logActivity } = require('../logger');
const router = express.Router();

// ---- Auth middleware ----
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}

// ---- GET all attendance (with optional search) ----
router.get('/', requireLogin, async (req, res) => {
  const { search } = req.query;
  try {
    let query = `SELECT * FROM attendance`;
    let params = [];

    if (search) {
      query += ` WHERE
        id_number   LIKE ? OR
        last_name   LIKE ? OR
        first_name  LIKE ? OR
        middle_initial LIKE ?`;
      const like = `%${search}%`;
      params = [like, like, like, like];
    }

    query += ` ORDER BY time_in DESC`;
    const [rows] = await db.query(query, params);
    res.json({ records: rows });
  } catch (err) {
    console.error('GET attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch records.' });
  }
});

// ---- POST new attendance record ----
router.post('/', requireLogin, async (req, res) => {
  const { id_number, last_name, first_name, middle_initial, time_in, time_out, date } = req.body;

  if (!id_number || !last_name || !first_name) {
    return res.status(400).json({ error: 'ID Number, Last Name, and First Name are required.' });
  }

  try {
    // Combine date + time_in into a datetime string
    const dateStr      = date || new Date().toISOString().slice(0, 10);
    const timeInStr     = time_in || new Date().toTimeString().slice(0, 8);
    const timeInDate    = `${dateStr} ${timeInStr}`;
    const timeOutDate   = time_out ? `${dateStr} ${time_out}` : null;

    await db.query(
      `INSERT INTO attendance (id_number, last_name, first_name, middle_initial, time_in, time_out, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_number, last_name, first_name, middle_initial || null, timeInDate, timeOutDate, dateStr]
    );
    await logActivity(req, 'ADD_ATTENDANCE', 'attendance',
      `Added attendance record for ${first_name} ${last_name} (${id_number}) on ${dateStr}`);
    res.json({ message: 'Record added successfully.' });
  } catch (err) {
    console.error('POST attendance error:', err);
    res.status(500).json({ error: 'Failed to add record.' });
  }
});

// ---- PUT edit an attendance record ----
router.put('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { id_number, last_name, first_name, middle_initial, time_in, time_out, date } = req.body;

  if (!id_number || !last_name || !first_name) {
    return res.status(400).json({ error: 'ID Number, Last Name, and First Name are required.' });
  }

  try {
    // Fetch old values for diff
    const [oldRows] = await db.query('SELECT * FROM attendance WHERE id = ?', [id]);
    if (!oldRows.length) return res.status(404).json({ error: 'Record not found.' });
    const old = oldRows[0];

    const dateStr    = date    || new Date().toISOString().slice(0, 10);
    const timeInDate  = time_in  ? `${dateStr} ${time_in}`  : null;
    const timeOutDate = time_out ? `${dateStr} ${time_out}` : null;

    await db.query(
      `UPDATE attendance SET id_number=?, last_name=?, first_name=?, middle_initial=?,
       time_in=?, time_out=?, date=? WHERE id=?`,
      [id_number, last_name, first_name, middle_initial || null, timeInDate, timeOutDate, dateStr, id]
    );

    // Build human-readable diff
    const fmt = (dt) => {
      if (!dt) return '—';
      const d = new Date(dt);
      return isNaN(d) ? String(dt) : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const diffs = [];
    if (String(old.id_number) !== String(id_number))
      diffs.push(`ID from "${old.id_number}" to "${id_number}"`);
    if ((old.last_name || '') !== last_name)
      diffs.push(`last name from "${old.last_name || ''}" to "${last_name}"`);
    if ((old.first_name || '') !== first_name)
      diffs.push(`first name from "${old.first_name || ''}" to "${first_name}"`);
    if ((old.middle_initial || '') !== (middle_initial || ''))
      diffs.push(`middle initial from "${old.middle_initial || ''}" to "${middle_initial || ''}"`);
    if (fmt(old.time_in) !== fmt(timeInDate))
      diffs.push(`time in from ${fmt(old.time_in)} to ${fmt(timeInDate)}`);
    if (fmt(old.time_out) !== fmt(timeOutDate))
      diffs.push(`time out from ${fmt(old.time_out)} to ${fmt(timeOutDate)}`);

    const name = `${first_name} ${last_name} (${id_number})`;
    const desc = diffs.length
      ? `Edited attendance for ${name} — ${diffs.join('; ')}`
      : `Edited attendance for ${name} (no changes detected)`;

    await logActivity(req, 'EDIT_ATTENDANCE', 'attendance', desc);
    res.json({ message: 'Record updated successfully.' });
  } catch (err) {
    console.error('PUT attendance error:', err);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

// ---- DELETE selected records by IDs ----
router.delete('/', requireLogin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided.' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    await db.query(`DELETE FROM attendance WHERE id IN (${placeholders})`, ids);
    await logActivity(req, 'DELETE_ATTENDANCE', 'attendance',
      `Deleted ${ids.length} attendance record(s) (IDs: ${ids.join(', ')})`);
    res.json({ message: 'Records deleted.' });
  } catch (err) {
    console.error('DELETE attendance error:', err);
    res.status(500).json({ error: 'Failed to delete records.' });
  }
});

// ---- CLEAR all records ----
router.delete('/clear', requireLogin, async (req, res) => {
  try {
    await db.query('DELETE FROM attendance');
    await logActivity(req, 'CLEAR_ATTENDANCE', 'attendance', 'Cleared all attendance records');
    res.json({ message: 'All records cleared.' });
  } catch (err) {
    console.error('CLEAR attendance error:', err);
    res.status(500).json({ error: 'Failed to clear records.' });
  }
});

module.exports = router;