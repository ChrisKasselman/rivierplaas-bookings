const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('staff','manager') DEFAULT 'staff',
        venue VARCHAR(50) DEFAULT 'Both',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstname VARCHAR(100) NOT NULL,
        surname VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        cell VARCHAR(30) NOT NULL,
        venue ENUM('Ommidraai','Inniebos','Honeymoon Suite') NOT NULL,
        room INT,
        checkin DATE NOT NULL,
        checkout DATE NOT NULL,
        deposit_paid TINYINT(1) DEFAULT 0,
        fully_paid TINYINT(1) DEFAULT 0,
        no_payment TINYINT(1) DEFAULT 0,
        cancelled TINYINT(1) DEFAULT 0,
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Add columns to existing tables if they don't exist yet
    await conn.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_payment TINYINT(1) DEFAULT 0`).catch(()=>{});
    await conn.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled TINYINT(1) DEFAULT 0`).catch(()=>{});

    await conn.query(`
      CREATE TABLE IF NOT EXISTS wedding_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstname VARCHAR(100) NOT NULL,
        surname VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        cell VARCHAR(30) NOT NULL,
        venue ENUM('Ommidraai Wedding Venue','Inniebos Wedding Venue') NOT NULL,
        event_date DATE NOT NULL,
        event_end_date DATE NOT NULL,
        guests VARCHAR(20) NOT NULL,
        deposit_paid TINYINT(1) DEFAULT 0,
        fully_paid TINYINT(1) DEFAULT 0,
        no_payment TINYINT(1) DEFAULT 0,
        cancelled TINYINT(1) DEFAULT 0,
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Add columns to existing wedding_bookings table if they don't exist yet
    await conn.query(`ALTER TABLE wedding_bookings ADD COLUMN IF NOT EXISTS no_payment TINYINT(1) DEFAULT 0`).catch(()=>{});
    await conn.query(`ALTER TABLE wedding_bookings ADD COLUMN IF NOT EXISTS cancelled TINYINT(1) DEFAULT 0`).catch(()=>{});

    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        user_name VARCHAR(100),
        user_email VARCHAR(150),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INT,
        detail TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await conn.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('manager123', 10);
      await conn.query(
        'INSERT INTO users (name, email, password, role, venue) VALUES (?, ?, ?, ?, ?)',
        ['Manager', 'manager@rivierplaas.co.za', hash, 'manager', 'Both']
      );
      console.log('Default manager account created: manager@rivierplaas.co.za / manager123');
    }
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
