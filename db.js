const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Create tables if they don't exist yet ──
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      category TEXT,
      price NUMERIC,
      variants JSONB,
      available BOOLEAN DEFAULT true,
      image_url TEXT,
      created_at TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      phone TEXT,
      email TEXT,
      fulfillment TEXT,
      address TEXT,
      items JSONB,
      total NUMERIC,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT,
      password_hash TEXT,
      created_at TEXT
    );
  `);
}
ensureTables()
  .then(() => console.log('Database tables ready'))
  .catch(err => console.error('Failed to set up tables:', err.message));

// ── Helpers to convert DB rows back to the same shape the app expects ──
function mapMenuItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price !== null ? Number(row.price) : null,
    variants: row.variants || null,
    available: row.available,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    fulfillment: row.fulfillment,
    address: row.address,
    items: row.items,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

// ── Menu ──
async function getMenu() {
  const { rows } = await pool.query('SELECT * FROM menu_items ORDER BY created_at ASC');
  return rows.map(mapMenuItem);
}

async function createMenuItem({ name, description, price, category, available, imageUrl, variants }) {
  const id = genId('item');
  const createdAt = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO menu_items (id, name, description, category, price, variants, available, image_url, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      id, name, description, category,
      price !== undefined ? price : null,
      variants && variants.length ? JSON.stringify(variants) : null,
      available !== false,
      imageUrl || null,
      createdAt,
    ]
  );
  return mapMenuItem(rows[0]);
}

async function updateMenuItem(id, updates) {
  const fieldMap = {
    name: 'name', description: 'description', price: 'price',
    category: 'category', available: 'available', imageUrl: 'image_url', variants: 'variants',
  };
  const setParts = [];
  const values = [];
  let i = 1;
  for (const key of Object.keys(updates)) {
    const col = fieldMap[key];
    if (!col) continue;
    setParts.push(`${col} = $${i}`);
    values.push(key === 'variants' ? JSON.stringify(updates[key]) : updates[key]);
    i++;
  }
  if (setParts.length === 0) return await pool.query('SELECT * FROM menu_items WHERE id = $1', [id]).then(r => mapMenuItem(r.rows[0]));

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE menu_items SET ${setParts.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return mapMenuItem(rows[0]) || null;
}

async function deleteMenuItem(id) {
  const { rowCount } = await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
  return rowCount > 0;
}

// ── Orders ──
async function getOrders() {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  return rows.map(mapOrder);
}

async function createOrder({ customerName, phone, email, fulfillment, address, items, total }) {
  const id = genId('order');
  const createdAt = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO orders (id, customer_name, phone, email, fulfillment, address, items, total, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, customerName, phone, email || null, fulfillment, address, JSON.stringify(items), total, 'pending', createdAt]
  );
  return mapOrder(rows[0]);
}

async function updateOrderStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return mapOrder(rows[0]) || null;
}

// ── Admins ──
async function findAdminByUsername(username) {
  const { rows } = await pool.query(
    'SELECT * FROM admins WHERE LOWER(username) = LOWER($1)',
    [username || '']
  );
  return mapAdmin(rows[0]) || null;
}

async function findAdminById(id) {
  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
  return mapAdmin(rows[0]) || null;
}

async function createAdmin({ username, passwordHash }) {
  const id = genId('admin');
  const createdAt = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO admins (id, username, password_hash, created_at) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, username, passwordHash, createdAt]
  );
  return mapAdmin(rows[0]);
}

module.exports = {
  getMenu, createMenuItem, updateMenuItem, deleteMenuItem,
  getOrders, createOrder, updateOrderStatus,
  findAdminByUsername, findAdminById, createAdmin,
};
