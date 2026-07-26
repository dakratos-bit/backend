const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findAdminByUsername } = require('../db');
const { requireAdmin, JWT_SECRET } = require('../middleware/requireAdmin');

const router = express.Router();
const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours — shorter than customer sessions on purpose

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const admin = findAdminByUsername(username);
  if (!admin) return res.status(401).json({ error: 'Incorrect username or password.' });

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) return res.status(401).json({ error: 'Incorrect username or password.' });

  const token = jwt.sign({ sub: admin.id }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('eatery_admin_session', token, {
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  });
  res.json({ admin: { id: admin.id, username: admin.username } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('eatery_admin_session');
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { id: req.admin.id, username: req.admin.username } });
});

module.exports = router;
