const mysql = require('mysql2/promise');

// ---- MySQL Connection Pool 
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',           
  database: 'attendance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Connected to MySQL database.');
    conn.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
})();

module.exports = pool;