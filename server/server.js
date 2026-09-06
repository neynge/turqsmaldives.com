require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const app = express();
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      categories: [], products: [],
      settings: { taxRate: 0.08, fxRate: 15.42, shippingFlat: 15, freeShippingOver: 500 },
      orders: [], audit: []
    }, null, 2));
  }
  const x = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  return {
    categories: Array.isArray(x.categories) ? x.categories : [],
    products: Array.isArray(x.products) ? x.products : [],
    settings: x.settings || { taxRate: 0.08, fxRate: 15.42, shippingFlat: 15, freeShippingOver: 500 },
    orders: Array.isArray(x.orders) ? x.orders : [],
    audit: Array.isArray(x.audit) ? x.audit : []
  };
}

let db = loadDb();

function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function audit(action, detail) {
  db.audit.unshift({ at: new Date().toISOString(), action, detail: String(detail || '') });
  db.audit = db.audit.slice(0, 500);
  saveDb();
}

const users = [{
  id: 1,
  email: process.env.ADMIN_EMAIL || 'admin@turqs.com',
  name: 'Store Admin',
  role: 'admin',
  hash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@123', 10)
}];

app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'Turqs Maldives', time: new Date().toISOString()
}));

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const u = users.find(x => x.email === email);
  if (!u || !bcrypt.compareSync(password, u.hash))
    return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign(
    { id: u.id, role: u.role, email: u.email },
    process.env.JWT_SECRET || 'change-this-secret',
    { expiresIn: '8h' }
  );
  res.json({ token, user: { email: u.email, name: u.name, role: u.role } });
});

function auth(role) {
  return (req, res, next) => {
    try {
      const h = String(req.headers.authorization || '');
      const token = h.startsWith('Bearer ') ? h.slice(7) : '';
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret');
      if (role && payload.role !== role) return res.status(403).json({ error: 'Forbidden' });
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorised' });
    }
  };
}

/* Public API */
app.get('/api/categories', (req, res) => res.json({ categories: db.categories }));
app.get('/api/products', (req, res) =>
  res.json({ products: db.products.filter(p => p.active !== false) })
);
app.get('/api/settings', (req, res) => res.json({ settings: db.settings }));

/* Admin snapshot and synchronisation */
app.get('/api/admin/catalog', auth('admin'), (req, res) =>
  res.json({ categories: db.categories, products: db.products, settings: db.settings, audit: db.audit })
);

app.put('/api/admin/catalog', auth('admin'), (req, res) => {
  if (Array.isArray(req.body.categories)) db.categories = req.body.categories;
  if (Array.isArray(req.body.products)) db.products = req.body.products;
  if (req.body.settings && typeof req.body.settings === 'object')
    db.settings = { ...db.settings, ...req.body.settings };
  audit('Catalogue synchronised', 'Admin dashboard saved catalogue/settings');
  res.json({ ok: true, categories: db.categories, products: db.products, settings: db.settings });
});

/* Category CRUD */
app.post('/api/admin/categories', auth('admin'), (req, res) => {
  const id = String(req.body.id || '').trim();
  const name = String(req.body.name || '').trim();
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
  if (db.categories.some(c => c.id === id))
    return res.status(409).json({ error: 'Slug already exists' });

  const category = { id, name, desc: String(req.body.desc || ''), img: String(req.body.img || '') };
  db.categories.push(category);
  audit('Category created', name);
  res.status(201).json({ category });
});

app.put('/api/admin/categories/:id', auth('admin'), (req, res) => {
  const i = db.categories.findIndex(c => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Category not found' });

  const oldId = db.categories[i].id;
  const newId = String(req.body.id || oldId).trim();
  if (newId !== oldId && db.categories.some(c => c.id === newId))
    return res.status(409).json({ error: 'Slug already exists' });

  if (newId !== oldId)
    db.products.forEach(p => { if (p.category === oldId) p.category = newId; });

  db.categories[i] = { ...db.categories[i], ...req.body, id: newId };
  audit('Category updated', db.categories[i].name);
  res.json({ category: db.categories[i] });
});

app.delete('/api/admin/categories/:id', auth('admin'), (req, res) => {
  const affected = db.products.filter(p => p.category === req.params.id);
  const target = req.query.reassignTo;

  if (affected.length) {
    if (target === '__delete__') db.products = db.products.filter(p => p.category !== req.params.id);
    else if (target) db.products.forEach(p => { if (p.category === req.params.id) p.category = target; });
    else return res.status(409).json({ error: `${affected.length} product(s) still use this category` });
  }

  db.categories = db.categories.filter(c => c.id !== req.params.id);
  audit('Category deleted', req.params.id);
  res.json({ ok: true, affected: affected.length });
});

/* Product CRUD */
const nextId = list => list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

app.post('/api/admin/products', auth('admin'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !(Number(b.price) > 0))
    return res.status(400).json({ error: 'name and a positive price are required' });
  if (b.sku && db.products.some(p => p.sku === b.sku))
    return res.status(409).json({ error: 'SKU already exists' });

  const p = { ...b, id: nextId(db.products), price: Number(b.price),
    stock: Number(b.stock) || 0, active: b.active !== false };
  db.products.push(p);
  audit('Product created', p.name);
  res.status(201).json({ product: p });
});

