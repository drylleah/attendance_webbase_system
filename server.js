const express          = require('express');
const session          = require('express-session');
const path             = require('path');
const authRoutes       = require('./src/routes/auth');
const attendanceRoutes = require('./src/routes/attendance');
const timerecordRoutes = require('./src/routes/timerecord');
const settingsRoutes   = require('./src/routes/settings');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' })); // allow base64 image uploads
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'attendance-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/api/auth',       authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timerecord', timerecordRoutes);
app.use('/api/settings',   settingsRoutes);

app.listen(PORT, () => {
  console.log(`✅ Attendance System running at http://localhost:${PORT}`);
});