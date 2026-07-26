// Run once with: node seed.js
// Creates a default admin account and the real starter menu (cake fillings
// + banana bread toppings) so the site isn't empty on first run.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createAdmin, findAdminByUsername, createMenuItem, getMenu } = require('./db');

async function seed() {
  if (!findAdminByUsername('admin')) {
    const passwordHash = await bcrypt.hash('changeme123', 10);
    createAdmin({ username: 'admin', passwordHash });
    console.log('Created default admin login:');
    console.log('  username: admin');
    console.log('  password: changeme123');
    console.log('  (change this password before going live)');
  } else {
    console.log('Admin account already exists, skipping.');
  }

  if (getMenu().length > 0) {
    console.log('Menu already has items, skipping.');
    return;
  }

  // ── Cake Fillings (Cake Tubs) — flat price, ₦6,500 each ──
  const cakeFillings = [
    { name: 'Red Velvet', description: 'Cake Tub — red velvet filling.' },
    { name: 'Chocolate Crunch', description: 'Cake Tub — chocolate crunch filling.' },
    { name: 'Cookies and Cream', description: 'Cake Tub — cookies and cream filling.' },
    { name: 'Funfetti', description: 'Cake Tub — funfetti filling.' },
    { name: 'Coconut Flakes', description: 'Cake Tub — coconut flakes filling.' },
    { name: 'Caramel Biscoff', description: 'Cake Tub — caramel biscoff filling.' },
  ];
  cakeFillings.forEach(f => createMenuItem({
    name: f.name,
    description: f.description,
    category: 'Cake Fillings',
    price: 6500,
    available: true,
  }));

  // ── Banana Bread — price varies by size; '-' in the menu photo means that
  // size isn't offered for that topping, so it's simply left out below ──
  const SIXINONE = '6-in-1 Mini Loaves', BIG = 'Big', MEDIUM = 'Medium', SMALL = 'Small';
  const bananaBread = [
    { name: 'Plain',                 prices: { [SIXINONE]: 7500, [BIG]: 9500,  [MEDIUM]: 5500, [SMALL]: 1800 } },
    { name: 'White Choc',            prices: { [SIXINONE]: 9000, [BIG]: 11000, [MEDIUM]: 6500, [SMALL]: 2000 } },
    { name: 'Oreos',                 prices: { [SIXINONE]: 8500, [BIG]: 10500, [MEDIUM]: 6500, [SMALL]: 2000 } },
    { name: 'Wafer',                 prices: { [SIXINONE]: 8000, [BIG]: 10000, [MEDIUM]: 6000, [SMALL]: 2000 } },
    { name: 'Red Velvet',            prices: { [SIXINONE]: 8000, [BIG]: 10000, [MEDIUM]: 6000, [SMALL]: 1800 } },
    { name: 'Coconut',               prices: { [SIXINONE]: 9000, [BIG]: 11000, [MEDIUM]: 6500, [SMALL]: 2000 } },
    { name: 'Dark Chocolate',        prices: { [SIXINONE]: 9000, [BIG]: 11000, [MEDIUM]: 6500, [SMALL]: 2000 } },
    { name: 'Raisin',                prices: { [SIXINONE]: 9000, [BIG]: 11000, [MEDIUM]: 6500, [SMALL]: 2300 } },
    { name: 'Double Dark Chocolate', prices: { [SIXINONE]: 9500, [BIG]: 13000, [MEDIUM]: 7000, [SMALL]: 2300 } },
    { name: 'Mixed Chocolate Chip',  prices: { [SIXINONE]: 9000, [BIG]: 11000, [MEDIUM]: 6500, [SMALL]: 2300 } },
    { name: 'Almond',                prices: { [SIXINONE]: 10000, [BIG]: 12000, [MEDIUM]: 7000, [SMALL]: 2500 } },
    { name: 'Biscoff',               prices: { [SIXINONE]: 10500, [BIG]: 13000, [MEDIUM]: 7500, [SMALL]: 2500 } },
    { name: 'Lemon',                 prices: { [BIG]: 12000 } },
    { name: 'Carrot',                prices: { [BIG]: 12000 } },
    { name: 'Gluten Free',           prices: { [BIG]: 19000 } },
  ];
  bananaBread.forEach(b => {
    const variants = Object.entries(b.prices).map(([label, price]) => ({ label, price }));
    createMenuItem({
      name: b.name,
      description: '',
      category: 'Banana Bread',
      price: null,
      variants,
      available: true,
    });
  });

  console.log(`Seeded ${cakeFillings.length} cake fillings and ${bananaBread.length} banana bread toppings.`);
}

seed();
