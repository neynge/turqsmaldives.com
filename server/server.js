/* ============================================================
   Turqs Maldives API — Express + Stripe + JWT
   npm install && npm start   (see package.json)
   ============================================================ */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use('/api/webhook', express.raw({ type:'application/json' }));
app.use(express.json());

/* ---------------- users (move to a real DB) ---------------- */
const users = [
  { id:1, email:'admin@turqs.com', name:'Store Admin', role:'admin', hash:bcrypt.hashSync('Admin@123',10) },
  { id:2, email:'staff@turqs.com', name:'Back Office', role:'staff', hash:bcrypt.hashSync('Staff@123',10) }
];

/* ---------------- in-memory catalogue (mirror of js/data.js) ---------------- */
let categories = [
  { id:'rings', name:'Rings', desc:'Solitaires, bands & eternity', img:'' },
  { id:'necklaces', name:'Necklaces', desc:'Pendants & chains', img:'' },
  { id:'earrings', name:'Earrings', desc:'Studs, hoops & drops', img:'' },
  { id:'bracelets', name:'Bracelets', desc:'Tennis, bangles & cuffs', img:'' },
  { id:'watches', name:'Watches', desc:'Timeless craftsmanship', img:'' },
  { id:'bridal', name:'Bridal', desc:'Engagement & wedding sets', img:'' }
];
let products = [
  { id:1, name:'Solitaire Halo Ring', category:'rings', sku:'AR-RG-001', price:1290, old:1490, stock:8, active:true },
  { id:2, name:'Eternity Band', category:'rings', sku:'AR-RG-002', price:940, old:null, stock:5, active:true }
];
const nextId = list => list.reduce((m,x)=>Math.max(m,x.id),0)+1;

/* ---------------- auth ---------------- */
app.post('/api/auth/login', (req,res) => {
  const { email, password } = req.body;
  const u = users.find(u => u.email === String(email||'').toLowerCase());
  if(!u || !bcrypt.compareSync(password || '', u.hash))
    return res.status(401).json({ error:'Invalid email or password' });
  const token = jwt.sign({ id:u.id, role:u.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn:'2h' });
  res.json({ token, user:{ email:u.email, name:u.name, role:u.role } });
});

function auth(role){
  return (req,res,next) => {
    try{
      const p = jwt.verify((req.headers.authorization||'').replace('Bearer ',''),
                           process.env.JWT_SECRET || 'dev-secret');
      if(role && p.role !== role) return res.status(403).json({ error:'Forbidden' });
      req.user = p; next();
    }catch(e){ res.status(401).json({ error:'Unauthorised' }); }
  };
}

/* ---------------- public catalogue ---------------- */
app.get('/api/categories', (req,res) => res.json({ categories }));
app.get('/api/products',   (req,res) => res.json({ products: products.filter(p=>p.active !== false) }));

/* ---------------- admin: CATEGORY crud ---------------- */
app.post('/api/admin/categories', auth('admin'), (req,res) => {
  const { id, name } = req.body;
  if(!id || !name) return res.status(400).json({ error:'id and name are required' });
  if(categories.some(c=>c.id===id)) return res.status(409).json({ error:'Slug already exists' });
  categories.push({ id, name, desc:req.body.desc||'', img:req.body.img||'' });
  res.status(201).json({ category:categories.at(-1) });
});
app.put('/api/admin/categories/:id', auth('admin'), (req,res) => {
  const i = categories.findIndex(c=>c.id===req.params.id);
  if(i < 0) return res.status(404).json({ error:'Category not found' });
  const newId = req.body.id || req.params.id;
  if(newId !== req.params.id) products.forEach(p => { if(p.category===req.params.id) p.category = newId; });
  categories[i] = { ...categories[i], ...req.body, id:newId };
  res.json({ category:categories[i] });
});
app.delete('/api/admin/categories/:id', auth('admin'), (req,res) => {
  const { reassignTo } = req.query;              // ?reassignTo=rings | __delete__
  const affected = products.filter(p=>p.category===req.params.id);
  if(affected.length){
    if(reassignTo === '__delete__') products = products.filter(p=>p.category!==req.params.id);
    else if(reassignTo) products.forEach(p => { if(p.category===req.params.id) p.category = reassignTo; });
    else return res.status(409).json({ error:`${affected.length} product(s) still use this category` });
  }
  categories = categories.filter(c=>c.id!==req.params.id);
  res.json({ ok:true, affected:affected.length });
});

