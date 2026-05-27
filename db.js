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
        venue ENUM('Ommidraai','Inniebos') NOT NULL,
        room INT NOT NULL,
        checkin DATE NOT NULL,
        checkout DATE NOT NULL,
        deposit_paid TINYINT(1) DEFAULT 0,
        fully_paid TINYINT(1) DEFAULT 0,
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
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
