const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireLogin, requireManager } = require('../middleware/auth');
const { stringify } = require('csv-stringify/sync');

router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as c FROM bookings');
    const [paid] = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE fully_paid=1');
    const [deposit] = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE deposit_paid=1 AND fully_paid=0');
    const [unpaid] = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE deposit_paid=0 AND fully_paid=0');
    const [upcoming] = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE checkin >= CURDATE()');
    res.render('dashboard', {
      user: req.session.user,
      stats: { total: total[0].c, paid: paid[0].c, deposit: deposit[0].c, unpaid: unpaid[0].c, upcoming: upcoming[0].c }
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { user: req.session.user, stats: { total:0, paid:0, deposit:0, unpaid:0, upcoming:0 } });
  }
});

router.get('/bookings', requireLogin, async (req, res) => {
  const { search = '', venue = '', payment = '' } = req.query;
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (firstname LIKE ? OR surname LIKE ? OR email LIKE ? OR cell LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }
  if (venue) { sql += ' AND venue = ?'; params.push(venue); }
  if (payment === 'fully_paid') { sql += ' AND fully_paid = 1'; }
  else if (payment === 'deposit') { sql += ' AND deposit_paid = 1 AND fully_paid = 0'; }
  else if (payment === 'unpaid') { sql += ' AND deposit_paid = 0 AND fully_paid = 0'; }
  sql += ' ORDER BY checkin DESC';
  const [bookings] = await pool.query(sql, params);
  res.render('bookings/list', { user: req.session.user, bookings, search, venue, payment });
});

router.get('/bookings/new', requireLogin, (req, res) => {
  res.render('bookings/form', { user: req.session.user, booking: null, error: null });
});

router.post('/bookings/new', requireLogin, async (req, res) => {
  const { firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid, fully_paid, notes } = req.body;
  if (!firstname || !surname || !email || !cell || !venue || !room || !checkin || !checkout) {
    return res.render('bookings/form', { user: req.session.user, booking: req.body, error: 'Please fill in all required fields.' });
  }
  if (checkin >= checkout) {
    return res.render('bookings/form', { user: req.session.user, booking: req.body, error: 'Check-out must be after check-in.' });
  }
  try {
    await pool.query(
      'INSERT INTO bookings (firstname,surname,email,cell,venue,room,checkin,checkout,deposit_paid,fully_paid,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid?1:0, fully_paid?1:0, notes||'', req.session.user.id]
    );
    res.redirect('/bookings');
  } catch (err) {
    console.error(err);
    res.render('bookings/form', { user: req.session.user, booking: req.body, error: 'Could not save booking. Please try again.' });
  }
});

router.get('/bookings/:id/edit', requireLogin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.redirect('/bookings');
  res.render('bookings/form', { user: req.session.user, booking: rows[0], error: null });
});

router.post('/bookings/:id/edit', requireLogin, async (req, res) => {
  const { firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid, fully_paid, notes } = req.body;
  if (!firstname || !surname || !email || !cell || !venue || !room || !checkin || !checkout) {
    return res.render('bookings/form', { user: req.session.user, booking: { ...req.body, id: req.params.id }, error: 'Please fill in all required fields.' });
  }
  await pool.query(
    'UPDATE bookings SET firstname=?,surname=?,email=?,cell=?,venue=?,room=?,checkin=?,checkout=?,deposit_paid=?,fully_paid=?,notes=? WHERE id=?',
    [firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid?1:0, fully_paid?1:0, notes||'', req.params.id]
  );
  res.redirect('/bookings');
});

router.post('/bookings/:id/delete', requireManager, async (req, res) => {
  await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  res.redirect('/bookings');
});

router.get('/rooms', requireLogin, async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const venue = req.query.venue || 'Ommidraai';
  const maxRooms = venue === 'Ommidraai' ? 7 : 5;
  const [booked] = await pool.query(
    'SELECT room, firstname, surname FROM bookings WHERE venue=? AND checkin<=? AND checkout>?',
    [venue, date, date]
  );
  const bookedMap = {};
  booked.forEach(b => { bookedMap[b.room] = `${b.firstname} ${b.surname}`; });
  res.render('rooms', { user: req.session.user, date, venue, maxRooms, bookedMap });
});

router.get('/export', requireManager, async (req, res) => {
  const [bookings] = await pool.query('SELECT * FROM bookings ORDER BY checkin DESC');
  const rows = bookings.map(b => ({
    'First name': b.firstname, 'Surname': b.surname, 'Email': b.email, 'Cell': b.cell,
    'Venue': b.venue, 'Room': b.room,
    'Check-in': b.checkin.toISOString().split('T')[0],
    'Check-out': b.checkout.toISOString().split('T')[0],
    'Deposit paid': b.deposit_paid ? 'Yes' : 'No',
    'Fully paid': b.fully_paid ? 'Yes' : 'No',
    'Notes': b.notes
  }));
  const csv = stringify(rows, { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rivierplaas-bookings.csv"');
  res.send(csv);
});

module.exports = router;
