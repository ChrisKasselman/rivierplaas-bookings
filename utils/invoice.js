const fs = require('fs');
const path = require('path');

const BUSINESS = {
  name:    'Rivierplaas',
  address: 'End Langenhoven Street, Riversdale, Meyerton, 1961',
  phone:   '083 320 3760',
  email:   'payments.rivierplaas@gmail.com',
  bank:    'FNB',
  account_holder: 'Rivierplaas',
  account_number: '63153487278',
  branch_code:    '250655',
};

function logoBase64() {
  try {
    const imgPath = path.join(__dirname, '../public/images/logo.jpg');
    return 'data:image/jpeg;base64,' + fs.readFileSync(imgPath).toString('base64');
  } catch { return ''; }
}

function generateInvoiceHTML(invoice) {
  const logo = logoBase64();
  const ref = `${invoice.firstname} ${invoice.surname}`.toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const typeLabel = invoice.invoice_type === 'deposit' ? 'DEPOSIT INVOICE' : 'FINAL INVOICE';
  const statusColor = invoice.invoice_type === 'deposit' ? '#d97706' : '#059669';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; border-bottom: 3px solid #4f7942; padding-bottom: 24px; }
  .logo { width: 180px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h1 { font-size: 22px; font-weight: 800; color: #4f7942; letter-spacing: 0.05em; }
  .invoice-meta .type-badge { display: inline-block; background: ${statusColor}; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; padding: 3px 10px; border-radius: 20px; margin-top: 4px; }
  .invoice-meta .inv-num { font-size: 12px; color: #6b7280; margin-top: 6px; }
  .invoice-meta .inv-date { font-size: 12px; color: #6b7280; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .party { width: 48%; }
  .party-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #9ca3af; text-transform: uppercase; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #4b5563; line-height: 1.6; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .items-table th { background: #4f7942; color: #fff; padding: 10px 14px; text-align: left; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
  .items-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table .amount { text-align: right; font-weight: 600; }
  .total-box { margin-left: auto; width: 260px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; }
  .total-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; color: #4b5563; }
  .total-row.final { font-size: 16px; font-weight: 800; color: #1a1a2e; border-top: 2px solid #4f7942; padding-top: 10px; margin-top: 10px; }
  .payment-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px; }
  .payment-box h3 { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4f7942; margin-bottom: 10px; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .payment-row { font-size: 12px; color: #374151; }
  .payment-row span { font-weight: 600; }
  .reference-box { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 12px 20px; margin-bottom: 28px; font-size: 13px; }
  .reference-box strong { color: #854d0e; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body>

<div class="header">
  <img src="${logo}" class="logo" alt="Rivierplaas">
  <div class="invoice-meta">
    <h1>INVOICE</h1>
    <div class="type-badge">${typeLabel}</div>
    <div class="inv-num">Invoice #${invoice.invoice_number}</div>
    <div class="inv-date">Date: ${dateStr}</div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-label">From</div>
    <div class="party-name">${BUSINESS.name}</div>
    <div class="party-detail">
      ${BUSINESS.address}<br>
      Tel: ${BUSINESS.phone}<br>
      Email: ${BUSINESS.email}
    </div>
  </div>
  <div class="party">
    <div class="party-label">Invoice to</div>
    <div class="party-name">${invoice.firstname} ${invoice.surname}</div>
    <div class="party-detail">
      ${invoice.email}<br>
      Booking ref: ${ref}
    </div>
  </div>
</div>

<hr class="divider">

<table class="items-table">
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${invoice.description || (invoice.booking_type === 'room' ? 'Room booking' : 'Wedding venue booking')}</td>
      <td class="amount">R ${parseFloat(invoice.amount).toFixed(2)}</td>
    </tr>
  </tbody>
</table>

<div class="total-box">
  <div class="total-row final">
    <span>${invoice.invoice_type === 'deposit' ? 'Deposit due' : 'Total due'}</span>
    <span>R ${parseFloat(invoice.amount).toFixed(2)}</span>
  </div>
</div>

<div class="payment-box">
  <h3>Payment details</h3>
  <div class="payment-grid">
    <div class="payment-row">Bank: <span>${BUSINESS.bank}</span></div>
    <div class="payment-row">Account holder: <span>${BUSINESS.account_holder}</span></div>
    <div class="payment-row">Account number: <span>${BUSINESS.account_number}</span></div>
    <div class="payment-row">Branch code: <span>${BUSINESS.branch_code}</span></div>
  </div>
</div>

<div class="reference-box">
  ⚠️ <strong>Payment reference:</strong> Please use <strong>${ref}</strong> as your payment reference so we can identify your payment.
</div>

<div class="footer">
  Thank you for choosing Rivierplaas. We look forward to hosting you.<br>
  ${BUSINESS.name} · ${BUSINESS.address} · ${BUSINESS.phone}
</div>

</body>
</html>`;
}

async function generatePDF(html) {
  const htmlPdf = require('html-pdf-node');
  const file = { content: html };
  const options = { format: 'A4', margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' } };
  return await htmlPdf.generatePdf(file, options);
}


function generateGuestDirectoryHTML(invoice, gateCode = '[Insert Code Here]', emergencyContact = '083 320 3760') {
  const logo = logoBase64();
  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const guestName = `${invoice.firstname} ${invoice.surname}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 40px; }

  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #4f7942; }
  .logo { width: 160px; }
  .header-right { text-align: right; }
  .header-right h1 { font-size: 19px; font-weight: 800; color: #4f7942; line-height: 1.3; }
  .header-right .subtitle { font-size: 11px; color: #9ca3af; margin-top: 4px; letter-spacing: 0.04em; }

  .welcome-box { background: #f0fdf4; border-left: 4px solid #4f7942; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 24px; }
  .welcome-box p { font-size: 12.5px; color: #374151; line-height: 1.7; }
  .welcome-box strong { color: #4f7942; }

  .section { margin-bottom: 22px; }
  .section-title { font-size: 14px; font-weight: 800; color: #4f7942; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
  .section-num { background: #4f7942; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }

  .times-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .time-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
  .time-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 4px; }
  .time-value { font-size: 18px; font-weight: 800; color: #1a1a2e; }
  .time-note { font-size: 10px; color: #6b7280; margin-top: 3px; }

  .access-table { width: 100%; border-collapse: collapse; }
  .access-table td { padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 13px; }
  .access-table td:first-child { background: #f9fafb; font-weight: 700; width: 40%; color: #374151; }
  .access-table td:last-child { color: #1a1a2e; font-weight: 600; letter-spacing: 0.05em; }

  .rules-list { list-style: none; }
  .rules-list li { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; line-height: 1.6; }
  .rules-list li:last-child { border-bottom: none; }
  .rule-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .rule-text strong { color: #1a1a2e; }
  .rule-text { color: #4b5563; }

  .indemnity-box { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; }
  .indemnity-box p { font-size: 12px; color: #374151; line-height: 1.7; margin-bottom: 8px; }
  .indemnity-list { padding-left: 16px; }
  .indemnity-list li { font-size: 12px; color: #4b5563; line-height: 1.7; margin-bottom: 4px; }

  .signature-section { margin-top: 24px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
  .sig-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .sig-field { border-bottom: 1.5px solid #1a1a2e; padding-bottom: 4px; margin-top: 24px; }
  .sig-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-top: 6px; }
  .sig-prefill { font-size: 13px; color: #4b5563; padding: 4px 0; }

  .footer { margin-top: 28px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 14px; }
  .green { color: #4f7942; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <img src="${logo}" class="logo" alt="Rivierplaas">
  <div class="header-right">
    <h1>Guest Directory<br>&amp; Indemnity</h1>
    <div class="subtitle">ACCOMMODATION DOCUMENT · ${today}</div>
  </div>
</div>

<!-- Welcome -->
<div class="welcome-box">
  <p><strong>Welcome to Rivier Plaas, ${guestName}!</strong> We are delighted to have you stay with us. To ensure a safe and pleasant experience for all guests, please review the following information carefully.</p>
</div>

<!-- Section 1: Check-in/out -->
<div class="section">
  <div class="section-title"><span class="section-num">1</span> Check-In &amp; Check-Out Times</div>
  <div class="times-grid">
    <div class="time-card">
      <div class="time-label">Check-In</div>
      <div class="time-value">14:00</div>
      <div class="time-note">Rooms available from 2:00 PM</div>
    </div>
    <div class="time-card">
      <div class="time-label">Check-Out</div>
      <div class="time-value">10:00</div>
      <div class="time-note">Strictly enforced for venue turnover</div>
    </div>
  </div>
</div>

<!-- Section 2: Access & Safety -->
<div class="section">
  <div class="section-title"><span class="section-num">2</span> Important Access &amp; Safety</div>
  <table class="access-table">
    <tr>
      <td>🔑 Main Gate Code</td>
      <td>${gateCode}</td>
    </tr>
    <tr>
      <td>📞 Emergency Contact</td>
      <td>${emergencyContact}</td>
    </tr>
  </table>
</div>

<!-- Section 3: House Rules -->
<div class="section">
  <div class="section-title"><span class="section-num">3</span> House Rules</div>
  <ul class="rules-list">
    <li>
      <span class="rule-icon">🔊</span>
      <span class="rule-text"><strong>Noise:</strong> Please respect other guests. Music and loud noise must be curtailed after 00:00.</span>
    </li>
    <li>
      <span class="rule-icon">🚬</span>
      <span class="rule-text"><strong>Smoking:</strong> Strictly no smoking inside the rooms or bridal suites. Please use designated outdoor areas only.</span>
    </li>
    <li>
      <span class="rule-icon">💔</span>
      <span class="rule-text"><strong>Damage:</strong> Any breakages or damage to property will be billed to the guest.</span>
    </li>
    <li>
      <span class="rule-icon">💧</span>
      <span class="rule-text"><strong>Water &amp; Power:</strong> Please use water sparingly. Ensure all lights and AC units are turned off when leaving the room.</span>
    </li>
  </ul>
</div>

<!-- Section 4: Indemnity -->
<div class="section">
  <div class="section-title"><span class="section-num">4</span> Indemnity &amp; Waiver</div>
  <div class="indemnity-box">
    <p>By staying at Rivier Plaas, the guest (hereafter referred to as "the Guest") acknowledges and agrees to the following:</p>
    <ol class="indemnity-list">
      <li>The Guest enters and uses the premises, including the rooms, chapels, and gardens, entirely at their own risk.</li>
      <li>Rivier Plaas, its owners, and employees shall not be held liable for any loss, damage, theft of personal property, or any injury/death sustained by the Guest while on the premises, regardless of the cause.</li>
      <li>The Guest indemnifies the Venue against any claims arising from their stay or participation in any functions.</li>
    </ol>
  </div>
</div>

<!-- Signature -->
<div class="signature-section">
  <div class="sig-grid">
    <div>
      <div class="sig-label">Guest Name</div>
      <div class="sig-prefill">${guestName}</div>
      <div class="sig-field"></div>
      <div class="sig-label">Signature</div>
    </div>
    <div>
      <div class="sig-label">Date</div>
      <div class="sig-prefill">${today}</div>
      <div class="sig-field"></div>
      <div class="sig-label">Date signed</div>
    </div>
  </div>
</div>

<div class="footer">
  Rivier Plaas · End Langenhoven Street, Riversdale, Meyerton, 1961 · 083 320 3760 · payments.rivierplaas@gmail.com
</div>

</body>
</html>`;
}

module.exports = { generateInvoiceHTML, generateGuestDirectoryHTML, generatePDF, BUSINESS };
