const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireManager } = require('../middleware/auth');

router.get('/admin', requireManager, async (req, res) => {
  const [staff] = await pool.query('SELECT id, name, email, role, venue, created_at FROM users ORDER BY role DESC, name ASC');
  const [ommi] = await pool.query('SELECT room, firstname, surname FROM bookings WHERE venue="Ommidraai" AND checkin<=CURDATE() AND checkout>CURDATE()');
  const [innie] = await pool.query('SELECT room, firstname, surname FROM bookings WHERE venue="Inniebos" AND checkin<=CURDATE() AND checkout>CURDATE()');
  const ommiMap = {}, innieMap = {};
  ommi.forEach(b => { ommiMap[b.room] = `${b.firstname} ${b.surname}`; });
  innie.forEach(b => { innieMap[b.room] = `${b.firstname} ${b.surname}`; });
  res.render('admin/panel', { user: req.session.user, staff, ommiMap, innieMap });
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
    await pool.query('INSERT INTO users (name, email, password, role, venue) VALUES (?,?,?,?,?)', [name, email.toLowerCase(), hash, role, venue]);
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
  res.redirect('/admin');
});

router.post('/admin/staff/:id/delete', requireManager, async (req, res) => {
  if (parseInt(req.params.id) === req.session.user.id) return res.redirect('/admin');
  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.redirect('/admin');
});

module.exports = router;
