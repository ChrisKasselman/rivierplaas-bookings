const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireManager, requireTA } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { stringify } = require('csv-stringify/sync');

// SAST = UTC+2
function nowSAST() {
  const now = new Date();
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}
function todaySAST() {
  return nowSAST().toISOString().split('T')[0];
}
function fmtTime(dt) {
  if (!dt) return '—';
  const d = new Date(new Date(dt).getTime() + 2 * 60 * 60 * 1000);
  return d.toISOString().substring(11, 16);
}

// ─── Clock-in/out page ───────────────────────────────────────────────────────

router.get('/clock', (req, res) => {
  res.render('attendance/clock', { message: null, error: null });
});

router.post('/clock', async (req, res) => {
  const { clock_code, action } = req.body;
  if (!clock_code || !action) {
    return res.render('attendance/clock', { message: null, error: 'Please enter your code and select an action.' });
  }
  try {
    const [emps] = await pool.query('SELECT * FROM employees WHERE clock_code = ? AND active = 1', [clock_code.trim().toUpperCase()]);
    if (!emps.length) {
      return res.render('attendance/clock', { message: null, error: 'Invalid code. Please check with your manager.' });
    }
    const emp = emps[0];
    const now = nowSAST();
    const today = todaySAST();
    const timeStr = now.toISOString().substring(11, 16);

    if (action === 'in') {
      const [open] = await pool.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ? AND clock_out IS NULL',
        [emp.id, today]
      );
      if (open.length) {
        return res.render('attendance/clock', { message: null, error: `${emp.name} is already clocked in today.` });
      }
      await pool.query(
        'INSERT INTO attendance (employee_id, date, clock_in) VALUES (?,?,?)',
        [emp.id, today, now.toISOString().replace('T', ' ').substring(0, 19)]
      );
      return res.render('attendance/clock', {
        message: `✓ Good morning, ${emp.name}! Clocked in at ${timeStr}.`,
        error: null
      });
    }

    if (action === 'out') {
      const [open] = await pool.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
        [emp.id, today]
      );
      if (!open.length) {
        return res.render('attendance/clock', { message: null, error: `${emp.name} has no open clock-in for today.` });
      }
      const record = open[0];
      const clockInTime = new Date(new Date(record.clock_in).getTime() + 2 * 60 * 60 * 1000);
      const hoursWorked = ((now - clockInTime) / 3600000).toFixed(2);
      await pool.query(
        'UPDATE attendance SET clock_out = ?, hours_worked = ? WHERE id = ?',
        [now.toISOString().replace('T', ' ').substring(0, 19), hoursWorked, record.id]
      );
      return res.render('attendance/clock', {
        message: `✓ Goodbye, ${emp.name}! Clocked out at ${timeStr}. Hours worked today: ${hoursWorked}h.`,
        error: null
      });
    }
  } catch (err) {
    console.error(err);
    res.render('attendance/clock', { message: null, error: 'Something went wrong. Please try again.' });
  }
});

// ─── Employee list (manager only) ────────────────────────────────────────────

router.get('/attendance', requireManager, async (req, res) => {
  const [employees] = await pool.query('SELECT * FROM employees ORDER BY active DESC, name ASC');
  const [staff] = await pool.query('SELECT id, name, email, role, ta_access FROM users ORDER BY role DESC, name ASC');
  res.render('attendance/list', { user: req.session.user, employees, staff });
});

router.get('/attendance/employees/new', requireManager, (req, res) => {
  res.render('attendance/employee-form', { user: req.session.user, employee: null, error: null });
});

router.post('/attendance/employees/new', requireManager, async (req, res) => {
  const { name, phone, clock_code } = req.body;
  if (!name || !clock_code) {
    return res.render('attendance/employee-form', { user: req.session.user, employee: req.body, error: 'Name and clock code are required.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO employees (name, phone, clock_code) VALUES (?,?,?)',
      [name, phone || '', clock_code.trim().toUpperCase()]
    );
    await auditLog(req, 'CREATE_EMPLOYEE', 'employee', result.insertId, `Created employee: ${name} (code: ${clock_code.toUpperCase()})`);
    res.redirect('/attendance');
  } catch (err) {
    res.render('attendance/employee-form', { user: req.session.user, employee: req.body, error: 'Clock code already exists or error saving.' });
  }
});

router.get('/attendance/employees/:id/edit', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.redirect('/attendance');
  res.render('attendance/employee-form', { user: req.session.user, employee: rows[0], error: null });
});

