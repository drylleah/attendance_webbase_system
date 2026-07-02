const express = require('express');
const db = require('../db');
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
  const { id_number, last_name, first_name, middle_initial, time_in, date } = req.body;

  if (!id_number || !last_name || !first_name) {
    return res.status(400).json({ error: 'ID Number, Last Name, and First Name are required.' });
  }

  try {
    // Combine date + time_in into a datetime string
    const dateStr  = date || new Date().toISOString().slice(0, 10);
    const timeStr  = time_in || new Date().toTimeString().slice(0, 8);
    const datetime = `${dateStr} ${timeStr}`;

    await db.query(
      `INSERT INTO attendance (id_number, last_name, first_name, middle_initial, time_in, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_number, last_name, first_name, middle_initial || null, datetime, dateStr]
    );
    res.json({ message: 'Record added successfully.' });
  } catch (err) {
    console.error('POST attendance error:', err);
    res.status(500).json({ error: 'Failed to add record.' });
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
    res.json({ message: 'All records cleared.' });
  } catch (err) {
    console.error('CLEAR attendance error:', err);
    res.status(500).json({ error: 'Failed to clear records.' });
  }
});

module.exports = router;