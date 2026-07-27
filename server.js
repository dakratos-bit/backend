require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcryptjs');

const { findAdminByUsername, createAdmin } = require('./db');

const adminAuthRoutes = require('./routes/adminAuth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 4100;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5501',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serves uploaded menu item photos, e.g. http://localhost:4100/uploads/abc123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/admin', adminAuthRoutes);
app.use('/api', menuRoutes);
app.use('/api', orderRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Creates the default admin account if one doesn't exist yet.
// Runs on every server start — safe to leave in permanently, since it
// does nothing once an "admin" account already exists in the database.
async function ensureAdmin() {
  try {
    const existing = await findAdminByUsername('admin');
    if (!existing) {
      const passwordHash = await bcrypt.hash('changeme123', 10);
      await createAdmin({ username: 'admin', passwordHash });
      console.log('Default admin created — username: admin / password: changeme123 (change this soon).');
    } else {
      console.log('Admin account already exists, skipping default creation.');
    }
  } catch (err) {
    console.error('ensureAdmin failed:', err.message);
  }
}
ensureAdmin();

app.listen(PORT, () => {
  console.log(`The Baker NG backend running on http://localhost:${PORT}`);
});
