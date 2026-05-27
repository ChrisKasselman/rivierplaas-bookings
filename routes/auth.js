const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!rows.length) return res.render('auth/login', { error: 'Invalid email or password.' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('auth/login', { error: 'Invalid email or password.' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, venue: user.venue };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('auth/login', { error: 'Something went wrong. Please try again.' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
