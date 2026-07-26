const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null; // not configured — emails will be skipped, not crash the app
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

const BRAND_NAME = 'The Baker NG';

function orderItemsHtml(order) {
  return order.items.map(i => `<li>${i.qty}x ${i.name} — ₦${(i.price * i.qty).toLocaleString('en-NG')}</li>`).join('');
}

// Sent the moment a customer places an order (if they gave an email).
async function sendOrderConfirmation(order) {
  const t = getTransporter();
  if (!t || !order.email) return; // silently skip — never blocks order placement

  await t.sendMail({
    from: `"${BRAND_NAME}" <${process.env.GMAIL_USER}>`,
    to: order.email,
    subject: `Order confirmed — ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#2B1B12;max-width:480px;">
        <h2 style="color:#C1502E;">Thanks for your order, ${order.customerName.split(' ')[0]}!</h2>
        <p>Your order has been received and is being processed.</p>
        <p style="background:#F3E6D2;border-radius:8px;padding:12px 16px;">
          <strong>Order ID:</strong> ${order.id}<br>
          Save this to track your order.
        </p>
        <ul>${orderItemsHtml(order)}</ul>
        <p><strong>Total: ₦${order.total.toLocaleString('en-NG')}</strong></p>
        <p>Fulfillment: ${order.fulfillment}${order.address ? ' — ' + order.address : ''}</p>
        <p style="color:#8A7863;font-size:12px;">We'll email you again once your order is ready.</p>
      </div>
    `,
  });
}

// Sent when an admin marks the order as completed.
async function sendOrderCompleted(order) {
  const t = getTransporter();
  if (!t || !order.email) return;

  await t.sendMail({
    from: `"${BRAND_NAME}" <${process.env.GMAIL_USER}>`,
    to: order.email,
    subject: `Your order is ready! — ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#2B1B12;max-width:480px;">
        <h2 style="color:#5F6B3E;">Your order is ready 🎉</h2>
        <p>Hi ${order.customerName.split(' ')[0]}, order <strong>${order.id}</strong> is now complete.</p>
        <p>Thanks for ordering from ${BRAND_NAME}!</p>
      </div>
    `,
  });
}

module.exports = { sendOrderConfirmation, sendOrderCompleted };
