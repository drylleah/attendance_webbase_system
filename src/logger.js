/**
 * logger.js — Activity log helper
 * Call logActivity(req, action, target, description, remarks) from any route.
 */
const db = require('./db');

/**
 * @param {import('express').Request} req
 * @param {string} action   — e.g. 'ADD_ATTENDANCE', 'DELETE_RECORDS'
 * @param {string} target   — which table / resource, e.g. 'attendance', 'time_records'
 * @param {string} description — human-readable summary
 * @param {string} remarks  — optional additional notes or context
 */
async function logActivity(req, action, target, description, remarks = null) {
  try {
    const userId   = req.session?.userId   || null;
    const username = req.session?.username || 'unknown';
    const ip       = req.headers['x-forwarded-for']?.split(',')[0].trim()
                     || req.socket?.remoteAddress
                     || null;

    await db.query(
      `INSERT INTO activity_logs (user_id, username, action, target, description, remarks, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, target || null, description || null, remarks, ip]
    );
  } catch (err) {
    // Logging must never crash the main request
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
