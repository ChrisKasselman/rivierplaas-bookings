const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireLogin, requireManager } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { generateInvoicePDF, generateGuestDirectoryPDF } = require('../utils/invoice');
const { sendInvoiceEmail } = require('../utils/mailer');

// Auto-generate invoice number
async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1",
    [`RP-${year}-%`]
  );
  if (!rows.length) return `RP-${year}-001`;
  const last = parseInt(rows[0].invoice_number.split('-')[2]) || 0;
  return `RP-${year}-${String(last + 1).padStart(3, '0')}`;
}

// ─── Invoice list ─────────────────────────────────────────────────────────────

router.get('/invoices', requireManager, async (req, res) => {
  const [invoices] = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
  res.render('invoices/list', { user: req.session.user, invoices });
});

// ─── New invoice from a booking ───────────────────────────────────────────────

router.get('/invoices/new', requireManager, async (req, res) => {
  const { booking_type = 'room', booking_id } = req.query;
  let booking = null;

  if (booking_id) {
    if (booking_type === 'room') {
      const [rows] = await pool.query('SELECT * FROM bookings WHERE id=?', [booking_id]);
      booking = rows[0] || null;
    } else {
      const [rows] = await pool.query('SELECT * FROM wedding_bookings WHERE id=?', [booking_id]);
      booking = rows[0] || null;
    }
  }

  res.render('invoices/form', { user: req.session.user, booking, booking_type, error: null });
});

router.post('/invoices/new', requireManager, async (req, res) => {
  const { booking_id, invoice_type, firstname, surname, email, amount, description } = req.body;
  // Force booking_type to string in case form sends array
  const booking_type = Array.isArray(req.body.booking_type) ? req.body.booking_type[0] : (req.body.booking_type || 'room');
  if (!firstname || !surname || !email || !amount || !invoice_type) {
    return res.render('invoices/form', {
      user: req.session.user,
      booking: req.body,
      booking_type: booking_type || 'room',
      error: 'Please fill in all required fields.'
    });
  }
  try {
    const invoice_number = await nextInvoiceNumber();
    const [result] = await pool.query(
      'INSERT INTO invoices (invoice_number, booking_type, booking_id, invoice_type, firstname, surname, email, amount, description, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [invoice_number, booking_type, booking_id || null, invoice_type, firstname, surname, email, amount, description || '', 'draft', req.session.user.id]
    );
    await auditLog(req, 'CREATE_INVOICE', 'invoice', result.insertId, `Created ${invoice_type} invoice #${invoice_number} for ${firstname} ${surname} — R${amount}`);
    res.redirect(`/invoices/${result.insertId}`);
  } catch (err) {
    console.error('INVOICE SAVE ERROR:', err.message, err.code, err.sqlMessage);
    res.render('invoices/form', { user: req.session.user, booking: req.body, booking_type: booking_type || 'room', error: `Could not save invoice: ${err.message}` });
  }
});

// ─── View invoice ─────────────────────────────────────────────────────────────

router.get('/invoices/:id', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!rows.length) return res.redirect('/invoices');
  res.render('invoices/view', { user: req.session.user, invoice: rows[0] });
});

// ─── Download guest directory PDF ─────────────────────────────────────────────

router.get('/invoices/:id/guest-directory', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!rows.length) return res.redirect('/invoices');
  const invoice = rows[0];
  const gateCode = process.env.GATE_CODE || '[Insert Code Here]';
  const pdf = await generateGuestDirectoryPDF(invoice, gateCode);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Rivierplaas-GuestDirectory-${invoice.firstname}-${invoice.surname}.pdf"`);
  res.send(pdf);
});

// ─── Download PDF ─────────────────────────────────────────────────────────────

router.get('/invoices/:id/pdf', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!rows.length) return res.redirect('/invoices');
  const invoice = rows[0];
  const pdf = await generateInvoicePDF(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Rivierplaas-Invoice-${invoice.invoice_number}.pdf"`);
  res.send(pdf);
});

