const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findAdminByUsername } = require('../db');
const { requireAdmin, JWT_SECRET } = require('../middleware/requireAdmin');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const admin = await findAdminByUsername(username);
  if (!admin) return res.status(401).json({ error: 'Incorrect username or password.' });

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) return res.status(401).json({ error: 'Incorrect username or password.' });

  const token = jwt.sign({ sub: admin.id }, JWT_SECRET, { expiresIn: '12h' });

  // Token is returned in the response body instead of a cookie. The frontend
  // saves this to localStorage and sends it back manually as an Authorization
  // header on every request -- this sidesteps Safari/iOS blocking cross-site
  // cookies, which was breaking admin login on iPhone.
  res.json({ admin: { id: admin.id, username: admin.username }, token });
});

router.post('/logout', (req, res) => {
  // Nothing to clear server-side since there's no cookie/session store --
  // the frontend just deletes the token from localStorage.
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { id: req.admin.id, username: req.admin.username } });
});

module.exports = router;
