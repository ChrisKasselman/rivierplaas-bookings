const fs = require('fs');
const path = require('path');

const GREEN  = '#4f7942';
const DARK   = '#1a1a2e';
const GREY   = '#6b7280';
const LGREY  = '#f3f4f6';
const YELLOW = '#fefce8';
const YBORDER= '#fde047';

const BUSINESS = {
  name:           'Rivierplaas',
  address:        'End Langenhoven Street, Riversdale, Meyerton, 1961',
  phone:          '083 320 3760',
  email:          'payments.rivierplaas@gmail.com',
  bank:           'FNB',
  account_holder: 'Rivierplaas',
  account_number: '63153487278',
  branch_code:    '250655',
};

function logoPath() {
  return path.join(__dirname, '../public/images/logo.jpg');
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────

function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;
    const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    const guestRef = `${invoice.firstname} ${invoice.surname}`.toUpperCase();
    const typeLabel = invoice.invoice_type === 'deposit' ? 'DEPOSIT INVOICE' : 'FINAL INVOICE';

    // Logo
    try { doc.image(logoPath(), 50, 40, { width: 130 }); } catch(e) {}

    // Header right
    doc.fillColor(GREEN).fontSize(22).font('Helvetica-Bold')
       .text('INVOICE', 0, 45, { align: 'right' });
    doc.fillColor(GREY).fontSize(10).font('Helvetica')
       .text(typeLabel, 0, 72, { align: 'right' })
       .text(`Invoice #${invoice.invoice_number}`, 0, 86, { align: 'right' })
       .text(`Date: ${today}`, 0, 100, { align: 'right' });

    // Green line
    doc.moveTo(50, 130).lineTo(545, 130).strokeColor(GREEN).lineWidth(3).stroke();

    // From / To
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold')
       .text('FROM', 50, 145).text('INVOICE TO', 300, 145);
    doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold')
       .text(BUSINESS.name, 50, 158).text(`${invoice.firstname} ${invoice.surname}`, 300, 158);
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(BUSINESS.address, 50, 174, { width: 220 })
       .text(`Tel: ${BUSINESS.phone}`, 50, 198)
       .text(BUSINESS.email, 50, 210);
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(invoice.email, 300, 174)
       .text(`Booking ref: ${guestRef}`, 300, 186);

    // Divider
    doc.moveTo(50, 235).lineTo(545, 235).strokeColor('#e5e7eb').lineWidth(1).stroke();

    // Items table header
    doc.rect(50, 245, W, 24).fill(GREEN);
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
       .text('DESCRIPTION', 60, 252)
       .text('AMOUNT', 0, 252, { align: 'right', width: 535 });

    // Items row
    doc.rect(50, 269, W, 30).fill(LGREY);
    const desc = invoice.description || (invoice.booking_type === 'room' ? 'Room booking' : 'Wedding venue booking');
    doc.fillColor(DARK).fontSize(10).font('Helvetica')
       .text(desc, 60, 278, { width: 380 })
       .text(`R ${parseFloat(invoice.amount).toFixed(2)}`, 0, 278, { align: 'right', width: 535 });

    // Total box
    doc.rect(350, 320, 195, 45).fill('#f9fafb').stroke('#e5e7eb');
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(invoice.invoice_type === 'deposit' ? 'Deposit due:' : 'Total due:', 360, 328);
    doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold')
       .text(`R ${parseFloat(invoice.amount).toFixed(2)}`, 360, 342);

    // Payment details
    doc.rect(50, 390, W, 90).fill('#f0fdf4').stroke('#86efac');
    doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold').text('PAYMENT DETAILS', 65, 400);
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text(`Bank: ${BUSINESS.bank}`, 65, 415)
       .text(`Account holder: ${BUSINESS.account_holder}`, 65, 428)
       .text(`Account number: ${BUSINESS.account_number}`, 65, 441)
       .text(`Branch code: ${BUSINESS.branch_code}`, 65, 454);

    // Reference box
    doc.rect(50, 500, W, 36).fill(YELLOW).stroke(YBORDER);
    doc.fillColor('#854d0e').fontSize(9).font('Helvetica-Bold')
       .text('PAYMENT REFERENCE: ', 65, 508, { continued: true });
    doc.font('Helvetica').text(`Please use "${guestRef}" as your payment reference.`);
    doc.fillColor('#854d0e').fontSize(8).font('Helvetica')
       .text('This ensures we can identify and allocate your payment correctly.', 65, 522);

    // Footer
    doc.moveTo(50, 760).lineTo(545, 760).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(GREY).fontSize(8).font('Helvetica')
       .text(`${BUSINESS.name}  |  ${BUSINESS.address}  |  ${BUSINESS.phone}`, 50, 768, { align: 'center', width: W });

    doc.end();
  });
}

// ─── Guest Directory PDF ──────────────────────────────────────────────────────

