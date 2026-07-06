const express          = require('express');
const session          = require('express-session');
const path             = require('path');
const db               = require('./src/db');
const authRoutes       = require('./src/routes/auth');
const attendanceRoutes = require('./src/routes/attendance');
const timerecordRoutes = require('./src/routes/timerecord');
const settingsRoutes   = require('./src/routes/settings');
const incidentsRoutes  = require('./src/routes/incidents');
const rfidRoutes       = require('./src/routes/rfid');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(express.json({ limit: '5mb' })); // allow base64 image uploads
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'attendance-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// ---- Routes ----
app.use('/api/auth',       authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timerecord', timerecordRoutes);
app.use('/api/settings',   settingsRoutes);
app.use('/api/incidents',  incidentsRoutes);
app.use('/api/rfid',       rfidRoutes);

// ---- Ensure required tables exist, then start server ----
async function ensureTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT,
        username    VARCHAR(100),
        action      VARCHAR(100) NOT NULL,
        target      VARCHAR(100),
        description TEXT,
        remarks     TEXT,
        ip_address  VARCHAR(45),
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_user_id    (user_id)
      )
    `);
    console.log('✅ activity_logs table ready.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS incident_reports (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        reported_by     INT,
        reporter_name   VARCHAR(100),
        subject_id_no   VARCHAR(50),
        subject_name    VARCHAR(255) NOT NULL,
        incident_date   DATE,
        incident_type   VARCHAR(100),
        description     TEXT NOT NULL,
        status          ENUM('open','under_review','resolved','dismissed') DEFAULT 'open',
        remarks         TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status     (status),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ incident_reports table ready.');
  } catch (err) {
    console.error('❌ Failed to ensure tables:', err.message);
  }
}

ensureTables().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Attendance System running at http://localhost:${PORT}`);
  });
});
