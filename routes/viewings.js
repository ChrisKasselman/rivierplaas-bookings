const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireLogin, requireManager } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.get('/viewings', requireLogin, async (req, res) => {
  const { status = '', outcome = '' } = req.query;
  let sql = 'SELECT * FROM viewings WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (outcome) { sql += ' AND outcome = ?'; params.push(outcome); }
  sql += ' ORDER BY viewing_date DESC, viewing_time DESC';
  const [viewings] = await pool.query(sql, params);
  res.render('viewings/list', { user: req.session.user, viewings, status, outcome });
});

router.get('/viewings/new', requireLogin, (req, res) => {
  res.render('viewings/form', { user: req.session.user, viewing: null, error: null });
});

router.post('/viewings/new', requireLogin, async (req, res) => {
  const { viewing_date, viewing_time, firstname, surname, cell, email, status, outcome, notes } = req.body;
  if (!viewing_date || !firstname || !surname) {
    return res.render('viewings/form', { user: req.session.user, viewing: req.body, error: 'Date, first name and surname are required.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO viewings (viewing_date, viewing_time, firstname, surname, cell, email, status, outcome, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [viewing_date, viewing_time || null, firstname, surname, cell || '', email || '', status || 'Scheduled', outcome || 'Pending', notes || '', req.session.user.id]
    );
    await auditLog(req, 'CREATE_VIEWING', 'viewing', result.insertId, `Created viewing for ${firstname} ${surname} on ${viewing_date}`);
    res.redirect('/viewings');
  } catch (err) {
    console.error(err);
    res.render('viewings/form', { user: req.session.user, viewing: req.body, error: 'Could not save viewing. Please try again.' });
  }
});

router.get('/viewings/:id/edit', requireLogin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM viewings WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.redirect('/viewings');
  res.render('viewings/form', { user: req.session.user, viewing: rows[0], error: null });
});

router.post('/viewings/:id/edit', requireLogin, async (req, res) => {
  const { viewing_date, viewing_time, firstname, surname, cell, email, status, outcome, notes } = req.body;
  if (!viewing_date || !firstname || !surname) {
    return res.render('viewings/form', { user: req.session.user, viewing: { ...req.body, id: req.params.id }, error: 'Date, first name and surname are required.' });
  }
  await pool.query(
    'UPDATE viewings SET viewing_date=?, viewing_time=?, firstname=?, surname=?, cell=?, email=?, status=?, outcome=?, notes=? WHERE id=?',
    [viewing_date, viewing_time || null, firstname, surname, cell || '', email || '', status || 'Scheduled', outcome || 'Pending', notes || '', req.params.id]
  );
  await auditLog(req, 'EDIT_VIEWING', 'viewing', req.params.id, `Edited viewing for ${firstname} ${surname}`);
  res.redirect('/viewings');
});

router.post('/viewings/:id/delete', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT firstname, surname FROM viewings WHERE id = ?', [req.params.id]);
  if (rows.length) {
    await auditLog(req, 'DELETE_VIEWING', 'viewing', req.params.id, `Deleted viewing for ${rows[0].firstname} ${rows[0].surname}`);
  }
  await pool.query('DELETE FROM viewings WHERE id = ?', [req.params.id]);
  res.redirect('/viewings');
});

module.exports = router;
