const fs = require('fs');
const path = require('path');

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

const GREEN  = '#4f7942';
const DARK   = '#1a1a2e';
const GREY   = '#6b7280';
const LGREY  = '#f3f4f6';
const YELLOW = '#fefce8';
const YBORDER= '#fde047';

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
    try {
      doc.image(logoPath(), 50, 40, { width: 130 });
    } catch(e) {}

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
    doc.y = 145;
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
    const totalY = 320;
    doc.rect(350, totalY, 195, 45).fill('#f9fafb').stroke('#e5e7eb');
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(invoice.invoice_type === 'deposit' ? 'Deposit due:' : 'Total due:', 360, totalY + 8);
    doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold')
       .text(`R ${parseFloat(invoice.amount).toFixed(2)}`, 360, totalY + 22);

    // Payment details box
    const payY = 390;
    doc.rect(50, payY, W, 90).fill('#f0fdf4').stroke('#86efac');
    doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold')
       .text('PAYMENT DETAILS', 65, payY + 10);
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text(`Bank: ${BUSINESS.bank}`, 65, payY + 25)
       .text(`Account holder: ${BUSINESS.account_holder}`, 65, payY + 38)
       .text(`Account number: ${BUSINESS.account_number}`, 65, payY + 51)
       .text(`Branch code: ${BUSINESS.branch_code}`, 65, payY + 64);

    // Reference box
    const refY = 500;
    doc.rect(50, refY, W, 36).fill(YELLOW).stroke(YBORDER);
    doc.fillColor('#854d0e').fontSize(9).font('Helvetica-Bold')
       .text('PAYMENT REFERENCE: ', 65, refY + 8, { continued: true });
    doc.font('Helvetica')
       .text(`Please use "${guestRef}" as your payment reference.`, { continued: false });
    doc.fillColor('#854d0e').fontSize(8).font('Helvetica')
       .text('This ensures we can identify and allocate your payment correctly.', 65, refY + 22);

    // Footer
    doc.moveTo(50, 760).lineTo(545, 760).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(GREY).fontSize(8).font('Helvetica')
       .text(`${BUSINESS.name} · ${BUSINESS.address} · ${BUSINESS.phone}`, 50, 768, { align: 'center', width: W });

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
       .text('Guest Directory', 0, 45, { align: 'right' })
       .text('& Indemnity', 0, 66, { align: 'right' });
    doc.fillColor(GREY).fontSize(9).font('Helvetica')
       .text(`ACCOMMODATION DOCUMENT · ${today}`, 0, 90, { align: 'right' });

    // Green line
    doc.moveTo(50, 115).lineTo(545, 115).strokeColor(GREEN).lineWidth(3).stroke();

    // Welcome box
    doc.rect(50, 125, W, 42).fill('#f0fdf4');
    doc.moveTo(50, 125).lineTo(50, 167).strokeColor(GREEN).lineWidth(4).stroke();
    doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold')
       .text(`Welcome to Rivier Plaas, ${guestName}!`, 62, 132);
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text('We are delighted to have you stay with us. Please review the following information carefully.', 62, 146, { width: W - 20 });

    let y = 185;

    // Section helper
    function section(num, title) {
      doc.rect(50, y, 22, 22).fill(GREEN);
      doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold').text(num, 50, y + 6, { width: 22, align: 'center' });
      doc.fillColor(GREEN).fontSize(12).font('Helvetica-Bold').text(title, 78, y + 5);
      doc.moveTo(50, y + 26).lineTo(545, y + 26).strokeColor('#e5e7eb').lineWidth(1).stroke();
      y += 34;
    }

    // ─ Section 1: Check-in/out
    section('1', 'Check-In & Check-Out Times');
    doc.rect(50, y, (W/2)-5, 44).fill(LGREY);
    doc.rect((W/2)+55, y, (W/2)-5, 44).fill(LGREY);
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold')
       .text('CHECK-IN', 65, y + 7).text('CHECK-OUT', (W/2)+70, y + 7);
    doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold')
       .text('14:00', 65, y + 18).text('10:00', (W/2)+70, y + 18);
    doc.fillColor(GREY).fontSize(7).font('Helvetica')
       .text('Rooms available from 2:00 PM', 65, y + 38)
       .text('Strictly enforced for venue turnover', (W/2)+70, y + 38);
    y += 60;

    // ─ Section 2: Access & Safety
    section('2', 'Important Access & Safety');
    doc.rect(50, y, W, 22).fill(LGREY);
    doc.rect(50, y+22, W, 22).fill('#fff');
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
       .text('🔑  Main Gate Code', 60, y + 7)
       .text('📞  Emergency Contact', 60, y + 29);
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
       .text(gateCode, 300, y + 7)
       .text(emergencyContact, 300, y + 29);
    doc.rect(50, y, W, 44).strokeColor('#e5e7eb').lineWidth(1).stroke();
    y += 58;

    // ─ Section 3: House Rules
    section('3', 'House Rules');
    const rules = [
      ['🔊', 'Noise:', 'Please respect other guests. Music and loud noise must be curtailed after 00:00.'],
      ['🚬', 'Smoking:', 'Strictly no smoking inside the rooms or bridal suites. Please use designated outdoor areas.'],
      ['💔', 'Damage:', 'Any breakages or damage to property will be billed to the guest.'],
      ['💧', 'Water & Power:', 'Please use water sparingly. Ensure all lights and AC units are turned off when leaving the room.'],
    ];
    rules.forEach((r, i) => {
      if (i % 2 === 0) doc.rect(50, y, W, 26).fill(LGREY);
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(`${r[0]}  ${r[1]}`, 60, y + 8, { continued: true, width: 120 });
      doc.font('Helvetica').fillColor(GREY).text(` ${r[2]}`, { width: W - 80, continued: false });
      y += 26;
    });
    y += 10;

    // ─ Section 4: Indemnity
    section('4', 'Indemnity & Waiver');
    doc.rect(50, y, W, 88).fill(YELLOW);
    doc.rect(50, y, W, 88).strokeColor(YBORDER).lineWidth(1).stroke();
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text('By staying at Rivier Plaas, the guest acknowledges and agrees to the following:', 62, y + 8, { width: W - 24 });
    const clauses = [
      'The Guest enters and uses the premises, including the rooms, chapels, and gardens, entirely at their own risk.',
      'Rivier Plaas, its owners, and employees shall not be held liable for any loss, damage, theft of personal property, or any injury/death sustained by the Guest while on the premises.',
      'The Guest indemnifies the Venue against any claims arising from their stay or participation in any functions.',
    ];
    clauses.forEach((c, i) => {
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
         .text(`${i+1}.  ${c}`, 62, y + 22 + (i * 20), { width: W - 24 });
    });
    y += 104;

    // Signature section
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(2).stroke();
    y += 14;
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('GUEST NAME', 50, y).text('DATE', 380, y);
    doc.fillColor(DARK).fontSize(10).font('Helvetica').text(guestName, 50, y + 12).text(today, 380, y + 12);
    doc.moveTo(50, y + 38).lineTo(320, y + 38).strokeColor(DARK).lineWidth(1).stroke();
    doc.moveTo(380, y + 38).lineTo(545, y + 38).strokeColor(DARK).lineWidth(1).stroke();
    doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('SIGNATURE', 50, y + 42).text('DATE SIGNED', 380, y + 42);

    // Footer
    doc.moveTo(50, 780).lineTo(545, 780).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(GREY).fontSize(8).font('Helvetica')
       .text(`${BUSINESS.name} · ${BUSINESS.address} · ${BUSINESS.phone}`, 50, 786, { align: 'center', width: W });

    doc.end();
  });
}

module.exports = { generateInvoicePDF, generateGuestDirectoryPDF, BUSINESS };
