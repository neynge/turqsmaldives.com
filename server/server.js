require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const app = express();
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PRODUCT_UPLOAD_DIR = path.join(UPLOAD_DIR, 'products');
const CATEGORY_UPLOAD_DIR = path.join(UPLOAD_DIR, 'categories');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CATEGORY_UPLOAD_DIR, { recursive: true });
const DEFAULT_DB = { categories: [], products: [], settings: { taxRate: 0.08, fxRate: 15.42, shippingFlat: 15, freeShippingOver: 500 }, orders: [], audit: [] };
function loadDb(){
  if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB,null,2),'utf8');
  try { const x=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); return { categories:Array.isArray(x.categories)?x.categories:[], products:Array.isArray(x.products)?x.products:[], settings:x.settings&&typeof x.settings==='object'?{...DEFAULT_DB.settings,...x.settings}:{...DEFAULT_DB.settings}, orders:Array.isArray(x.orders)?x.orders:[], audit:Array.isArray(x.audit)?x.audit:[] }; }
  catch(err){ console.error('Database read error:',err); return JSON.parse(JSON.stringify(DEFAULT_DB)); }
}
let db=loadDb();
function saveDb(){ const tmpFile=DB_FILE+'.tmp'; fs.writeFileSync(tmpFile,JSON.stringify(db,null,2),'utf8'); fs.renameSync(tmpFile,DB_FILE); }
function audit(action,detail){ db.audit.unshift({at:new Date().toISOString(),action,detail:String(detail||'')}); db.audit=db.audit.slice(0,500); saveDb(); }
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'admin@turqs.com';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'Admin@123';
const JWT_SECRET=process.env.JWT_SECRET||'CHANGE_THIS_JWT_SECRET';
const users=[{id:1,email:ADMIN_EMAIL.toLowerCase(),name:'Store Admin',role:'admin',hash:bcrypt.hashSync(ADMIN_PASSWORD,10)}];
const allowedOrigins=(process.env.CLIENT_URL||'').split(',').map(x=>x.trim()).filter(Boolean);
app.use(cors({origin:function(origin,callback){ if(!origin||!allowedOrigins.length||allowedOrigins.includes(origin)) return callback(null,true); callback(new Error('CORS origin not allowed')); }}));
app.use('/api/webhook',express.raw({type:'application/json'}));
app.use(express.json({limit:'10mb'}));
const storage=multer.diskStorage({
  destination:function(req,file,cb){ String(req.body.type||'product').toLowerCase()==='category'?cb(null,CATEGORY_UPLOAD_DIR):cb(null,PRODUCT_UPLOAD_DIR); },
  filename:function(req,file,cb){ const ext=path.extname(file.originalname).toLowerCase(); const safeExt=['.jpg','.jpeg','.png','.webp','.gif'].includes(ext)?ext:'.jpg'; const random=Math.random().toString(36).substring(2,10); cb(null,`${Date.now()}-${random}${safeExt}`); }
});
const upload=multer({storage,limits:{fileSize:12*1024*1024},fileFilter:function(req,file,cb){ const allowed=['image/jpeg','image/png','image/webp','image/gif']; if(!allowed.includes(file.mimetype)) return cb(new Error('Only JPG, PNG, WebP and GIF images are allowed')); cb(null,true); }});
function auth(role){ return function(req,res,next){ try { const header=String(req.headers.authorization||''); const token=header.startsWith('Bearer ')?header.substring(7):''; if(!token)return res.status(401).json({error:'Authentication required'}); const payload=jwt.verify(token,JWT_SECRET); if(role&&payload.role!==role)return res.status(403).json({error:'Forbidden'}); req.user=payload; next(); } catch(err){ return res.status(401).json({error:'Unauthorised'}); } }; }
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Turqs Maldives',time:new Date().toISOString()}));
app.post('/api/auth/login',(req,res)=>{ const email=String(req.body.email||'').toLowerCase().trim(); const password=String(req.body.password||''); const user=users.find(x=>x.email===email); if(!user||!bcrypt.compareSync(password,user.hash))return res.status(401).json({error:'Invalid email or password'}); const token=jwt.sign({id:user.id,role:user.role,email:user.email},JWT_SECRET,{expiresIn:'8h'}); res.json({token,user:{email:user.email,name:user.name,role:user.role}}); });
app.get('/api/categories',(req,res)=>res.json({categories:db.categories}));
app.get('/api/products',(req,res)=>res.json({products:db.products.filter(p=>p.active!==false)}));
app.get('/api/settings',(req,res)=>res.json({settings:db.settings}));
app.post('/api/admin/upload',auth('admin'),upload.array('images',6),(req,res)=>{ try { if(!req.files||!req.files.length)return res.status(400).json({error:'No image files received'}); const type=String(req.body.type||'product').toLowerCase(); const urls=req.files.map(file=>`/uploads/${type==='category'?'categories':'products'}/${file.filename}`); audit('Image uploaded',`${urls.length} ${type} image(s)`); res.json({ok:true,images:urls}); } catch(err){ console.error('Upload error:',err); res.status(500).json({error:'Image upload failed'}); } });
app.get('/api/admin/catalog',auth('admin'),(req,res)=>res.json({categories:db.categories,products:db.products,settings:db.settings,audit:db.audit}));
app.put('/api/admin/catalog',auth('admin'),(req,res)=>{ if(Array.isArray(req.body.categories))db.categories=req.body.categories; if(Array.isArray(req.body.products))db.products=req.body.products; if(req.body.settings&&typeof req.body.settings==='object')db.settings={...db.settings,...req.body.settings}; audit('Catalogue synchronised','Admin dashboard saved catalogue/settings'); res.json({ok:true,categories:db.categories,products:db.products,settings:db.settings}); });
app.post('/api/admin/categories',auth('admin'),(req,res)=>{ const id=String(req.body.id||'').trim(),name=String(req.body.name||'').trim(); if(!id||!name)return res.status(400).json({error:'id and name are required'}); if(db.categories.some(c=>c.id===id))return res.status(409).json({error:'Slug already exists'}); const category={id,name,desc:String(req.body.desc||''),img:String(req.body.img||'')}; db.categories.push(category); audit('Category created',name); res.status(201).json({category}); });
app.put('/api/admin/categories/:id',auth('admin'),(req,res)=>{ const index=db.categories.findIndex(c=>c.id===req.params.id); if(index<0)return res.status(404).json({error:'Category not found'}); const oldId=db.categories[index].id,newId=String(req.body.id||oldId).trim(); if(newId!==oldId&&db.categories.some(c=>c.id===newId))return res.status(409).json({error:'Slug already exists'}); if(newId!==oldId)db.products.forEach(p=>{if(p.category===oldId)p.category=newId;}); db.categories[index]={...db.categories[index],...req.body,id:newId}; audit('Category updated',db.categories[index].name); res.json({category:db.categories[index]}); });
app.delete('/api/admin/categories/:id',auth('admin'),(req,res)=>{ const id=req.params.id,affected=db.products.filter(p=>p.category===id),target=req.query.reassignTo; if(affected.length){ if(target==='__delete__')db.products=db.products.filter(p=>p.category!==id); else if(target)db.products.forEach(p=>{if(p.category===id)p.category=target;}); else return res.status(409).json({error:`${affected.length} product(s) still use this category`}); } db.categories=db.categories.filter(c=>c.id!==id); audit('Category deleted',id); res.json({ok:true,affected:affected.length}); });
function nextId(list){ return list.reduce((max,item)=>Math.max(max,Number(item.id)||0),0)+1; }
app.post('/api/admin/products',auth('admin'),(req,res)=>{ const b=req.body||{}; if(!b.name||!(Number(b.price)>0))return res.status(400).json({error:'name and a positive price are required'}); const sku=String(b.sku||'').trim().toUpperCase(); if(sku&&db.products.some(p=>String(p.sku||'').toUpperCase()===sku))return res.status(409).json({error:'SKU already exists'}); const product={...b,id:nextId(db.products),sku,price:Number(b.price),old:b.old===''||b.old===null||b.old===undefined?null:Number(b.old),stock:Math.max(0,parseInt(b.stock,10)||0),active:b.active!==false,images:Array.isArray(b.images)?b.images:[]}; db.products.push(product); audit('Product created',product.name); res.status(201).json({product}); });
app.put('/api/admin/products/:id',auth('admin'),(req,res)=>{ const index=db.products.findIndex(p=>Number(p.id)===Number(req.params.id)); if(index<0)return res.status(404).json({error:'Product not found'}); db.products[index]={...db.products[index],...req.body,id:db.products[index].id}; audit('Product updated',db.products[index].name); res.json({product:db.products[index]}); });
app.patch('/api/admin/products/:id/price',auth('admin'),(req,res)=>{ const product=db.products.find(p=>Number(p.id)===Number(req.params.id)); if(!product)return res.status(404).json({error:'Product not found'}); const price=Number(req.body.price); if(!(price>0))return res.status(400).json({error:'Price must be greater than 0'}); product.price=+price.toFixed(2); if(req.body.old!==undefined)product.old=req.body.old===null?null:Number(req.body.old); if(req.body.stock!==undefined)product.stock=Math.max(0,parseInt(req.body.stock,10)||0); audit('Product price/stock updated',product.name); res.json({product}); });
app.delete('/api/admin/products/:id',auth('admin'),(req,res)=>{ const old=db.products.find(p=>Number(p.id)===Number(req.params.id)); db.products=db.products.filter(p=>Number(p.id)!==Number(req.params.id)); audit('Product deleted',old?old.name:req.params.id); res.json({ok:true}); });
app.post('/api/admin/products/bulk-price',auth('admin'),(req,res)=>{ const {scope='all',op,value=0,rounding=''}=req.body||{}; let changed=0; db.products.forEach(product=>{ if(scope!=='all'&&product.category!==scope)return; let n=Number(product.price)||0; if(op==='inc_pct')n*=1+Number(value)/100; if(op==='dec_pct'||op==='sale')n*=1-Number(value)/100; if(op==='inc_amt')n+=Number(value); if(op==='dec_amt')n-=Number(value); if(op==='set')n=Number(value); if(op==='clear'&&product.old)n=product.old; if(n<=0)return; if(rounding==='int')n=Math.round(n); if(rounding==='99')n=Math.floor(n)+.99; if(rounding==='10')n=Math.round(n/10)*10; if(op==='sale'){product.old=product.old||product.price;product.tag=product.tag||'Sale';} if(op==='clear'){product.old=null;if(product.tag==='Sale')product.tag=null;} if(+n.toFixed(2)!==+Number(product.price).toFixed(2)){product.price=+n.toFixed(2);changed++;} }); audit('Bulk repricing',`${changed} product(s) changed`); res.json({changed}); });
app.put('/api/admin/settings',auth('admin'),(req,res)=>{ db.settings={...db.settings,...req.body}; audit('Settings updated',JSON.stringify(req.body)); res.json({settings:db.settings}); });
app.get('/api/admin/orders',auth('admin'),(req,res)=>res.json({orders:db.orders}));
app.post('/api/checkout/session',async(req,res)=>{ try { const {items=[],delivery={}}=req.body; if(!Array.isArray(items)||!items.length)return res.status(400).json({error:'Cart is empty'}); const line_items=items.map(item=>{ const product=db.products.find(p=>Number(p.id)===Number(item.id)||p.sku===item.sku); if(!product)throw new Error('Unknown product '+(item.sku||item.id)); return {price_data:{currency:'usd',unit_amount:Math.round(Number(product.price)*100),product_data:{name:product.name,metadata:{sku:product.sku||''}}},quantity:Math.max(1,parseInt(item.qty,10)||1)}; }); const clientUrl=process.env.CLIENT_URL||'https://www.turqsmaldives.com'; const session=await stripe.checkout.sessions.create({mode:'payment',customer_email:delivery.email,line_items,success_url:`${clientUrl}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${clientUrl}/checkout.html`}); res.json({id:session.id,url:session.url}); } catch(err){ console.error('Stripe error:',err); res.status(500).json({error:err.message}); } });
app.post('/api/webhook',(req,res)=>{ let event=req.body; try { if(process.env.STRIPE_WEBHOOK_SECRET)event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET); } catch(err){return res.status(400).send(`Webhook error: ${err.message}`);} if(event.type==='checkout.session.completed')console.log('Payment confirmed:',event.data.object.id); res.json({received:true}); });
app.use('/uploads',express.static(UPLOAD_DIR));
app.use(express.static(ROOT,{index:'index.html',extensions:['html']}));
app.get('*',(req,res)=>{ if(req.path.startsWith('/api/'))return res.status(404).json({error:'API route not found'}); res.sendFile(path.join(ROOT,'index.html')); });
app.use((err,req,res,next)=>{ console.error('Server error:',err); if(err instanceof multer.MulterError)return res.status(400).json({error:err.message}); res.status(500).json({error:err.message||'Internal server error'}); });
const PORT=Number(process.env.PORT)||4000;
app.listen(PORT,'0.0.0.0',()=>console.log(`Turqs Maldives running on port ${PORT}`));
