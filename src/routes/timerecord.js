const express = require('express');
const db      = require('../db');
const { logActivity } = require('../logger');
const router  = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized.' });
  next();
}

// ---- GET all time records (search + date range + pagination) ----
router.get('/', requireLogin, async (req, res) => {
  const { search, from, to, month, page = 1, limit = 5 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push('(id_number LIKE ? OR last_name LIKE ? OR first_name LIKE ? OR middle_initial LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (from)  { conditions.push('date >= ?'); params.push(from); }
  if (to)    { conditions.push('date <= ?'); params.push(to);   }
  if (month) { conditions.push('MONTH(date) = ?'); params.push(parseInt(month)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM time_records ${where}`, params
    );
    const [records] = await db.query(
      `SELECT * FROM time_records ${where} ORDER BY date DESC, time_in DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ records, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('GET timerecord error:', err);
    res.status(500).json({ error: 'Failed to fetch records.' });
  }
});

// ---- POST manually add a new time record ----
router.post('/', requireLogin, async (req, res) => {
  const { id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks } = req.body;

  if (!id_number || !last_name || !first_name) {
    return res.status(400).json({ error: 'ID Number, Last Name, and First Name are required.' });
  }

  try {
    const dateStr    = date     || new Date().toISOString().slice(0, 10);
    const timeInStr  = time_in  ? `${dateStr} ${time_in}`  : null;
    const timeOutStr = time_out ? `${dateStr} ${time_out}` : null;

    await db.query(
      `INSERT INTO time_records (id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_number, last_name, first_name, middle_initial || null, timeInStr, timeOutStr, dateStr, remarks || null]
    );
    await logActivity(req, 'ADD_TIME_RECORD', 'time_records',
      `Manually added time record for ${first_name} ${last_name} (${id_number}) on ${dateStr}`,
      remarks || null);
    res.json({ message: 'Entry added successfully.' });
  } catch (err) {
    console.error('POST timerecord error:', err);
    res.status(500).json({ error: 'Failed to add entry.' });
  }
});

// ---- PUT edit a time record ----
router.put('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks } = req.body;

  if (!id_number || !last_name || !first_name) {
    return res.status(400).json({ error: 'ID Number, Last Name, and First Name are required.' });
  }

  try {
    const [oldRows] = await db.query('SELECT * FROM time_records WHERE id = ?', [id]);
    if (!oldRows.length) return res.status(404).json({ error: 'Record not found.' });
    const old = oldRows[0];

    const dateStr    = date     || new Date().toISOString().slice(0, 10);
    const timeInStr  = time_in  ? `${dateStr} ${time_in}`  : null;
    const timeOutStr = time_out ? `${dateStr} ${time_out}` : null;

    await db.query(
      `UPDATE time_records SET id_number=?, last_name=?, first_name=?, middle_initial=?,
       time_in=?, time_out=?, date=?, remarks=? WHERE id=?`,
      [id_number, last_name, first_name, middle_initial || null, timeInStr, timeOutStr, dateStr, remarks || null, id]
    );

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
    if (fmt(old.time_in) !== fmt(timeInStr))
      diffs.push(`time in from ${fmt(old.time_in)} to ${fmt(timeInStr)}`);
    if (fmt(old.time_out) !== fmt(timeOutStr))
      diffs.push(`time out from ${fmt(old.time_out)} to ${fmt(timeOutStr)}`);

    const name = `${first_name} ${last_name} (${id_number})`;
    const desc = diffs.length
      ? `Edited time record for ${name} — ${diffs.join('; ')}`
      : `Edited time record for ${name} (no changes detected)`;

    await logActivity(req, 'EDIT_TIME_RECORD', 'time_records', desc, remarks || null);
    res.json({ message: 'Record updated successfully.' });
  } catch (err) {
    console.error('PUT timerecord error:', err);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

// ---- DELETE a single time record by ID ----
router.delete('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM time_records WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found.' });
    const rec = rows[0];

    await db.query('DELETE FROM time_records WHERE id = ?', [id]);
    await logActivity(req, 'DELETE_TIME_RECORD', 'time_records',
      `Deleted time record for ${rec.first_name} ${rec.last_name} (${rec.id_number}) on ${rec.date}`);
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    console.error('DELETE timerecord/:id error:', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// ---- POST save all current attendance → time_records then clear attendance ----
router.post('/save', requireLogin, async (req, res) => {
  try {
    // Check if there's anything to save
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM attendance');
    if (count === 0) {
      return res.status(400).json({ error: 'No attendance records to save.' });
    }

    // Copy attendance → time_records (carry remarks along)
    await db.query(`
      INSERT INTO time_records (id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks)
      SELECT id_number, last_name, first_name, middle_initial, time_in, time_out, date, remarks
      FROM attendance
    `);

    // Clear attendance table
    await db.query('DELETE FROM attendance');

    await logActivity(req, 'SAVE_TO_TIME_RECORDS', 'time_records',
      `Saved ${count} attendance record(s) to Time Records and cleared the attendance table`);

    res.json({ message: `${count} record(s) saved to Time Records.`, count });
  } catch (err) {
    console.error('SAVE timerecord error:', err);
    res.status(500).json({ error: 'Failed to save records.' });
  }
});

module.exports = router;