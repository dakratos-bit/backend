const { Pool } = require('pg');

// ── Connect ──
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Schemas ──
const menuItemSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: () => genId('item') },
  name: String,
  description: String,
  category: String,
  price: { type: Number, default: null },
  variants: { type: Array, default: null },
  available: { type: Boolean, default: true },
  imageUrl: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const orderSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: () => genId('order') },
  customerName: String,
  phone: String,
  email: { type: String, default: null },
  fulfillment: String,
  address: String,
  items: Array,
  total: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const adminSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: () => genId('admin') },
  username: String,
  passwordHash: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
const Order = mongoose.model('Order', orderSchema);
const Admin = mongoose.model('Admin', adminSchema);

// ── Menu ──
async function getMenu() {
  return await MenuItem.find().lean();
}

async function createMenuItem({ name, description, price, category, available, imageUrl, variants }) {
  const item = await MenuItem.create({
    name, description, category,
    price: price !== undefined ? price : null,
    variants: variants && variants.length ? variants : null,
    available: available !== false,
    imageUrl: imageUrl || null,
  });
  return item.toObject();
}

async function updateMenuItem(id, updates) {
  const item = await MenuItem.findOneAndUpdate({ id }, updates, { new: true }).lean();
  return item || null;
}

async function deleteMenuItem(id) {
  const res = await MenuItem.deleteOne({ id });
  return res.deletedCount > 0;
}

// ── Orders ──
async function getOrders() {
  return await Order.find().sort({ createdAt: -1 }).lean();
}

async function createOrder({ customerName, phone, email, fulfillment, address, items, total }) {
  const order = await Order.create({
    customerName, phone, email: email || null, fulfillment, address,
    items, total, status: 'pending',
  });
  return order.toObject();
}

async function updateOrderStatus(id, status) {
  const order = await Order.findOneAndUpdate({ id }, { status }, { new: true }).lean();
  return order || null;
}

// ── Admins ──
async function findAdminByUsername(username) {
  return await Admin.findOne({ username: new RegExp(`^${username || ''}$`, 'i') }).lean();
}

async function findAdminById(id) {
  return await Admin.findOne({ id }).lean();
}

async function createAdmin({ username, passwordHash }) {
  const admin = await Admin.create({ username, passwordHash });
  return admin.toObject();
}

module.exports = {
  getMenu, createMenuItem, updateMenuItem, deleteMenuItem,
  getOrders, createOrder, updateOrderStatus,
  findAdminByUsername, findAdminById, createAdmin,
};
