const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'payments.rivierplaas@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    }
  });
}

async function sendInvoiceEmail({ to, name, invoiceNumber, invoiceType, pdfBuffer, directoryPdfBuffer }) {
  const transporter = createTransporter();
  const typeLabel = invoiceType === 'deposit' ? 'Deposit Invoice' : 'Final Invoice';

  const attachments = [
    {
      filename: `Rivierplaas-Invoice-${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }
  ];

  if (directoryPdfBuffer) {
    attachments.push({
      filename: `Rivierplaas-GuestDirectory.pdf`,
      content: directoryPdfBuffer,
      contentType: 'application/pdf'
    });
  }

  await transporter.sendMail({
    from: `"Rivierplaas" <${process.env.GMAIL_USER || 'payments.rivierplaas@gmail.com'}>`,
    to,
    subject: `Rivierplaas — ${typeLabel} #${invoiceNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <p>Dear ${name},</p>
        <p>Please find your <strong>${typeLabel}</strong> attached to this email (Invoice #${invoiceNumber}).</p>
        <p>We have also attached our <strong>Guest Directory & Indemnity</strong> document. Please read it carefully, sign it, and bring it with you on arrival.</p>
        <p>Kindly use your <strong>name and surname</strong> as the payment reference when making your EFT payment.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <br>
        <p>Kind regards,<br><strong>Rivierplaas</strong><br>083 320 3760<br>payments.rivierplaas@gmail.com</p>
      </div>
    `,
    attachments
  });
}

module.exports = { sendInvoiceEmail };
