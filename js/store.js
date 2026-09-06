/* ============================================================
   js/store.js — catalogue persistence + admin CRUD layer
   ------------------------------------------------------------
   Seeds itself from data.js the first time it runs, then keeps
   the live catalogue in localStorage. Every storefront page and
   the admin dashboard read the SAME source, so an admin edit is
   visible on the shop immediately after a refresh.

   Exposes the globals the rest of the app already uses:
        CATEGORIES   PRODUCTS
   ============================================================ */
const Store = {
  KEY_P:'turqs_products_v1',
  KEY_C:'turqs_categories_v1',
  KEY_LOG:'turqs_audit_v1',
  KEY_SETTINGS:'turqs_settings_v1',

  /* ---------- low level ---------- */
  _read(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return JSON.parse(JSON.stringify(fallback));
      const val = JSON.parse(raw);
      return Array.isArray(val) ? val : JSON.parse(JSON.stringify(fallback));
    }catch(e){ return JSON.parse(JSON.stringify(fallback)); }
  },
  _write(key, val){ localStorage.setItem(key, JSON.stringify(val)); },

  /* ---------- read ---------- */
  categories(){ return Store._read(Store.KEY_C, DEFAULT_CATEGORIES); },
  products(){
    return Store._read(Store.KEY_P, DEFAULT_PRODUCTS).map(p => ({
      ...p,
      price: Number(p.price) || 0,
      old:   p.old === null || p.old === '' || p.old === undefined ? null : Number(p.old),
      stock: Number(p.stock) || 0,
      active: p.active !== false,
      images: (p.images && p.images.length) ? p.images : ['https://placehold.co/800x800/0c2836/2dd4bf?text=Turqs']
    }));
  },
  saveProducts(list){ Store._write(Store.KEY_P, list); Store.sync(); },
  saveCategories(list){ Store._write(Store.KEY_C, list); Store.sync(); },

  /* ---------- store settings (tax %, FX rate, shipping) ---------- */
  settings(){
    const saved = Store._readObj(Store.KEY_SETTINGS, {});
    return {
      taxRate: saved.taxRate !== undefined ? Number(saved.taxRate) : STORE.taxRate,
      fxRate: saved.fxRate !== undefined ? Number(saved.fxRate) : STORE.fxRate,
      shippingFlat: saved.shippingFlat !== undefined ? Number(saved.shippingFlat) : STORE.shippingFlat,
      freeShippingOver: saved.freeShippingOver !== undefined ? Number(saved.freeShippingOver) : STORE.freeShippingOver
    };
  },
  saveSettings(patch){
    const current = Store._readObj(Store.KEY_SETTINGS, {});
    const next = { ...current, ...patch };
    localStorage.setItem(Store.KEY_SETTINGS, JSON.stringify(next));
    Store.applySettings();
    Store.log('Settings updated', Object.entries(patch).map(([k,v])=>`${k}: ${v}`).join(', '));
  },
  /* mutate the live STORE object so every script (cart, checkout, admin) sees the new values */
  applySettings(){
    const s = Store.settings();
    STORE.taxRate = s.taxRate;
    STORE.fxRate = s.fxRate;
    STORE.shippingFlat = s.shippingFlat;
    STORE.freeShippingOver = s.freeShippingOver;
  },
  _readObj(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return JSON.parse(JSON.stringify(fallback));
      const val = JSON.parse(raw);
      return (val && typeof val === 'object' && !Array.isArray(val)) ? val : JSON.parse(JSON.stringify(fallback));
    }catch(e){ return JSON.parse(JSON.stringify(fallback)); }
  },

  /* refresh the globals other scripts read */
  sync(){ CATEGORIES = Store.categories(); PRODUCTS = Store.products(); Store.applySettings(); },

  /* ---------- helpers ---------- */
  slug(s){ return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); },
  nextId(list){ return list.reduce((m,x)=>Math.max(m, Number(x.id)||0), 0) + 1; },
  nextSku(categoryId){
    const code = String(categoryId).slice(0,2).toUpperCase();
    const n = Store.products().filter(p=>p.category===categoryId).length + 1;
    return `AR-${code}-${String(n).padStart(3,'0')}`;
  },
  money(n){ return STORE.currency + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); },

  /* ---------- PRODUCT crud ---------- */
  validateProduct(p, id){
    const errs = {};
    if(!p.name || p.name.trim().length < 2)        errs.name = 'Product name is required';
    if(!p.category)                                 errs.category = 'Choose a category';
    else if(!Store.categories().some(c=>c.id===p.category)) errs.category = 'That category no longer exists';
    if(!(Number(p.price) > 0))                      errs.price = 'Price must be greater than 0';
    if(p.old !== null && p.old !== '' && Number(p.old) <= Number(p.price))
                                                    errs.old = 'Compare-at price must exceed the selling price';
    if(Number(p.stock) < 0 || isNaN(Number(p.stock))) errs.stock = 'Stock cannot be negative';
    if(!p.sku || p.sku.trim().length < 3)           errs.sku = 'SKU is required';
    else if(Store.products().some(x => x.sku.toLowerCase() === p.sku.toLowerCase().trim() && x.id !== id))
                                                    errs.sku = 'That SKU already exists';
    return errs;
  },
  saveProduct(data, id){
    const list = Store.products();
    const clean = {
      name:String(data.name).trim(), category:data.category, sku:String(data.sku).trim().toUpperCase(),
      price:+Number(data.price).toFixed(2),
      old: (data.old === '' || data.old === null || data.old === undefined) ? null : +Number(data.old).toFixed(2),
      stock:Math.max(0, parseInt(data.stock,10) || 0),
      tag: data.tag || null,
      metal:(data.metal||'-').trim(), stone:(data.stone||'-').trim(), weight:(data.weight||'-').trim(),
      desc:(data.desc||'').trim(),
      active: data.active !== false,
      images:(data.images||[]).filter(Boolean)
    };
    if(!clean.images.length) clean.images = ['https://placehold.co/800x800/0c2836/2dd4bf?text=Turqs'];

    if(id){
      const i = list.findIndex(p=>p.id===id);
      if(i < 0) return null;
      list[i] = { ...list[i], ...clean };
      Store.log('Product updated', `${clean.name} (${clean.sku})`);
    }else{
      clean.id = Store.nextId(list);
      list.push(clean);
      Store.log('Product created', `${clean.name} (${clean.sku})`);
    }
    Store.saveProducts(list);
    return clean;
  },
  deleteProduct(id){
    const list = Store.products();
    const p = list.find(x=>x.id===id);
    Store.saveProducts(list.filter(x=>x.id!==id));
    if(p) Store.log('Product deleted', `${p.name} (${p.sku})`);
  },
  toggleProduct(id){
    const list = Store.products();
    const p = list.find(x=>x.id===id); if(!p) return;
    p.active = !p.active;
    Store.saveProducts(list);
    Store.log(p.active ? 'Product published' : 'Product hidden', p.name);
  },

  /* ---------- quick field updates (inline table editing) ---------- */
  setField(id, field, value){
    const list = Store.products();
    const p = list.find(x=>x.id===id); if(!p) return null;
    if(field === 'price'){
      const v = Number(value);
      if(!(v > 0)) return { error:'Price must be greater than 0' };
      if(p.old !== null && v >= p.old) p.old = null;   // discount no longer valid
      Store.log('Price changed', `${p.name}: ${Store.money(p.price)} -> ${Store.money(v)}`);
      p.price = +v.toFixed(2);
    }
    if(field === 'old'){
      const v = (value === '' || value === null) ? null : Number(value);
      if(v !== null && v <= p.price) return { error:'Compare-at price must exceed the price' };
      p.old = v === null ? null : +v.toFixed(2);
      Store.log('Compare-at price changed', `${p.name}: ${p.old ? Store.money(p.old) : 'cleared'}`);
    }
    if(field === 'stock'){
      const v = parseInt(value,10);
      if(isNaN(v) || v < 0) return { error:'Stock cannot be negative' };
      Store.log('Stock changed', `${p.name}: ${p.stock} -> ${v}`);
      p.stock = v;
    }
    Store.saveProducts(list);
    return { ok:true, product:p };
  },

  /* ---------- bulk pricing ---------- */
  /* opts = { scope:'all'|categoryId, target:'price'|'stock', op, value, rounding } */
  previewBulk(opts){
    return Store.products()
      .filter(p => opts.scope === 'all' || p.category === opts.scope)
      .map(p => ({ ...p, newPrice: Store._applyOp(p, opts) }))
      .filter(r => r.newPrice !== null && +r.newPrice.toFixed(2) !== +r.price.toFixed(2));
  },
  _applyOp(p, o){
    const v = Number(o.value) || 0;
    let n = p.price;
    switch(o.op){
      case 'inc_pct':  n = p.price * (1 + v/100); break;
      case 'dec_pct':  n = p.price * (1 - v/100); break;
      case 'inc_amt':  n = p.price + v;           break;
      case 'dec_amt':  n = p.price - v;           break;
      case 'set':      n = v;                     break;
      case 'sale':     n = p.price * (1 - v/100); break;   // also writes compare-at
      case 'clear':    n = p.old ? p.old : p.price; break;  // restore original price
      default: return null;
    }
    if(n <= 0) return null;
    if(o.rounding === '99')  n = Math.floor(n) + 0.99;
    if(o.rounding === 'int') n = Math.round(n);
    if(o.rounding === '10')  n = Math.round(n/10)*10;
    return +n.toFixed(2);
  },
  applyBulk(opts){
    const list = Store.products();
    let changed = 0;
    list.forEach(p => {
      if(opts.scope !== 'all' && p.category !== opts.scope) return;
      const n = Store._applyOp(p, opts);
      if(n === null || +n.toFixed(2) === +p.price.toFixed(2)) return;
      if(opts.op === 'sale'){ p.old = p.old || p.price; p.tag = p.tag || 'Sale'; }
      if(opts.op === 'clear'){ p.old = null; if(p.tag === 'Sale') p.tag = null; }
      p.price = n;
      changed++;
    });
    Store.saveProducts(list);
    Store.log('Bulk price update',
      `${changed} product(s) · scope: ${opts.scope} · ${opts.op} ${opts.value || ''}`);
    return changed;
  },
  restock(qty, onlyLow){
    const list = Store.products();
    let n = 0;
    list.forEach(p => {
      if(onlyLow && p.stock > STORE.lowStockAt) return;
      p.stock += qty; n++;
    });
    Store.saveProducts(list);
    Store.log('Stock replenished', `${n} product(s) +${qty} units`);
    return n;
  },

  /* ---------- CATEGORY crud ---------- */
  validateCategory(c, id){
    const errs = {};
    const list = Store.categories();
    if(!c.name || c.name.trim().length < 2) errs.name = 'Category name is required';
    if(!c.id) errs.id = 'Slug is required';
    else if(!/^[a-z0-9-]+$/.test(c.id)) errs.id = 'Use lowercase letters, numbers and hyphens only';
    else if(list.some(x => x.id === c.id && x.id !== id)) errs.id = 'That slug is already in use';
    return errs;
  },
  saveCategory(data, id){
    const list = Store.categories();
    const clean = {
      id: data.id, name:String(data.name).trim(), desc:(data.desc||'').trim(),
      img: data.img || 'https://placehold.co/800x600/0c2836/2dd4bf?text=Category'
    };
    if(id){
      const i = list.findIndex(c=>c.id===id);
      if(i < 0) return;
      list[i] = clean;
      if(id !== clean.id){                       // slug changed -> re-point products
        const ps = Store.products();
        ps.forEach(p => { if(p.category === id) p.category = clean.id; });
        Store._write(Store.KEY_P, ps);
      }
      Store.log('Category updated', clean.name);
    }else{
      list.push(clean);
      Store.log('Category created', clean.name);
    }
    Store.saveCategories(list);
  },
  countProducts(catId){ return Store.products().filter(p=>p.category===catId).length; },
  deleteCategory(id, reassignTo){
    const products = Store.products();
    const affected = products.filter(p=>p.category===id);
    if(affected.length){
      if(reassignTo === '__delete__'){
        Store._write(Store.KEY_P, products.filter(p=>p.category!==id));
      }else{
        products.forEach(p => { if(p.category===id) p.category = reassignTo; });
        Store._write(Store.KEY_P, products);
      }
    }
    const cats = Store.categories().filter(c=>c.id!==id);
    Store.saveCategories(cats);
    Store.log('Category deleted', `${id} · ${affected.length} product(s) ${reassignTo === '__delete__' ? 'removed' : 'reassigned'}`);
  },

  /* ---------- audit log ---------- */
  log(action, detail){
    const who = (typeof Auth !== 'undefined' && Auth.session()) ? Auth.session().email : 'system';
    const rows = JSON.parse(localStorage.getItem(Store.KEY_LOG) || '[]');
    rows.unshift({ at:new Date().toISOString(), who, action, detail });
    localStorage.setItem(Store.KEY_LOG, JSON.stringify(rows.slice(0,40)));
  },
  audit(){ try{ return JSON.parse(localStorage.getItem(Store.KEY_LOG) || '[]'); }catch(e){ return []; } },

  /* ---------- import / export / reset ---------- */
  exportJSON(){
    return JSON.stringify({
      exportedAt:new Date().toISOString(),
      categories:Store.categories(),
      products:Store.products()
    }, null, 2);
  },
  importJSON(text){
    const data = JSON.parse(text);
    if(!Array.isArray(data.products) || !Array.isArray(data.categories))
      throw new Error('File must contain "products" and "categories" arrays');
    Store._write(Store.KEY_C, data.categories);
    Store._write(Store.KEY_P, data.products);
    Store.sync();
    Store.log('Catalogue imported', `${data.products.length} products · ${data.categories.length} categories`);
  },
  reset(){
    localStorage.removeItem(Store.KEY_P);
    localStorage.removeItem(Store.KEY_C);
    Store.sync();
    Store.log('Catalogue reset', 'restored to factory defaults');
  }
};

/* Globals consumed by app.js / admin.js */
let CATEGORIES = Store.categories();
let PRODUCTS   = Store.products();
Store.applySettings();   // pick up any saved tax %, FX rate, shipping on first load