function generateGuestDirectoryPDF(invoice, gateCode = '[Insert Code Here]', emergencyContact = '083 320 3760') {
  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;
    const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    const guestName = `${invoice.firstname} ${invoice.surname}`;

    // Logo
    try { doc.image(logoPath(), 50, 40, { width: 130 }); } catch(e) {}

    // Header right
    doc.fillColor(GREEN).fontSize(18).font('Helvetica-Bold')
       .text('Guest Directory & Indemnity', 0, 50, { align: 'right' });
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(`ACCOMMODATION DOCUMENT  |  ${today}`, 0, 74, { align: 'right' });

    // Green line
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor(GREEN).lineWidth(3).stroke();

    // Welcome box
    doc.rect(50, 118, W, 44).fill('#f0fdf4');
    doc.moveTo(50, 118).lineTo(50, 162).strokeColor(GREEN).lineWidth(4).stroke();
    doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold')
       .text(`Welcome to Rivier Plaas, ${guestName}!`, 62, 125);
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text('We are delighted to have you stay with us. Please review the following information carefully before your arrival.', 62, 139, { width: W - 20 });

    let y = 175;

    // ── Section helper
    function sectionHeader(num, title) {
      doc.rect(50, y, 24, 24).fill(GREEN);
      doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold').text(num, 50, y + 6, { width: 24, align: 'center' });
      doc.fillColor(GREEN).fontSize(12).font('Helvetica-Bold').text(title, 80, y + 6);
      y += 30;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      y += 8;
    }

    // ── Section 1: Check-in/out
    sectionHeader('1', 'Check-In & Check-Out Times');

    const half = (W - 10) / 2;
    doc.rect(50, y, half, 50).fill(LGREY);
    doc.rect(60 + half, y, half, 50).fill(LGREY);
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold')
       .text('CHECK-IN TIME', 60, y + 6)
       .text('CHECK-OUT TIME', 70 + half, y + 6);
    doc.fillColor(GREEN).fontSize(22).font('Helvetica-Bold')
       .text('14:00', 60, y + 18)
       .text('10:00', 70 + half, y + 18);
    doc.fillColor(GREY).fontSize(7).font('Helvetica')
       .text('Rooms available from 2:00 PM', 60, y + 42)
       .text('Strictly enforced for venue turnover', 70 + half, y + 42);
    y += 62;

    // ── Section 2: Access & Safety
    sectionHeader('2', 'Important Access & Safety');

    doc.rect(50, y, W, 24).fill(LGREY);
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text('Main Gate Code', 62, y + 8);
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(gateCode, 300, y + 8);
    y += 24;
    doc.rect(50, y, W, 24).fill('#fff');
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text('Emergency Contact', 62, y + 8);
    doc.fillColor(DARK).fontSize(9).font('Helvetica').text(emergencyContact, 300, y + 8);
    doc.rect(50, y - 24, W, 48).strokeColor('#e5e7eb').lineWidth(1).stroke();
    y += 34;

    // ── Section 3: House Rules
    sectionHeader('3', 'House Rules');

    const rules = [
      ['Noise',         'Please respect other guests. Music and loud noise must be curtailed after 00:00.'],
      ['Smoking',       'Strictly no smoking inside the rooms or bridal suites. Please use designated outdoor areas only.'],
      ['Damage',        'Any breakages or damage to property will be billed to the guest.'],
      ['Water & Power', 'Please use water sparingly. Ensure all lights and AC units are turned off when leaving the room.'],
    ];
    rules.forEach((r, i) => {
      const rowH = 28;
      doc.rect(50, y, W, rowH).fill(i % 2 === 0 ? LGREY : '#fff');
      doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold').text(r[0] + ':', 62, y + 10, { width: 90, continued: false });
      doc.fillColor(DARK).fontSize(9).font('Helvetica').text(r[1], 160, y + 10, { width: W - 115 });
      y += rowH;
    });
    y += 10;

    // ── Section 4: Indemnity
    sectionHeader('4', 'Indemnity & Waiver');

    const clauses = [
      'The Guest enters and uses the premises, including the rooms, chapels, and gardens, entirely at their own risk.',
      'Rivier Plaas, its owners, and employees shall not be held liable for any loss, damage, theft of personal property, or any injury/death sustained by the Guest while on the premises, regardless of the cause.',
      'The Guest indemnifies the Venue against any claims arising from their stay or participation in any functions.',
    ];

    doc.rect(50, y, W, 86).fill(YELLOW).stroke(YBORDER);
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text('By staying at Rivier Plaas, the guest acknowledges and agrees to the following:', 62, y + 8, { width: W - 24 });
    let cy = y + 22;
    clauses.forEach((c, i) => {
      doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold').text(`${i + 1}.`, 62, cy, { continued: false });
      doc.fillColor(DARK).fontSize(9).font('Helvetica').text(c, 76, cy, { width: W - 40 });
      cy += 22;
    });
    y += 96;

    // ── Signature section
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(2).stroke();
    y += 12;

    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('GUEST NAME', 50, y);
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('DATE', 400, y);
    y += 12;
    doc.fillColor(DARK).fontSize(10).font('Helvetica').text(guestName, 50, y);
    doc.fillColor(DARK).fontSize(10).font('Helvetica').text(today, 400, y);
    y += 28;
    doc.moveTo(50, y).lineTo(340, y).strokeColor(DARK).lineWidth(1).stroke();
    doc.moveTo(400, y).lineTo(545, y).strokeColor(DARK).lineWidth(1).stroke();
    y += 6;
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('SIGNATURE', 50, y);
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('DATE SIGNED', 400, y);

    // Footer
    doc.moveTo(50, 780).lineTo(545, 780).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(GREY).fontSize(8).font('Helvetica')
       .text(`${BUSINESS.name}  |  ${BUSINESS.address}  |  ${BUSINESS.phone}`, 50, 786, { align: 'center', width: W });

    doc.end();
  });
}

module.exports = { generateInvoicePDF, generateGuestDirectoryPDF, BUSINESS };