// ─── Send email ───────────────────────────────────────────────────────────────

router.post('/invoices/:id/send', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!rows.length) return res.redirect('/invoices');
  const invoice = rows[0];
  try {
    const gateCode = process.env.GATE_CODE || '[Insert Code Here]';
    const [invoicePdf, directoryPdf] = await Promise.all([
      generateInvoicePDF(invoice),
      generateGuestDirectoryPDF(invoice, gateCode)
    ]);
    await sendInvoiceEmail({
      to: invoice.email,
      name: `${invoice.firstname} ${invoice.surname}`,
      invoiceNumber: invoice.invoice_number,
      invoiceType: invoice.invoice_type,
      pdfBuffer: invoicePdf,
      directoryPdfBuffer: directoryPdf
    });
    await pool.query('UPDATE invoices SET status="sent", sent_at=NOW() WHERE id=?', [invoice.id]);
    await auditLog(req, 'SEND_INVOICE', 'invoice', invoice.id, `Sent invoice #${invoice.invoice_number} to ${invoice.email}`);
    res.redirect(`/invoices/${invoice.id}?sent=1`);
  } catch (err) {
    console.error('Email error:', err);
    res.redirect(`/invoices/${invoice.id}?error=email`);
  }
});

// ─── Mark as paid ─────────────────────────────────────────────────────────────

router.post('/invoices/:id/paid', requireManager, async (req, res) => {
  await pool.query('UPDATE invoices SET status="paid" WHERE id=?', [req.params.id]);
  await auditLog(req, 'MARK_INVOICE_PAID', 'invoice', req.params.id, `Marked invoice as paid`);
  res.redirect('/invoices');
});

// ─── Delete invoice ───────────────────────────────────────────────────────────

router.post('/invoices/:id/delete', requireManager, async (req, res) => {
  const [rows] = await pool.query('SELECT invoice_number FROM invoices WHERE id=?', [req.params.id]);
  if (rows.length) {
    await auditLog(req, 'DELETE_INVOICE', 'invoice', req.params.id, `Deleted invoice #${rows[0].invoice_number}`);
  }
  await pool.query('DELETE FROM invoices WHERE id=?', [req.params.id]);
  res.redirect('/invoices');
});

module.exports = router;

// ─── Test email connection ────────────────────────────────────────────────────

router.get('/invoices/test-email', requireManager, async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'payments.rivierplaas@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
      }
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"Rivierplaas" <${process.env.GMAIL_USER || 'payments.rivierplaas@gmail.com'}>`,
      to: req.session.user.email,
      subject: 'Rivierplaas — Email test',
      text: 'Email is working correctly from the Rivierplaas booking system.'
    });
    res.send(`
      <div style="font-family:sans-serif;padding:2rem;max-width:500px;margin:auto">
        <h2 style="color:#4f7942">Email sent successfully!</h2>
        <p>A test email was sent to <strong>${req.session.user.email}</strong>.</p>
        <p>GMAIL_USER: ${process.env.GMAIL_USER || 'NOT SET'}</p>
        <p>GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'SET (' + process.env.GMAIL_APP_PASSWORD.length + ' chars)' : 'NOT SET'}</p>
        <a href="/invoices">Back to invoices</a>
      </div>
    `);
  } catch (err) {
    res.send(`
      <div style="font-family:sans-serif;padding:2rem;max-width:500px;margin:auto">
        <h2 style="color:#dc2626">Email failed</h2>
        <p><strong>Error:</strong> ${err.message}</p>
        <p>GMAIL_USER: ${process.env.GMAIL_USER || 'NOT SET'}</p>
        <p>GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'SET (' + process.env.GMAIL_APP_PASSWORD.length + ' chars)' : 'NOT SET'}</p>
        <a href="/invoices">Back to invoices</a>
      </div>
    `);
  }
});