/* ---------------- admin: PRODUCT crud ---------------- */
app.post('/api/admin/products', auth('admin'), (req,res) => {
  const b = req.body;
  if(!b.name || !(Number(b.price) > 0)) return res.status(400).json({ error:'name and a positive price are required' });
  if(products.some(p => p.sku === b.sku)) return res.status(409).json({ error:'SKU already exists' });
  const p = { ...b, id:nextId(products), price:Number(b.price), stock:Number(b.stock)||0, active:b.active !== false };
  products.push(p);
  res.status(201).json({ product:p });
});
app.put('/api/admin/products/:id', auth('admin'), (req,res) => {
  const i = products.findIndex(p=>p.id===+req.params.id);
  if(i < 0) return res.status(404).json({ error:'Product not found' });
  products[i] = { ...products[i], ...req.body, id:products[i].id };
  res.json({ product:products[i] });
});
/* price-only endpoint used by the inline table editor */
app.patch('/api/admin/products/:id/price', auth('admin'), (req,res) => {
  const p = products.find(p=>p.id===+req.params.id);
  if(!p) return res.status(404).json({ error:'Product not found' });
  const price = Number(req.body.price);
  if(!(price > 0)) return res.status(400).json({ error:'Price must be greater than 0' });
  p.price = price;
  if(req.body.old !== undefined) p.old = req.body.old === null ? null : Number(req.body.old);
  if(req.body.stock !== undefined) p.stock = Math.max(0, parseInt(req.body.stock,10) || 0);
  res.json({ product:p });
});
app.delete('/api/admin/products/:id', auth('admin'), (req,res) => {
  products = products.filter(p=>p.id!==+req.params.id);
  res.json({ ok:true });
});
/* bulk re-pricing */
app.post('/api/admin/products/bulk-price', auth('admin'), (req,res) => {
  const { scope='all', op, value=0, rounding='' } = req.body;
  let changed = 0;
  products.forEach(p => {
    if(scope !== 'all' && p.category !== scope) return;
    let n = p.price;
    if(op === 'inc_pct') n = p.price * (1 + value/100);
    if(op === 'dec_pct' || op === 'sale') n = p.price * (1 - value/100);
    if(op === 'inc_amt') n = p.price + value;
    if(op === 'dec_amt') n = p.price - value;
    if(op === 'set')     n = value;
    if(n <= 0) return;
    if(rounding === 'int') n = Math.round(n);
    if(rounding === '99')  n = Math.floor(n) + 0.99;
    if(rounding === '10')  n = Math.round(n/10)*10;
    if(op === 'sale') p.old = p.old || p.price;
    if(+n.toFixed(2) !== +p.price.toFixed(2)){ p.price = +n.toFixed(2); changed++; }
  });
  res.json({ changed });
});

app.get('/api/admin/orders', auth('admin'), (req,res) => res.json({ orders: [] }));

/* ---------------- Stripe checkout (server-side pricing!) ---------------- */
app.post('/api/checkout/session', async (req,res) => {
  try{
    const { items = [], delivery = {} } = req.body;
    const line_items = items.map(i => {
      const p = products.find(x => x.id === i.id || x.sku === i.sku);
      if(!p) throw new Error('Unknown product ' + i.sku);
      return { price_data:{ currency:'usd', unit_amount:Math.round(p.price*100),
               product_data:{ name:p.name, metadata:{ sku:p.sku } } },
               quantity:Math.max(1, parseInt(i.qty,10) || 1) };
    });
    const session = await stripe.checkout.sessions.create({
      mode:'payment',
      customer_email:delivery.email,
      line_items,
      shipping_address_collection:{ allowed_countries:['US','GB','CA','AU','IN','AE','SG','DE'] },
      success_url:`${process.env.CLIENT_URL}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${process.env.CLIENT_URL}/checkout.html`
    });
    res.json({ id:session.id, url:session.url });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

/* ---------------- Stripe webhook (source of truth for "paid") ---------------- */
app.post('/api/webhook', (req,res) => {
  let event = req.body;
  try{
    if(process.env.STRIPE_WEBHOOK_SECRET){
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'],
                                             process.env.STRIPE_WEBHOOK_SECRET);
    }
  }catch(err){ return res.status(400).send(`Webhook error: ${err.message}`); }
  if(event.type === 'checkout.session.completed'){
    console.log('Payment confirmed for session', event.data.object.id);
    // TODO: mark the order paid and decrement stock in your database
  }
  res.json({ received:true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Turqs Maldives API running on http://localhost:${PORT}`));
