const express = require('express');
const db      = require('../db');
const { logActivity } = require('../logger');
const router  = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized.' });
  next();
}

// ---- GET all incident reports (with filters and pagination) ----
router.get('/', requireLogin, async (req, res) => {
  const { search, status, from, to, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push('(subject_name LIKE ? OR subject_id_no LIKE ? OR description LIKE ? OR reporter_name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (from) { conditions.push('DATE(created_at) >= ?'); params.push(from); }
  if (to)   { conditions.push('DATE(created_at) <= ?'); params.push(to);   }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM incident_reports ${where}`, params
    );
    const [reports] = await db.query(
      `SELECT * FROM incident_reports ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('GET incidents error:', err);
    res.status(500).json({ error: 'Failed to fetch incident reports.' });
  }
});

// ---- POST create new incident report ----
router.post('/', requireLogin, async (req, res) => {
  const { subject_id_no, subject_name, incident_date, incident_type, description, remarks } = req.body;

  if (!subject_name || !description) {
    return res.status(400).json({ error: 'Subject name and description are required.' });
  }

  try {
    const reporterName = req.session.username || 'unknown';
    
    await db.query(
      `INSERT INTO incident_reports 
       (reported_by, reporter_name, subject_id_no, subject_name, incident_date, incident_type, description, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [req.session.userId, reporterName, subject_id_no || null, subject_name, 
       incident_date || null, incident_type || 'General', description, remarks || null]
    );

    await logActivity(req, 'CREATE_INCIDENT_REPORT', 'incident_reports',
      `Created incident report for ${subject_name}${subject_id_no ? ' (' + subject_id_no + ')' : ''}`,
      `Type: ${incident_type || 'General'}; Date: ${incident_date || 'N/A'}`);

    res.json({ message: 'Incident report submitted successfully.' });
  } catch (err) {
    console.error('POST incident error:', err);
    res.status(500).json({ error: 'Failed to submit incident report.' });
  }
});

// ---- PUT update incident report status/remarks ----
router.put('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (!status && !remarks) {
    return res.status(400).json({ error: 'Status or remarks must be provided.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM incident_reports WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Incident report not found.' });

    const updates = [];
    const params  = [];

    if (status && ['open', 'under_review', 'resolved', 'dismissed'].includes(status)) {
      updates.push('status = ?');
      params.push(status);
    }
    if (remarks !== undefined) {
      updates.push('remarks = ?');
      params.push(remarks);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    params.push(id);
    await db.query(
      `UPDATE incident_reports SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    await logActivity(req, 'UPDATE_INCIDENT_REPORT', 'incident_reports',
      `Updated incident report #${id} for ${rows[0].subject_name}`,
      status ? `Status changed to: ${status}` : 'Remarks updated');

    res.json({ message: 'Incident report updated successfully.' });
  } catch (err) {
    console.error('PUT incident error:', err);
    res.status(500).json({ error: 'Failed to update incident report.' });
  }
});

// ---- DELETE incident report ----
router.delete('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM incident_reports WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Incident report not found.' });

    await db.query('DELETE FROM incident_reports WHERE id = ?', [id]);
    await logActivity(req, 'DELETE_INCIDENT_REPORT', 'incident_reports',
      `Deleted incident report #${id} for ${rows[0].subject_name}`);

    res.json({ message: 'Incident report deleted.' });
  } catch (err) {
    console.error('DELETE incident error:', err);
    res.status(500).json({ error: 'Failed to delete incident report.' });
  }
});

// ---- GET single incident report by ID ----
router.get('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM incident_reports WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Incident report not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET incident/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch incident report.' });
  }
});

module.exports = router;
