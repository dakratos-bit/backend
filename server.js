require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

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

app.listen(PORT, () => {
  console.log(`The Baker NG backend running on http://localhost:${PORT}`);
});