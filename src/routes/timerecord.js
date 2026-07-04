const express = require('express');
const db      = require('../db');
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
  const { id_number, last_name, first_name, middle_initial, time_in, time_out, date } = req.body;

  if (!id_number || !last_name || !first_name) {
    return res.status(400).json({ error: 'ID Number, Last Name, and First Name are required.' });
  }

  try {
    const dateStr    = date     || new Date().toISOString().slice(0, 10);
    const timeInStr  = time_in  ? `${dateStr} ${time_in}`  : null;
    const timeOutStr = time_out ? `${dateStr} ${time_out}` : null;

    await db.query(
      `INSERT INTO time_records (id_number, last_name, first_name, middle_initial, time_in, time_out, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_number, last_name, first_name, middle_initial || null, timeInStr, timeOutStr, dateStr]
    );
    res.json({ message: 'Entry added successfully.' });
  } catch (err) {
    console.error('POST timerecord error:', err);
    res.status(500).json({ error: 'Failed to add entry.' });
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

    // Copy attendance → time_records
    await db.query(`
      INSERT INTO time_records (id_number, last_name, first_name, middle_initial, time_in, time_out, date)
      SELECT id_number, last_name, first_name, middle_initial, time_in, time_out, date
      FROM attendance
    `);

    // Clear attendance table
    await db.query('DELETE FROM attendance');

    res.json({ message: `${count} record(s) saved to Time Records.`, count });
  } catch (err) {
    console.error('SAVE timerecord error:', err);
    res.status(500).json({ error: 'Failed to save records.' });
  }
});

module.exports = router;