/**
 * seed.js — Run ONCE to set up all tables and admin account.
 * Command: node seed.js
 */
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Att@2024#Xz9!';

async function seed() {
  const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'attendance_db'
  });
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin','teacher','student') DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_number VARCHAR(50) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        middle_initial VARCHAR(5),
        time_in DATETIME,
        time_out DATETIME,
        date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS time_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_number VARCHAR(50) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        middle_initial VARCHAR(5),
        time_in DATETIME,
        time_out DATETIME,
        date DATE,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ All tables ready (users, attendance, time_records).');

    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [ADMIN_USERNAME]);
    if (existing.length > 0) {
      console.log('⚠️  Admin already exists. Skipping.');
    } else {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await db.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [ADMIN_USERNAME, hashed, 'admin']);
      console.log('✅ Admin account created!');
      console.log('   Username:', ADMIN_USERNAME);
      console.log('   Password:', ADMIN_PASSWORD);
      console.log('⚠️  Save this password — it will not be shown again.');
    }
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    await db.end();
  }
}
seed();