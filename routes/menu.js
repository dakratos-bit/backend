const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { getMenu, createMenuItem, updateMenuItem, deleteMenuItem } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

// Photos get saved to disk with a random filename (keeps the original
// extension so the browser still knows how to render it).
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// GET /api/menu — public, anyone browsing the site
router.get('/menu', (req, res) => {
  res.json({ items: getMenu() });
});

// POST /api/admin/menu — create a new item, with an optional photo.
// Sent as multipart/form-data since it may include a file.
router.post('/admin/menu', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const { name, description, price, category, available } = req.body;
  const priceNum = parseFloat(price);

  if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required.' });
  if (!priceNum || priceNum <= 0) return res.status(400).json({ error: 'Enter a valid price.' });
  if (!category || !category.trim()) return res.status(400).json({ error: 'Category is required.' });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const item = createMenuItem({
    name: name.trim(),
    description: (description || '').trim(),
    price: priceNum,
    category: category.trim(),
    available: available === undefined ? true : available === 'true' || available === true,
    imageUrl,
  });
  res.status(201).json({ item });
});

// POST /api/admin/menu/banana-bread — adds a topping with per-size pricing.
// Separate from the regular /admin/menu route above (which stays for
// flat-price items like cake fillings, or any future simple menu item).
// Any size left blank is simply not offered for that topping.
router.post('/admin/menu/banana-bread', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const { name, description, sixInOne, big, medium, small, available } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Topping name is required.' });

  const variants = [];
  if (sixInOne && parseFloat(sixInOne) > 0) variants.push({ label: '6-in-1 Mini Loaves', price: parseFloat(sixInOne) });
  if (big && parseFloat(big) > 0) variants.push({ label: 'Big', price: parseFloat(big) });
  if (medium && parseFloat(medium) > 0) variants.push({ label: 'Medium', price: parseFloat(medium) });
  if (small && parseFloat(small) > 0) variants.push({ label: 'Small', price: parseFloat(small) });

  if (variants.length === 0) {
    return res.status(400).json({ error: 'Enter a price for at least one size.' });
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const item = createMenuItem({
    name: name.trim(),
    description: (description || '').trim(),
    category: 'Banana Bread',
    price: null,
    variants,
    available: available === undefined ? true : available === 'true' || available === true,
    imageUrl,
  });
  res.status(201).json({ item });
});

// PUT /api/admin/menu/:id — edit an item's fields (JSON body — used for the
// availability toggle in the dashboard; doesn't currently handle photo changes)
router.put('/admin/menu/:id', requireAdmin, (req, res) => {
  const { name, description, price, category, available } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (price !== undefined) updates.price = price;
  if (category !== undefined) updates.category = category.trim();
  if (available !== undefined) updates.available = available;

  const item = updateMenuItem(req.params.id, updates);
  if (!item) return res.status(404).json({ error: 'Menu item not found.' });
  res.json({ item });
});

// DELETE /api/admin/menu/:id
router.delete('/admin/menu/:id', requireAdmin, (req, res) => {
  const ok = deleteMenuItem(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Menu item not found.' });
  res.json({ ok: true });
});

module.exports = router;