app.put('/api/admin/products/:id', auth('admin'), (req, res) => {
  const i = db.products.findIndex(p => Number(p.id) === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'Product not found' });
  db.products[i] = { ...db.products[i], ...req.body, id: db.products[i].id };
  audit('Product updated', db.products[i].name);
  res.json({ product: db.products[i] });
});

app.patch('/api/admin/products/:id/price', auth('admin'), (req, res) => {
  const p = db.products.find(x => Number(x.id) === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });

  const price = Number(req.body.price);
  if (!(price > 0)) return res.status(400).json({ error: 'Price must be greater than 0' });

  p.price = price;
  if (req.body.old !== undefined) p.old = req.body.old === null ? null : Number(req.body.old);
  if (req.body.stock !== undefined) p.stock = Math.max(0, parseInt(req.body.stock, 10) || 0);
  audit('Product price/stock updated', p.name);
  res.json({ product: p });
});

app.delete('/api/admin/products/:id', auth('admin'), (req, res) => {
  const old = db.products.find(p => Number(p.id) === Number(req.params.id));
  db.products = db.products.filter(p => Number(p.id) !== Number(req.params.id));
  audit('Product deleted', old ? old.name : req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/products/bulk-price', auth('admin'), (req, res) => {
  const { scope = 'all', op, value = 0, rounding = '' } = req.body || {};
  let changed = 0;

  db.products.forEach(p => {
    if (scope !== 'all' && p.category !== scope) return;
    let n = Number(p.price) || 0;
    if (op === 'inc_pct') n *= 1 + Number(value) / 100;
    if (op === 'dec_pct' || op === 'sale') n *= 1 - Number(value) / 100;
    if (op === 'inc_amt') n += Number(value);
    if (op === 'dec_amt') n -= Number(value);
    if (op === 'set') n = Number(value);
    if (n <= 0) return;
    if (rounding === 'int') n = Math.round(n);
    if (rounding === '99') n = Math.floor(n) + 0.99;
    if (rounding === '10') n = Math.round(n / 10) * 10;
    if (op === 'sale') p.old = p.old || p.price;
    if (+n.toFixed(2) !== +Number(p.price).toFixed(2)) {
      p.price = +n.toFixed(2);
      changed++;
    }
  });

  audit('Bulk repricing', `${changed} product(s) changed`);
  res.json({ changed });
});

app.put('/api/admin/settings', auth('admin'), (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  audit('Settings updated', JSON.stringify(req.body));
  res.json({ settings: db.settings });
});

app.get('/api/admin/orders', auth('admin'), (req, res) => res.json({ orders: db.orders }));

/* Stripe checkout */
app.post('/api/checkout/session', async (req, res) => {
  try {
    const { items = [], delivery = {} } = req.body;
    const line_items = items.map(i => {
      const p = db.products.find(x => Number(x.id) === Number(i.id) || x.sku === i.sku);
      if (!p) throw new Error('Unknown product ' + (i.sku || i.id));
      return {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(p.price) * 100),
          product_data: { name: p.name, metadata: { sku: p.sku || '' } }
        },
        quantity: Math.max(1, parseInt(i.qty, 10) || 1)
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: delivery.email,
      line_items,
      success_url: `${process.env.CLIENT_URL}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/checkout.html`
    });

    res.json({ id: session.id, url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Stripe webhook */
app.post('/api/webhook', (req, res) => {
  let event = req.body;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET)
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed')
    console.log('Payment confirmed for session', event.data.object.id);

  res.json({ received: true });
});

/* Serve the storefront from the same Node process. */
app.use(express.static(ROOT, { index: 'index.html', extensions: ['html'] }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(ROOT, 'index.html'));
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Turqs Maldives running on port ${PORT}`));
