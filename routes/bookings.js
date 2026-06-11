const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireLogin, requireManager } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { stringify } = require('csv-stringify/sync');

router.get('/dashboard', requireLogin, async (req, res) => {
  try {

    const [total]      = await pool.query('SELECT COUNT(*) as c FROM bookings');
    const [paid]       = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE fully_paid=1');
    const [deposit]    = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE deposit_paid=1 AND fully_paid=0');
    const [unpaid]     = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE deposit_paid=0 AND fully_paid=0 AND no_payment=0 AND cancelled=0');
    const [nopayment]  = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE no_payment=1');
    const [cancelled]  = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE cancelled=1');
    const [upcoming]   = await pool.query('SELECT COUNT(*) as c FROM bookings WHERE checkin >= CURDATE() AND cancelled=0');
    const [wTotal]     = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings');
    const [wUpcoming]  = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings WHERE event_date >= CURDATE() AND cancelled=0');
    const [wPaid]      = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings WHERE fully_paid=1');
    const [wDeposit]   = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings WHERE deposit_paid=1 AND fully_paid=0');
    const [wUnpaid]    = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings WHERE deposit_paid=0 AND fully_paid=0 AND no_payment=0 AND cancelled=0');
    const [wNopayment] = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings WHERE no_payment=1');
    const [wCancelled] = await pool.query('SELECT COUNT(*) as c FROM wedding_bookings WHERE cancelled=1');
    // Chart data — bookings and weddings per month for current year
    const currentYear = new Date().getFullYear();
    const [roomsByMonth] = await pool.query(`
      SELECT MONTH(checkin) as month, COUNT(*) as bookings
      FROM bookings
      WHERE YEAR(checkin) = ? AND cancelled = 0
      GROUP BY MONTH(checkin)
    `, [currentYear]);
    const [weddingsByMonth] = await pool.query(`
      SELECT MONTH(event_date) as month, COUNT(*) as bookings
      FROM wedding_bookings
      WHERE YEAR(event_date) = ? AND cancelled = 0
      GROUP BY MONTH(event_date)
    `, [currentYear]);

    // Build 12-month arrays
    const roomChart = Array(12).fill(0);
    const weddingChart = Array(12).fill(0);
    roomsByMonth.forEach(r => { roomChart[r.month - 1] = r.bookings; });
    weddingsByMonth.forEach(r => { weddingChart[r.month - 1] = r.bookings; });

    res.render('dashboard', {
      user: req.session.user,
      stats: {
        total: total[0].c, paid: paid[0].c, deposit: deposit[0].c, unpaid: unpaid[0].c,
        nopayment: nopayment[0].c, cancelled: cancelled[0].c, upcoming: upcoming[0].c,
        wTotal: wTotal[0].c, wUpcoming: wUpcoming[0].c, wPaid: wPaid[0].c, wDeposit: wDeposit[0].c,
        wUnpaid: wUnpaid[0].c, wNopayment: wNopayment[0].c, wCancelled: wCancelled[0].c
      },
      chartData: { rooms: roomChart, weddings: weddingChart, year: currentYear }
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { user: req.session.user, stats: { total:0, paid:0, deposit:0, unpaid:0, upcoming:0, nopayment:0, cancelled:0, wTotal:0, wUpcoming:0, wPaid:0, wDeposit:0, wUnpaid:0, wNopayment:0, wCancelled:0 }, chartData: { rooms: Array(12).fill(0), weddings: Array(12).fill(0), year: new Date().getFullYear() } });
  }
});

// ─── Dashboard drill-down ────────────────────────────────────────────────────

const dashboardRoomFilters = {
  all:        { sql: 'SELECT * FROM bookings ORDER BY checkin DESC',                                                                    title: 'All room bookings' },
  upcoming:   { sql: 'SELECT * FROM bookings WHERE checkin >= CURDATE() AND cancelled=0 ORDER BY checkin ASC',                          title: 'Upcoming stays' },
  fully_paid: { sql: 'SELECT * FROM bookings WHERE fully_paid=1 ORDER BY checkin DESC',                                                title: 'Fully paid bookings' },
  deposit:    { sql: 'SELECT * FROM bookings WHERE deposit_paid=1 AND fully_paid=0 ORDER BY checkin DESC',                              title: 'Deposit only bookings' },
  unpaid:     { sql: 'SELECT * FROM bookings WHERE deposit_paid=0 AND fully_paid=0 AND no_payment=0 AND cancelled=0 ORDER BY checkin DESC', title: 'Unpaid bookings' },
  no_payment: { sql: 'SELECT * FROM bookings WHERE no_payment=1 ORDER BY checkin DESC',                                                title: 'No payment (complimentary)' },
  cancelled:  { sql: 'SELECT * FROM bookings WHERE cancelled=1 ORDER BY checkin DESC',                                                 title: 'Cancelled bookings' },
};

const dashboardWeddingFilters = {
  all:        { sql: 'SELECT * FROM wedding_bookings ORDER BY event_date DESC',                                                                          title: 'All wedding bookings' },
  upcoming:   { sql: 'SELECT * FROM wedding_bookings WHERE event_date >= CURDATE() AND cancelled=0 ORDER BY event_date ASC',                             title: 'Upcoming weddings' },
  fully_paid: { sql: 'SELECT * FROM wedding_bookings WHERE fully_paid=1 ORDER BY event_date DESC',                                                      title: 'Fully paid weddings' },
  deposit:    { sql: 'SELECT * FROM wedding_bookings WHERE deposit_paid=1 AND fully_paid=0 ORDER BY event_date DESC',                                    title: 'Deposit only weddings' },
  unpaid:     { sql: 'SELECT * FROM wedding_bookings WHERE deposit_paid=0 AND fully_paid=0 AND no_payment=0 AND cancelled=0 ORDER BY event_date DESC',   title: 'Unpaid weddings' },
  no_payment: { sql: 'SELECT * FROM wedding_bookings WHERE no_payment=1 ORDER BY event_date DESC',                                                      title: 'No payment (complimentary) weddings' },
  cancelled:  { sql: 'SELECT * FROM wedding_bookings WHERE cancelled=1 ORDER BY event_date DESC',                                                       title: 'Cancelled weddings' },
};

router.get('/dashboard/rooms/:filter', requireLogin, async (req, res) => {
  const filter = dashboardRoomFilters[req.params.filter];
  if (!filter) return res.redirect('/dashboard');
  const [rows] = await pool.query(filter.sql);
  res.render('dashboard/detail', { user: req.session.user, title: filter.title, rows, type: 'rooms' });
});

router.get('/dashboard/weddings/:filter', requireLogin, async (req, res) => {
  const filter = dashboardWeddingFilters[req.params.filter];
  if (!filter) return res.redirect('/dashboard');
  const [rows] = await pool.query(filter.sql);
  res.render('dashboard/detail', { user: req.session.user, title: filter.title, rows, type: 'weddings' });
});

// ─── Room Bookings ───────────────────────────────────────────────────────────

router.get('/bookings', requireLogin, async (req, res) => {
  const { search = '', venue = '', payment = '' } = req.query;
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (firstname LIKE ? OR surname LIKE ? OR email LIKE ? OR cell LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }
  if (venue) { sql += ' AND venue = ?'; params.push(venue); }
  if (payment === 'fully_paid') { sql += ' AND fully_paid = 1'; }
  else if (payment === 'no_payment') { sql += ' AND no_payment = 1'; }
  else if (payment === 'cancelled') { sql += ' AND cancelled = 1'; }
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
  const { firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid, fully_paid, no_payment, cancelled, notes } = req.body;
  if (!firstname || !surname || !email || !cell || !venue || !room || !checkin || !checkout) {
    return res.render('bookings/form', { user: req.session.user, booking: req.body, error: 'Please fill in all required fields.' });
  }
  if (checkin >= checkout) {
    return res.render('bookings/form', { user: req.session.user, booking: req.body, error: 'Check-out must be after check-in.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO bookings (firstname,surname,email,cell,venue,room,checkin,checkout,deposit_paid,fully_paid,no_payment,cancelled,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid?1:0, fully_paid?1:0, no_payment?1:0, cancelled?1:0, notes||'', req.session.user.id]
    );
    await auditLog(req, 'CREATE_BOOKING', 'booking', result.insertId, `Created booking for ${firstname} ${surname} — ${venue} Room ${room} (${checkin} to ${checkout})`);
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
  const { firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid, fully_paid, no_payment, cancelled, notes } = req.body;
  if (!firstname || !surname || !email || !cell || !venue || !room || !checkin || !checkout) {
    return res.render('bookings/form', { user: req.session.user, booking: { ...req.body, id: req.params.id }, error: 'Please fill in all required fields.' });
  }
  await pool.query(
    'UPDATE bookings SET firstname=?,surname=?,email=?,cell=?,venue=?,room=?,checkin=?,checkout=?,deposit_paid=?,fully_paid=?,no_payment=?,cancelled=?,notes=? WHERE id=?',
    [firstname, surname, email, cell, venue, room, checkin, checkout, deposit_paid?1:0, fully_paid?1:0, no_payment?1:0, cancelled?1:0, notes||'', req.params.id]
  );
  await auditLog(req, 'EDIT_BOOKING', 'booking', req.params.id, `Edited booking for ${firstname} ${surname} — ${venue} Room ${room}`);
  res.redirect('/bookings');
});

router.post('/bookings/:id/delete', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (rows.length) {
    const b = rows[0];
    await auditLog(req, 'DELETE_BOOKING', 'booking', req.params.id, `Deleted booking for ${b.firstname} ${b.surname} — ${b.venue} Room ${b.room}`);
  }
  await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  res.redirect('/bookings');
});

// ─── Wedding Bookings ────────────────────────────────────────────────────────

router.get('/weddings', requireLogin, async (req, res) => {
  const { search = '', venue = '', payment = '' } = req.query;
  let sql = 'SELECT * FROM wedding_bookings WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (firstname LIKE ? OR surname LIKE ? OR email LIKE ? OR cell LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }
  if (venue) { sql += ' AND venue = ?'; params.push(venue); }
  if (payment === 'fully_paid') { sql += ' AND fully_paid = 1'; }
  else if (payment === 'no_payment') { sql += ' AND no_payment = 1'; }
  else if (payment === 'cancelled') { sql += ' AND cancelled = 1'; }
  else if (payment === 'deposit') { sql += ' AND deposit_paid = 1 AND fully_paid = 0'; }
  else if (payment === 'unpaid') { sql += ' AND deposit_paid = 0 AND fully_paid = 0'; }
  sql += ' ORDER BY event_date DESC';
  const [weddings] = await pool.query(sql, params);
  res.render('weddings/list', { user: req.session.user, weddings, search, venue, payment });
});

router.get('/weddings/new', requireLogin, (req, res) => {
  res.render('weddings/form', { user: req.session.user, wedding: null, error: null });
});

router.post('/weddings/new', requireLogin, async (req, res) => {
  const { firstname, surname, email, cell, venue, event_date, event_end_date, guests, deposit_paid, fully_paid, no_payment, cancelled, notes } = req.body;
  if (!firstname || !surname || !email || !cell || !venue || !event_date || !event_end_date || !guests) {
    return res.render('weddings/form', { user: req.session.user, wedding: req.body, error: 'Please fill in all required fields.' });
  }
  if (event_date > event_end_date) {
    return res.render('weddings/form', { user: req.session.user, wedding: req.body, error: 'End date must be on or after event date.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO wedding_bookings (firstname,surname,email,cell,venue,event_date,event_end_date,guests,deposit_paid,fully_paid,no_payment,cancelled,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [firstname, surname, email, cell, venue, event_date, event_end_date, guests, deposit_paid?1:0, fully_paid?1:0, no_payment?1:0, cancelled?1:0, notes||'', req.session.user.id]
    );
    await auditLog(req, 'CREATE_WEDDING', 'wedding_booking', result.insertId, `Created wedding booking for ${firstname} ${surname} — ${venue} on ${event_date}`);
    res.redirect('/weddings');
  } catch (err) {
    console.error(err);
    res.render('weddings/form', { user: req.session.user, wedding: req.body, error: 'Could not save booking. Please try again.' });
  }
});

router.get('/weddings/:id/edit', requireLogin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM wedding_bookings WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.redirect('/weddings');
  res.render('weddings/form', { user: req.session.user, wedding: rows[0], error: null });
});

router.post('/weddings/:id/edit', requireLogin, async (req, res) => {
  const { firstname, surname, email, cell, venue, event_date, event_end_date, guests, deposit_paid, fully_paid, no_payment, cancelled, notes } = req.body;
  if (!firstname || !surname || !email || !cell || !venue || !event_date || !event_end_date || !guests) {
    return res.render('weddings/form', { user: req.session.user, wedding: { ...req.body, id: req.params.id }, error: 'Please fill in all required fields.' });
  }
  await pool.query(
    'UPDATE wedding_bookings SET firstname=?,surname=?,email=?,cell=?,venue=?,event_date=?,event_end_date=?,guests=?,deposit_paid=?,fully_paid=?,no_payment=?,cancelled=?,notes=? WHERE id=?',
    [firstname, surname, email, cell, venue, event_date, event_end_date, guests, deposit_paid?1:0, fully_paid?1:0, no_payment?1:0, cancelled?1:0, notes||'', req.params.id]
  );
  await auditLog(req, 'EDIT_WEDDING', 'wedding_booking', req.params.id, `Edited wedding booking for ${firstname} ${surname} — ${venue}`);
  res.redirect('/weddings');
});

router.post('/weddings/:id/delete', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM wedding_bookings WHERE id = ?', [req.params.id]);
  if (rows.length) {
    const w = rows[0];
    await auditLog(req, 'DELETE_WEDDING', 'wedding_booking', req.params.id, `Deleted wedding booking for ${w.firstname} ${w.surname} — ${w.venue}`);
  }
  await pool.query('DELETE FROM wedding_bookings WHERE id = ?', [req.params.id]);
  res.redirect('/weddings');
});

// ─── Rooms ───────────────────────────────────────────────────────────────────

router.get('/rooms', requireLogin, async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const venue = req.query.venue || 'Ommidraai';

  let rooms = [];
  if (venue === 'Ommidraai') rooms = [1,2,3,4,5,6,7];
  else if (venue === 'Inniebos') rooms = [10,11,12,13,14];
  else if (venue === 'Honeymoon Suite') rooms = [8,9];

  const [booked] = await pool.query(
    'SELECT room, firstname, surname FROM bookings WHERE venue=? AND checkin<=? AND checkout>?',
    [venue, date, date]
  );
  const bookedMap = {};
  booked.forEach(b => { bookedMap[b.room] = `${b.firstname} ${b.surname}`; });
  res.render('rooms', { user: req.session.user, date, venue, rooms, bookedMap });
});

// ─── Export ──────────────────────────────────────────────────────────────────

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