router.post('/attendance/employees/:id/edit', requireManager, async (req, res) => {
  const { name, phone, clock_code, active } = req.body;
  await pool.query(
    'UPDATE employees SET name=?, phone=?, clock_code=?, active=? WHERE id=?',
    [name, phone || '', clock_code.trim().toUpperCase(), active ? 1 : 0, req.params.id]
  );
  await auditLog(req, 'EDIT_EMPLOYEE', 'employee', req.params.id, `Edited employee: ${name}`);
  res.redirect('/attendance');
});

// ─── Staff T&A access (manager only) ─────────────────────────────────────────

router.post('/attendance/staff/:id/access', requireManager, async (req, res) => {
  const { ta_access } = req.body;
  await pool.query('UPDATE users SET ta_access = ? WHERE id = ?', [ta_access ? 1 : 0, req.params.id]);
  const [rows] = await pool.query('SELECT name FROM users WHERE id = ?', [req.params.id]);
  await auditLog(req, 'UPDATE_TA_ACCESS', 'user', req.params.id, `${ta_access ? 'Granted' : 'Removed'} T&A access for ${rows[0]?.name}`);
  res.redirect('/attendance');
});

// ─── Attendance records (manager + ta_access staff) ──────────────────────────

router.get('/attendance/records', requireTA, async (req, res) => {
  const today = todaySAST();
  const { from = today, to = today, employee_id = '' } = req.query;
  let sql = `
    SELECT a.*, e.name as emp_name, e.phone as emp_phone
    FROM attendance a JOIN employees e ON a.employee_id = e.id
    WHERE a.date BETWEEN ? AND ?
  `;
  const params = [from, to];
  if (employee_id) { sql += ' AND a.employee_id = ?'; params.push(employee_id); }
  sql += ' ORDER BY a.date DESC, a.clock_in DESC';
  const [records] = await pool.query(sql, params);
  const [employees] = await pool.query('SELECT id, name FROM employees ORDER BY name');
  const totalHours = records.reduce((sum, r) => sum + parseFloat(r.hours_worked || 0), 0).toFixed(2);
  res.render('attendance/records', { user: req.session.user, records, employees, from, to, employee_id, totalHours, fmtTime });
});

// ─── Reports (manager only) ───────────────────────────────────────────────────

router.get('/attendance/reports', requireManager, async (req, res) => {
  const now = nowSAST();
  const year  = parseInt(req.query.year)  || now.getFullYear();
  const month = parseInt(req.query.month) || (now.getMonth() + 1);

  const [monthly] = await pool.query(`
    SELECT e.name, e.phone,
      COUNT(DISTINCT a.date) as days_worked,
      SUM(a.hours_worked) as total_hours
    FROM attendance a JOIN employees e ON a.employee_id = e.id
    WHERE YEAR(a.date) = ? AND MONTH(a.date) = ?
    GROUP BY e.id ORDER BY e.name
  `, [year, month]);

  const [weekly] = await pool.query(`
    SELECT e.name,
      YEARWEEK(a.date, 1) as yw,
      MIN(a.date) as week_start,
      COUNT(DISTINCT a.date) as days_worked,
      SUM(a.hours_worked) as total_hours
    FROM attendance a JOIN employees e ON a.employee_id = e.id
    WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
    GROUP BY e.id, YEARWEEK(a.date, 1)
    ORDER BY yw DESC, e.name
  `);

  const [daily] = await pool.query(`
    SELECT a.date,
      COUNT(DISTINCT a.employee_id) as employees_present,
      SUM(a.hours_worked) as total_hours
    FROM attendance a
    WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY a.date ORDER BY a.date DESC
  `);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  res.render('attendance/reports', { user: req.session.user, monthly, weekly, daily, year, month, months });
});

// ─── Export CSV ───────────────────────────────────────────────────────────────

router.get('/attendance/export', requireTA, async (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT e.name, e.phone, a.date, a.clock_in, a.clock_out, a.hours_worked
    FROM attendance a JOIN employees e ON a.employee_id = e.id
  `;
  const params = [];
  if (from && to) { sql += ' WHERE a.date BETWEEN ? AND ?'; params.push(from, to); }
  sql += ' ORDER BY a.date DESC, e.name';
  const [rows] = await pool.query(sql, params);
  const csv = stringify(rows.map(r => ({
    'Employee':     r.name,
    'Phone':        r.phone,
    'Date':         r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
    'Clock in':     fmtTime(r.clock_in),
    'Clock out':    fmtTime(r.clock_out),
    'Hours worked': r.hours_worked || ''
  })), { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
  res.send(csv);
});

module.exports = router;
