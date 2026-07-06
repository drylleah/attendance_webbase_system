/**
 * rfid.js — Routes for RFID scanning and student registration.
 *
 * The student's School ID Number IS the identifier on the RFID card.
 * No separate card_id column — id_number is the primary lookup key.
 *
 * PUBLIC  (no login required):
 *   POST /api/rfid/scan              — process a scan (time-in / time-out)
 *
 * PROTECTED (admin login required):
 *   GET    /api/rfid/cards           — list all registered students
 *   POST   /api/rfid/cards           — register a student
 *   PUT    /api/rfid/cards/:idNumber — update student info / active state
 *   DELETE /api/rfid/cards/:idNumber — remove a student
 */

const express = require('express');
const db      = require('../db');
const router  = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized.' });
  next();
}

function normalise(val) {
  return String(val || '').trim().toUpperCase().replace(/\s+/g, '');
}

// =====================================================================
//  PUBLIC — POST /api/rfid/scan
//  Body: { id_number: "2023-0505" }
// =====================================================================
router.post('/scan', async (req, res) => {
  const idNumber = normalise(req.body.id_number);

  if (!idNumber) {
    return res.status(400).json({ error: 'id_number is required.' });
  }

  try {
    // 1. Look up the student
    const [rows] = await db.query(
      'SELECT * FROM rfid_cards WHERE id_number = ?',
      [idNumber]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'ID not registered. Please register this ID first.',
        id_number: idNumber
      });
    }

    const student = rows[0];

    if (!student.is_active) {
      return res.status(403).json({
        error: 'This ID has been deactivated.',
        id_number: idNumber
      });
    }

    const { last_name, first_name, middle_initial } = student;
    const todayStr = new Date().toISOString().slice(0, 10);

    // 2. Time-in or time-out?
    const [openRows] = await db.query(
      `SELECT id FROM attendance
       WHERE id_number = ? AND date = ? AND time_out IS NULL
       ORDER BY time_in DESC LIMIT 1`,
      [idNumber, todayStr]
    );

    let action, attendanceId, timeValue;

    if (openRows.length) {
      // Already timed-in today → record time_out
      const now          = new Date();
      const timeOutDatetime = `${todayStr} ${now.toTimeString().slice(0, 8)}`;

      await db.query(
        'UPDATE attendance SET time_out = ? WHERE id = ?',
        [timeOutDatetime, openRows[0].id]
      );

      action       = 'time_out';
      attendanceId = openRows[0].id;
      timeValue    = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } else {
      // No open record → record time_in
      const now         = new Date();
      const timeInDatetime = `${todayStr} ${now.toTimeString().slice(0, 8)}`;

      const [result] = await db.query(
        `INSERT INTO attendance (id_number, last_name, first_name, middle_initial, time_in, date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idNumber, last_name, first_name, middle_initial || null, timeInDatetime, todayStr]
      );

      action       = 'time_in';
      attendanceId = result.insertId;
      timeValue    = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    return res.json({
      success: true,
      action,
      attendance_id: attendanceId,
      id_number:     idNumber,
      last_name,
      first_name,
      middle_initial,
      full_name: `${first_name}${middle_initial ? ' ' + middle_initial + '.' : ''} ${last_name}`,
      time: timeValue,
      date: todayStr
    });

  } catch (err) {
    console.error('RFID scan error:', err);
    res.status(500).json({ error: 'Server error during scan.' });
  }
});

// =====================================================================
//  PROTECTED — GET /api/rfid/cards
// =====================================================================
router.get('/cards', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM rfid_cards ORDER BY registered_at DESC'
    );
    res.json({ cards: rows, total: rows.length });
  } catch (err) {
    console.error('GET cards error:', err);
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

// =====================================================================
//  PROTECTED — POST /api/rfid/cards
//  Body: { id_number, last_name, first_name, middle_initial? }
// =====================================================================
router.post('/cards', requireLogin, async (req, res) => {
  const { last_name, first_name, middle_initial } = req.body;
  const idNumber = normalise(req.body.id_number);

  if (!idNumber || !last_name || !first_name) {
    return res.status(400).json({
      error: 'id_number, last_name, and first_name are all required.'
    });
  }

  try {
    await db.query(
      `INSERT INTO rfid_cards (id_number, last_name, first_name, middle_initial)
       VALUES (?, ?, ?, ?)`,
      [idNumber, last_name.trim(), first_name.trim(), middle_initial?.trim() || null]
    );
    res.json({ message: 'Student registered successfully.', id_number: idNumber });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `ID "${idNumber}" is already registered.` });
    }
    console.error('POST card error:', err);
    res.status(500).json({ error: 'Failed to register student.' });
  }
});

// =====================================================================
//  PROTECTED — PUT /api/rfid/cards/:idNumber
// =====================================================================
router.put('/cards/:idNumber', requireLogin, async (req, res) => {
  const idNumber = normalise(req.params.idNumber);
  const { last_name, first_name, middle_initial, is_active } = req.body;

  try {
    const [rows] = await db.query('SELECT id FROM rfid_cards WHERE id_number = ?', [idNumber]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found.' });

    const updates = [];
    const params  = [];

    if (last_name      !== undefined) { updates.push('last_name = ?');      params.push(last_name.trim()); }
    if (first_name     !== undefined) { updates.push('first_name = ?');     params.push(first_name.trim()); }
    if (middle_initial !== undefined) { updates.push('middle_initial = ?'); params.push(middle_initial?.trim() || null); }
    if (is_active      !== undefined) { updates.push('is_active = ?');      params.push(is_active ? 1 : 0); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

    params.push(idNumber);
    await db.query(`UPDATE rfid_cards SET ${updates.join(', ')} WHERE id_number = ?`, params);
    res.json({ message: 'Student updated.' });
  } catch (err) {
    console.error('PUT card error:', err);
    res.status(500).json({ error: 'Failed to update student.' });
  }
});

// =====================================================================
//  PROTECTED — DELETE /api/rfid/cards/:idNumber
// =====================================================================
router.delete('/cards/:idNumber', requireLogin, async (req, res) => {
  const idNumber = normalise(req.params.idNumber);
  try {
    const [rows] = await db.query('SELECT id FROM rfid_cards WHERE id_number = ?', [idNumber]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found.' });

    await db.query('DELETE FROM rfid_cards WHERE id_number = ?', [idNumber]);
    res.json({ message: 'Student removed.' });
  } catch (err) {
    console.error('DELETE card error:', err);
    res.status(500).json({ error: 'Failed to remove student.' });
  }
});

module.exports = router;
