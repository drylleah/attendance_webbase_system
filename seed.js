/**
 * seed.js — Run to set up all tables, columns, and admin account.
 * Safe to run multiple times.
 * Command: node seed.js
 */
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Att@2024#Xz9!';

async function addColumnIfMissing(db, table, column, definition) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  + Added column: ${column}`);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') { /* already exists, skip */ }
    else throw err;
  }
}

async function seed() {
  const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'attendance_db'
  });
  try {
    // ---- Tables ----
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
    await db.execute(`
      CREATE TABLE IF NOT EXISTS datetime_config (
        id INT PRIMARY KEY DEFAULT 1,
        mode ENUM('automatic','manual') DEFAULT 'automatic',
        start_date DATE,
        start_time TIME,
        end_date DATE,
        end_time TIME,
        last_triggered_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Ensure a single config row always exists
    await db.execute(`INSERT IGNORE INTO datetime_config (id, mode) VALUES (1, 'automatic')`);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT,
        username    VARCHAR(100),
        action      VARCHAR(100) NOT NULL,
        target      VARCHAR(100),
        description TEXT,
        ip_address  VARCHAR(45),
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_user_id    (user_id)
      )
    `);

    console.log('✅ Core tables ready.');

    // ---- Add profile columns to users if missing ----
    await addColumnIfMissing(db, 'users', 'first_name',  'VARCHAR(100) DEFAULT NULL');
    await addColumnIfMissing(db, 'users', 'last_name',   'VARCHAR(100) DEFAULT NULL');
    await addColumnIfMissing(db, 'users', 'email',       'VARCHAR(255) DEFAULT NULL');
    await addColumnIfMissing(db, 'users', 'profile_pic', 'MEDIUMTEXT DEFAULT NULL');
    console.log('✅ Profile columns ready.');

    // ---- Seed admin ----
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [ADMIN_USERNAME]);
    if (existing.length > 0) {
      // Update default email if not set
      await db.execute(
        'UPDATE users SET email = ? WHERE username = ? AND (email IS NULL OR email = "")',
        ['admin@lorma.edu', ADMIN_USERNAME]
      );
      console.log('⚠️  Admin already exists. Skipping creation.');
    } else {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await db.execute(
        'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
        [ADMIN_USERNAME, hashed, 'admin', 'admin@lorma.edu']
      );
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