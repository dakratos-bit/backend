// Emails are sent via Brevo's HTTP API instead of Gmail/SMTP. Render's free
// tier blocks outbound traffic on SMTP ports (25, 465, 587) as of Sept 2025,
// so nodemailer + Gmail cannot work here regardless of credentials. Brevo's
// API runs over normal HTTPS, which isn't blocked.

const BRAND_NAME = 'The Baker NG';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function isConfigured() {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

async function sendViaBrevo({ to, subject, html }) {
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: BRAND_NAME, email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${body}`);
  }
}

function orderItemsHtml(order) {
  return order.items.map(i => `<li>${i.qty}x ${i.name} — ₦${(i.price * i.qty).toLocaleString('en-NG')}</li>`).join('');
}

// Sent the moment a customer places an order (if they gave an email).
async function sendOrderConfirmation(order) {
  if (!isConfigured() || !order.email) return; // silently skip — never blocks order placement

  await sendViaBrevo({
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
  if (!isConfigured() || !order.email) return;

  await sendViaBrevo({
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
