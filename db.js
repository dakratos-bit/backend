const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'store.json');

function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ menuItems: [], orders: [], admins: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Menu ──
function getMenu() { return readDb().menuItems; }

function createMenuItem({ name, description, price, category, available, imageUrl, variants }) {
  const db = readDb();
  const item = {
    id: genId('item'),
    name, description, category,
    price: price !== undefined ? price : null,       // flat price — used by simple items
    variants: variants && variants.length ? variants : null, // [{label, price}] — used by size-based items like Banana Bread
    available: available !== false,
    imageUrl: imageUrl || null,
    createdAt: new Date().toISOString(),
  };
  db.menuItems.push(item);
  writeDb(db);
  return item;
}

function updateMenuItem(id, updates) {
  const db = readDb();
  const idx = db.menuItems.findIndex(i => i.id === id);
  if (idx === -1) return null;
  db.menuItems[idx] = { ...db.menuItems[idx], ...updates };
  writeDb(db);
  return db.menuItems[idx];
}

function deleteMenuItem(id) {
  const db = readDb();
  const before = db.menuItems.length;
  db.menuItems = db.menuItems.filter(i => i.id !== id);
  writeDb(db);
  return db.menuItems.length < before;
}

// ── Orders ──
function getOrders() { return readDb().orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }

function createOrder({ customerName, phone, email, fulfillment, address, items, total }) {
  const db = readDb();
  const order = {
    id: genId('order'),
    customerName, phone, email: email || null, fulfillment, address,
    items, total,
    status: 'pending', // pending -> preparing -> ready -> completed (or cancelled)
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  writeDb(db);
  return order;
}

function updateOrderStatus(id, status) {
  const db = readDb();
  const idx = db.orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  db.orders[idx].status = status;
  writeDb(db);
  return db.orders[idx];
}

// ── Admins ──
function findAdminByUsername(username) {
  const db = readDb();
  return db.admins.find(a => a.username.toLowerCase() === (username || '').toLowerCase());
}

function findAdminById(id) {
  const db = readDb();
  return db.admins.find(a => a.id === id);
}

function createAdmin({ username, passwordHash }) {
  const db = readDb();
  const admin = { id: genId('admin'), username, passwordHash, createdAt: new Date().toISOString() };
  db.admins.push(admin);
  writeDb(db);
  return admin;
}

module.exports = {
  getMenu, createMenuItem, updateMenuItem, deleteMenuItem,
  getOrders, createOrder, updateOrderStatus,
  findAdminByUsername, findAdminById, createAdmin,
};
