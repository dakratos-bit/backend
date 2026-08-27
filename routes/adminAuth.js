const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findAdminByUsername, updateAdmin } = require('../db');
const { requireAdmin, JWT_SECRET } = require('../middleware/requireAdmin');

const router = express.Router();

// ── Login rate limiting ──
// Tracks failed login attempts per IP address in memory. After 5 failed
// attempts, that IP is blocked from trying again for 15 minutes. This is
// intentionally simple (no extra npm package, no database table) since a
// single Render instance is all this site runs on — if you ever scale to
// multiple server instances, this would need to move to a shared store
// (like Redis) since each instance would otherwise track attempts separately.
const loginAttempts = new Map(); // ip -> { count, firstAttemptAt, blockedUntil }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_MS = 15 * 60 * 1000;  // 15 minutes

function getClientIp(req) {
  // Render sits behind a proxy, so the real client IP is in this header.
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
}

function checkRateLimit(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return { blocked: false };

  if (entry.blockedUntil && Date.now() < entry.blockedUntil) {
    const minutesLeft = Math.ceil((entry.blockedUntil - Date.now()) / 60000);
    return { blocked: true, minutesLeft };
  }

  // Block has expired, or the attempt window has passed — reset.
  if (entry.blockedUntil && Date.now() >= entry.blockedUntil) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }
  if (Date.now() - entry.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }

  return { blocked: false };
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAttemptAt: Date.now(), blockedUntil: null });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_MS;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

router.post('/login', async (req, res) => {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (rateCheck.blocked) {
    return res.status(429).json({
      error: `Too many failed login attempts. Try again in ${rateCheck.minutesLeft} minute(s).`,
    });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const admin = await findAdminByUsername(username);
  if (!admin) {
    recordFailedAttempt(ip);
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    recordFailedAttempt(ip);
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  // Successful login — clear any prior failed attempts for this IP.
  clearAttempts(ip);

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

// PUT /api/admin/account — change the logged-in admin's username and/or
// password. Requires the current password as confirmation, same as any
// normal "change password" form.
router.put('/account', requireAdmin, async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Enter your current password to confirm changes.' });
  }
  const match = await bcrypt.compare(currentPassword, req.admin.passwordHash);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

  if (!newUsername && !newPassword) {
    return res.status(400).json({ error: 'Enter a new username or new password to change.' });
  }
  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const updates = {};
  if (newUsername && newUsername.trim()) updates.username = newUsername.trim();
  if (newPassword) updates.passwordHash = await bcrypt.hash(newPassword, 10);

  const updated = await updateAdmin(req.admin.id, updates);
  res.json({ admin: { id: updated.id, username: updated.username } });
});

module.exports = router;
