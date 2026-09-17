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

async function safeAddColumn(conn, table, column, definition) {
  try {
    const [rows] = await conn.query(
      `SELECT COUNT(*) as c FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (rows[0].c === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`Added column ${table}.${column}`);
    }
  } catch (err) {
    console.error(`Could not add column ${table}.${column}:`, err.message);
  }
}

async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('employee','manager','executive') DEFAULT 'employee',
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        booking_type ENUM('room','wedding') NOT NULL,
        booking_id INT DEFAULT NULL,
        invoice_type ENUM('deposit','final') NOT NULL,
        firstname VARCHAR(100) NOT NULL,
        surname VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        status ENUM('draft','sent','paid') DEFAULT 'draft',
        sent_at DATETIME,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS viewings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        viewing_date DATE NOT NULL,
        viewing_time TIME,
        firstname VARCHAR(100) NOT NULL,
        surname VARCHAR(100) NOT NULL,
        cell VARCHAR(30),
        email VARCHAR(150),
        status ENUM('Scheduled','Completed','Cancelled') DEFAULT 'Scheduled',
        outcome ENUM('Pending','Interested','Booked','Not interested') DEFAULT 'Pending',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff_loans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        person_type ENUM('staff','employee') NOT NULL,
        person_id INT NOT NULL,
        person_name VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        date_given DATE NOT NULL,
        repayment_amount DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2) NOT NULL,
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

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

    // Safe migrations for existing installations
    await safeAddColumn(conn, 'bookings', 'no_payment', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn(conn, 'bookings', 'cancelled', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn(conn, 'wedding_bookings', 'no_payment', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn(conn, 'wedding_bookings', 'cancelled', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn(conn, 'users', 'ta_access', 'TINYINT(1) DEFAULT 0');

    // Migrate role ENUM from ('staff','manager') to ('employee','manager','executive')
    try {
      const [colInfo] = await conn.query(`
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
      `);
      const currentType = colInfo[0]?.COLUMN_TYPE || '';
      if (!currentType.includes('executive')) {
        // Widen the ENUM first so old values remain valid during transition
        await conn.query(`ALTER TABLE users MODIFY COLUMN role ENUM('staff','manager','employee','executive') DEFAULT 'employee'`);
        // Migrate old 'staff' -> 'employee', old 'manager' -> 'executive' (preserve full access for existing managers)
        await conn.query(`UPDATE users SET role = 'employee' WHERE role = 'staff'`);
        await conn.query(`UPDATE users SET role = 'executive' WHERE role = 'manager'`);
        // Narrow the ENUM to final values
        await conn.query(`ALTER TABLE users MODIFY COLUMN role ENUM('employee','manager','executive') DEFAULT 'employee'`);
        console.log('Migrated user roles: staff->employee, manager->executive');
      }
    } catch (err) {
      console.error('Role migration error:', err.message);
    }

    // Set session timezone to SAST (UTC+2)
    await conn.query(`SET time_zone = '+02:00'`);

    const [rows] = await conn.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('manager123', 10);
      await conn.query(
        'INSERT INTO users (name, email, password, role, venue) VALUES (?, ?, ?, ?, ?)',
        ['Manager', 'manager@rivierplaas.co.za', hash, 'manager', 'Both']
      );
      console.log('Default manager account created');
    }
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
// Note: called separately after initDB for T&A tables
async function initTADB() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(30),
        clock_code VARCHAR(10) UNIQUE NOT NULL,
        active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        hours_worked DECIMAL(5,2),
        date DATE NOT NULL,
        notes VARCHAR(255),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);
  } finally {
    conn.release();
  }
}
module.exports = { pool, initDB, initTADB };
