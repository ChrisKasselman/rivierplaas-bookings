const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireExecutive } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.get('/loans', requireExecutive, async (req, res) => {
  const [loans] = await pool.query('SELECT * FROM staff_loans ORDER BY date_given DESC');
  const [staff] = await pool.query('SELECT id, name FROM users ORDER BY name');
  const [employees] = await pool.query('SELECT id, name FROM employees WHERE active=1 ORDER BY name');
  const totalOutstanding = loans.reduce((sum, l) => sum + parseFloat(l.balance || 0), 0).toFixed(2);
  res.render('loans/list', { user: req.session.user, loans, staff, employees, totalOutstanding });
});

router.get('/loans/new', requireExecutive, async (req, res) => {
  const [staff] = await pool.query('SELECT id, name FROM users ORDER BY name');
  const [employees] = await pool.query('SELECT id, name FROM employees WHERE active=1 ORDER BY name');
  res.render('loans/form', { user: req.session.user, loan: null, staff, employees, error: null });
});

router.post('/loans/new', requireExecutive, async (req, res) => {
  const { person_type, person_id, amount, date_given, repayment_amount, notes } = req.body;
  if (!person_type || !person_id || !amount || !date_given) {
    const [staff] = await pool.query('SELECT id, name FROM users ORDER BY name');
    const [employees] = await pool.query('SELECT id, name FROM employees WHERE active=1 ORDER BY name');
    return res.render('loans/form', { user: req.session.user, loan: req.body, staff, employees, error: 'Please fill in all required fields.' });
  }
  try {
    // Look up the person's name
    let personName = '';
    if (person_type === 'staff') {
      const [rows] = await pool.query('SELECT name FROM users WHERE id=?', [person_id]);
      personName = rows[0]?.name || '';
    } else {
      const [rows] = await pool.query('SELECT name FROM employees WHERE id=?', [person_id]);
      personName = rows[0]?.name || '';
    }
    const [result] = await pool.query(
      'INSERT INTO staff_loans (person_type, person_id, person_name, amount, date_given, repayment_amount, balance, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [person_type, person_id, personName, amount, date_given, repayment_amount || 0, amount, notes || '', req.session.user.id]
    );
    await auditLog(req, 'CREATE_LOAN', 'staff_loan', result.insertId, `Created loan for ${personName}: R${amount}`);
    res.redirect('/loans');
  } catch (err) {
    console.error(err);
    const [staff] = await pool.query('SELECT id, name FROM users ORDER BY name');
    const [employees] = await pool.query('SELECT id, name FROM employees WHERE active=1 ORDER BY name');
    res.render('loans/form', { user: req.session.user, loan: req.body, staff, employees, error: 'Could not save loan. Please try again.' });
  }
});

router.get('/loans/:id/edit', requireExecutive, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM staff_loans WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.redirect('/loans');
  const [staff] = await pool.query('SELECT id, name FROM users ORDER BY name');
  const [employees] = await pool.query('SELECT id, name FROM employees WHERE active=1 ORDER BY name');
  res.render('loans/form', { user: req.session.user, loan: rows[0], staff, employees, error: null });
});

router.post('/loans/:id/edit', requireExecutive, async (req, res) => {
  const { amount, date_given, repayment_amount, balance, notes } = req.body;
  await pool.query(
    'UPDATE staff_loans SET amount=?, date_given=?, repayment_amount=?, balance=?, notes=? WHERE id=?',
    [amount, date_given, repayment_amount || 0, balance, notes || '', req.params.id]
  );
  await auditLog(req, 'EDIT_LOAN', 'staff_loan', req.params.id, `Edited loan, new balance: R${balance}`);
  res.redirect('/loans');
});

router.post('/loans/:id/delete', requireExecutive, async (req, res) => {
  const [rows] = await pool.query('SELECT person_name, amount FROM staff_loans WHERE id = ?', [req.params.id]);
  if (rows.length) {
    await auditLog(req, 'DELETE_LOAN', 'staff_loan', req.params.id, `Deleted loan for ${rows[0].person_name}: R${rows[0].amount}`);
  }
  await pool.query('DELETE FROM staff_loans WHERE id = ?', [req.params.id]);
  res.redirect('/loans');
});

module.exports = router;
