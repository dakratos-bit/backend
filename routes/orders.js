const express = require('express');
const axios = require('axios');
const { getMenu, createOrder, getOrders, updateOrderStatus, updateOrder } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');
const { sendOrderConfirmation, sendOrderCompleted } = require('../mailer');

const router = express.Router();

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

// POST /api/orders — customer checkout. Prices are re-validated against the
// real menu server-side so a customer can't tamper with prices client-side.
router.post('/orders', async (req, res) => {
  const { customerName, phone, email, fulfillment, address, items, paymentReference } = req.body;

  if (!customerName || !customerName.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!phone || !/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!['pickup', 'delivery'].includes(fulfillment)) return res.status(400).json({ error: 'Choose pickup or delivery.' });
  if (fulfillment === 'delivery' && (!address || !address.trim())) return res.status(400).json({ error: 'Delivery address is required.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!paymentReference) return res.status(400).json({ error: 'Payment reference is missing.' });

  const menu = await getMenu();
  let total = 0;
  const resolvedItems = [];

  for (const line of items) {
    const menuItem = menu.find(m => m.id === line.menuItemId);
    if (!menuItem) return res.status(400).json({ error: `Item no longer available.` });
    if (!menuItem.available) return res.status(400).json({ error: `${menuItem.name} is currently unavailable.` });

    const qty = Math.max(1, parseInt(line.qty, 10) || 1);
    let unitPrice, displayName;

    if (menuItem.variants && menuItem.variants.length) {
      const variant = menuItem.variants.find(v => v.label === line.variantLabel);
      if (!variant) return res.status(400).json({ error: `Choose a valid size for ${menuItem.name}.` });
      unitPrice = variant.price;
      displayName = `${menuItem.name} (${variant.label})`;
    } else {
      unitPrice = menuItem.price;
      displayName = menuItem.name;
    }

    const lineTotal = unitPrice * qty;
    total += lineTotal;
    resolvedItems.push({ menuItemId: menuItem.id, name: displayName, price: unitPrice, qty });
  }

  // Verify payment with Paystack before creating the order — never trust
  // the frontend's claim that payment succeeded.
  try {
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${paymentReference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const paystackData = verifyRes.data.data;

    if (paystackData.status !== 'success') {
      return res.status(400).json({ error: 'Payment was not successful.' });
    }

    const amountPaidNaira = paystackData.amount / 100;
    if (amountPaidNaira < total) {
      return res.status(400).json({ error: 'Amount paid does not match order total.' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Could not verify payment. Please contact us before retrying.' });
  }

  const order = await createOrder({
    customerName: customerName.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : null,
    fulfillment,
    address: fulfillment === 'delivery' ? address.trim() : null,
    items: resolvedItems,
    total,
    paymentReference,
  });

  // Email is best-effort and fired without waiting on it — the customer
  // already has their order ID on screen and shouldn't be stuck staring at
  // a spinner just because Gmail/SMTP is slow or unreachable right now.
  sendOrderConfirmation(order).catch(err => {
    console.warn('Order confirmation email failed to send:', err.message);
  });

  res.status(201).json({ order });
});
