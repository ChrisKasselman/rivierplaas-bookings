const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireManager } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.get('/admin', requireManager, async (req, res) => {
  const [staff] = await pool.query('SELECT id, name, email, role, venue, created_at FROM users ORDER BY role DESC, name ASC');

  // Today's room occupancy
  const [ommi] = await pool.query('SELECT room, firstname, surname FROM bookings WHERE venue="Ommidraai" AND checkin<=CURDATE() AND checkout>CURDATE()');
  const [innie] = await pool.query('SELECT room, firstname, surname FROM bookings WHERE venue="Inniebos" AND checkin<=CURDATE() AND checkout>CURDATE()');
  const [honey] = await pool.query('SELECT room, firstname, surname FROM bookings WHERE venue="Honeymoon Suite" AND checkin<=CURDATE() AND checkout>CURDATE()');

  // Today's wedding venue occupancy
  const [ommiWed] = await pool.query('SELECT firstname, surname, guests FROM wedding_bookings WHERE venue="Ommidraai Wedding Venue" AND event_date<=CURDATE() AND event_end_date>=CURDATE()');
  const [innieWed] = await pool.query('SELECT firstname, surname, guests FROM wedding_bookings WHERE venue="Inniebos Wedding Venue" AND event_date<=CURDATE() AND event_end_date>=CURDATE()');

  const ommiMap = {}, innieMap = {}, honeyMap = {};
  ommi.forEach(b => { ommiMap[b.room] = `${b.firstname} ${b.surname}`; });
  innie.forEach(b => { innieMap[b.room] = `${b.firstname} ${b.surname}`; });
  honey.forEach(b => { honeyMap[b.room] = `${b.firstname} ${b.surname}`; });

  res.render('admin/panel', { user: req.session.user, staff, ommiMap, innieMap, honeyMap, ommiWed, innieWed });
});

router.get('/admin/staff/new', requireManager, (req, res) => {
  res.render('admin/staff-form', { user: req.session.user, staff: null, error: null });
});

router.post('/admin/staff/new', requireManager, async (req, res) => {
  const { name, email, password, role, venue } = req.body;
  if (!name || !email || !password) {
    return res.render('admin/staff-form', { user: req.session.user, staff: req.body, error: 'All fields are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (name, email, password, role, venue) VALUES (?,?,?,?,?)', [name, email.toLowerCase(), hash, role, venue]);
    await auditLog(req, 'CREATE_STAFF', 'user', result.insertId, `Created staff account: ${name} (${email}) — ${role}`);
    res.redirect('/admin');
  } catch (err) {
    res.render('admin/staff-form', { user: req.session.user, staff: req.body, error: 'Email already exists or error saving.' });
  }
});

router.get('/admin/staff/:id/edit', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!rows.length) return res.redirect('/admin');
  res.render('admin/staff-form', { user: req.session.user, staff: rows[0], error: null });
});

router.post('/admin/staff/:id/edit', requireManager, async (req, res) => {
  const { name, email, role, venue, password } = req.body;
  if (password && password.trim().length > 0) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET name=?,email=?,role=?,venue=?,password=? WHERE id=?', [name, email.toLowerCase(), role, venue, hash, req.params.id]);
  } else {
    await pool.query('UPDATE users SET name=?,email=?,role=?,venue=? WHERE id=?', [name, email.toLowerCase(), role, venue, req.params.id]);
  }
  await auditLog(req, 'EDIT_STAFF', 'user', req.params.id, `Edited staff account: ${name} (${email}) — ${role}`);
  res.redirect('/admin');
});

router.post('/admin/staff/:id/delete', requireManager, async (req, res) => {
  if (parseInt(req.params.id) === req.session.user.id) return res.redirect('/admin');
  const [rows] = await pool.query('SELECT name, email FROM users WHERE id=?', [req.params.id]);
  if (rows.length) {
    await auditLog(req, 'DELETE_STAFF', 'user', req.params.id, `Deleted staff account: ${rows[0].name} (${rows[0].email})`);
  }
  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.redirect('/admin');
});

// ─── Audit Log ───────────────────────────────────────────────────────────────

router.get('/admin/audit', requireManager, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  const [logs] = await pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM audit_log');
  const pages = Math.ceil(total / limit);
  res.render('admin/audit', { user: req.session.user, logs, page, pages, total });
});

module.exports = router;

// ─── Full data backup ─────────────────────────────────────────────────────────

const archiver = require('archiver');

router.get('/admin/backup', requireManager, async (req, res) => {
  try {
    const { stringify } = require('csv-stringify/sync');

    const [bookings] = await pool.query('SELECT * FROM bookings ORDER BY checkin DESC');
    const [weddings] = await pool.query('SELECT * FROM wedding_bookings ORDER BY event_date DESC');
    const [employees] = await pool.query('SELECT * FROM employees ORDER BY name');
    const [attendance] = await pool.query(`
      SELECT a.*, e.name as emp_name, e.phone as emp_phone
      FROM attendance a JOIN employees e ON a.employee_id = e.id
      ORDER BY a.date DESC
    `);
    const [users] = await pool.query('SELECT id, name, email, role, venue, created_at FROM users ORDER BY name');
    const [auditlogs] = await pool.query('SELECT * FROM audit_log ORDER BY created_at DESC');

    const fmt = (rows, fields) => stringify(rows.map(r => {
      const obj = {};
      fields.forEach(f => {
        let v = r[f];
        if (v instanceof Date) v = v.toISOString().replace('T', ' ').substring(0, 19);
        obj[f] = v ?? '';
      });
      return obj;
    }), { header: true });

    const bookingsCSV = fmt(bookings, ['id','firstname','surname','email','cell','venue','room','checkin','checkout','deposit_paid','fully_paid','no_payment','cancelled','notes','created_at']);
    const weddingsCSV = fmt(weddings, ['id','firstname','surname','email','cell','venue','event_date','event_end_date','guests','deposit_paid','fully_paid','no_payment','cancelled','notes','created_at']);
    const employeesCSV = fmt(employees, ['id','name','phone','clock_code','active','created_at']);
    const attendanceCSV = fmt(attendance, ['id','emp_name','emp_phone','date','clock_in','clock_out','hours_worked']);
    const usersCSV = fmt(users, ['id','name','email','role','venue','created_at']);
    const auditCSV = fmt(auditlogs, ['id','user_name','user_email','action','entity_type','entity_id','detail','ip_address','created_at']);

    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="rivierplaas-backup-${dateStr}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(bookingsCSV,   { name: 'room-bookings.csv' });
    archive.append(weddingsCSV,   { name: 'wedding-bookings.csv' });
    archive.append(employeesCSV,  { name: 'employees.csv' });
    archive.append(attendanceCSV, { name: 'attendance.csv' });
    archive.append(usersCSV,      { name: 'staff-users.csv' });
    archive.append(auditCSV,      { name: 'audit-log.csv' });
    archive.finalize();

  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).send('Backup failed. Please try again.');
  }
});
