const express = require('express');
const { getMenu, createOrder, getOrders, updateOrderStatus } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');
const { sendOrderConfirmation, sendOrderCompleted } = require('../mailer');

const router = express.Router();
const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

// POST /api/orders — customer checkout. Prices are re-validated against the
// real menu server-side so a customer can't tamper with prices client-side.
router.post('/orders', async (req, res) => {
  const { customerName, phone, email, fulfillment, address, items } = req.body;

  if (!customerName || !customerName.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!phone || !/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!['pickup', 'delivery'].includes(fulfillment)) return res.status(400).json({ error: 'Choose pickup or delivery.' });
  if (fulfillment === 'delivery' && (!address || !address.trim())) return res.status(400).json({ error: 'Delivery address is required.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });

  const menu = getMenu();
  let total = 0;
  const resolvedItems = [];

  for (const line of items) {
    const menuItem = menu.find(m => m.id === line.menuItemId);
    if (!menuItem) return res.status(400).json({ error: `Item no longer available.` });
    if (!menuItem.available) return res.status(400).json({ error: `${menuItem.name} is currently unavailable.` });
    const qty = Math.max(1, parseInt(line.qty, 10) || 1);

    let unitPrice, displayName;
    if (menuItem.variants && menuItem.variants.length) {
      // Size-based item (e.g. Banana Bread) — the client must specify which size.
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

  const order = createOrder({
    customerName: customerName.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : null,
    fulfillment,
    address: fulfillment === 'delivery' ? address.trim() : null,
    items: resolvedItems,
    total,
  });

  // Email is best-effort: if it fails (bad credentials, no internet, etc.)
  // the order still succeeds — the customer already has their order ID on screen.
  try {
    await sendOrderConfirmation(order);
  } catch (err) {
    console.warn('Order confirmation email failed to send:', err.message);
  }

  res.status(201).json({ order });
});

// GET /api/admin/orders — admin order list
router.get('/admin/orders', requireAdmin, (req, res) => {
  res.json({ orders: getOrders() });
});

// PATCH /api/admin/orders/:id/status
router.patch('/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use: ' + VALID_STATUSES.join(', ') });
  }
  const order = updateOrderStatus(req.params.id, status);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (status === 'completed') {
    try {
      await sendOrderCompleted(order);
    } catch (err) {
      console.warn('Order completed email failed to send:', err.message);
    }
  }

  res.json({ order });
});

// GET /api/admin/stats — basic sales stats
router.get('/admin/stats', requireAdmin, (req, res) => {
  const orders = getOrders();
  const completed = orders.filter(o => o.status !== 'cancelled');

  const todayStr = new Date().toDateString();
  const todaysOrders = completed.filter(o => new Date(o.createdAt).toDateString() === todayStr);

  const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
  const todaysRevenue = todaysOrders.reduce((sum, o) => sum + o.total, 0);

  const itemCounts = {};
  completed.forEach(o => o.items.forEach(i => {
    itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty;
  }));
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  res.json({
    totalOrders: completed.length,
    totalRevenue,
    todaysOrders: todaysOrders.length,
    todaysRevenue,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    topItems,
  });
});

// GET /api/admin/customers — aggregates orders by phone number to surface repeat customers
router.get('/admin/customers', requireAdmin, (req, res) => {
  const orders = getOrders(); // already sorted newest-first
  const map = {};

  orders.forEach(o => {
    if (!map[o.phone]) {
      map[o.phone] = {
        phone: o.phone,
        name: o.customerName,       // first one seen = most recent, since orders are newest-first
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: o.createdAt,
      };
    }
    const c = map[o.phone];
    c.orderCount += 1;
    if (o.status !== 'cancelled') c.totalSpent += o.total;
    c.firstOrderAt = o.createdAt; // keeps being overwritten; final value = oldest order, since list is newest-first
  });

  const customers = Object.values(map).sort((a, b) => b.orderCount - a.orderCount);
  res.json({ customers });
});

// GET /api/orders/track — public order lookup for customers.
// Requires both the order ID and the phone used at checkout, so a guessed
// or leaked order ID alone isn't enough to see someone else's order.
router.get('/orders/track', (req, res) => {
  const { orderId, phone } = req.query;
  if (!orderId || !phone) {
    return res.status(400).json({ error: 'Enter your order ID and phone number.' });
  }
  const normalizedPhone = phone.replace(/\D/g, '');
  const order = getOrders().find(o =>
    o.id === orderId.trim() && o.phone.replace(/\D/g, '').endsWith(normalizedPhone.slice(-10))
  );
  if (!order) {
    return res.status(404).json({ error: 'No matching order found. Check your order ID and phone number.' });
  }
  res.json({ order });
});

module.exports = router;
