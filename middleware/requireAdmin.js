const jwt = require('jsonwebtoken');
const { findAdminById } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

async function requireAdmin(req, res, next) {
  const token = req.cookies.eatery_admin_session;
  if (!token) return res.status(401).json({ error: 'Admin login required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const admin = await findAdminById(payload.sub);
    if (!admin) return res.status(401).json({ error: 'Admin login required.' });
    req.admin = admin;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }
}

module.exports = { requireAdmin, JWT_SECRET };
