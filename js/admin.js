/* ============================================================
   js/admin.js — dashboard with full catalogue management
   Panels: Overview · Orders · Products · Categories · Pricing · Data
   ============================================================ */

   /* ============================================================
   IMAGE UPLOAD FROM DEVICE — drag & drop, browse, paste, URL
   ============================================================ */
const IMG = {
  MAX_FILES: 6,            // images per product
  MAX_SOURCE_MB: 12,       // reject huge originals before reading them
  MAX_EDGE: 900,           // longest side after resize, in pixels
  QUALITY: 0.82,           // JPEG quality after resize
  TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  PLACEHOLDER: 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
    '<rect width="600" height="600" fill="#103548"/>' +
    '<text x="300" y="308" fill="#7fa3ae" font-family="sans-serif" font-size="30" ' +
    'text-anchor="middle">No image</text></svg>')
};

const kb = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB'
                            : Math.max(1, Math.round(b / 1024)) + ' KB';

/* Read the file, resize it on a canvas, return a compressed data URL.
   Resizing matters: a 4 MB phone photo becomes roughly 120 KB, which is the
   difference between fitting ~3 products and ~40 products in localStorage. */
function compressImage(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('could not be read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('is not a readable image'));
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, IMG.MAX_EDGE / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0c2836';          // flatten PNG transparency onto the card colour
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', IMG.QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const Uploader = {
  items: [],
  el: null,
  _paste: null,

  mount(){
    if(this.el) return this.el;
    Uploader.injectStyles();
    const holder = document.createElement('div');
    holder.className = 'up';
    holder.innerHTML = `
      <label class="up-label">Product images</label>
      <div class="up-drop" id="upDrop" tabindex="0" role="button"
           aria-label="Upload product images from your device">
        <strong>Drag photos here</strong>
        <span>or <u>browse your device</u> &middot; paste with Ctrl+V</span>
        <small>JPG, PNG, WebP, GIF &middot; up to ${IMG.MAX_FILES} images
               &middot; resized to ${IMG.MAX_EDGE}px</small>
        <input type="file" id="upInput" accept="image/*" multiple hidden>
      </div>
      <div class="up-url">
        <input type="url" id="upUrl" placeholder="...or paste an image URL">
        <button type="button" class="btn neutral sm" id="upUrlBtn">Add URL</button>
      </div>
      <div class="up-grid" id="upGrid"></div>
      <p class="hint" id="upHint"></p>`;

    const anchor = qs('#fImages') ? qs('#fImages').closest('.field') : null;
    if(anchor){
      anchor.style.display = 'none';                    // keep the old textarea as a fallback
      anchor.parentNode.insertBefore(holder, anchor);
    }else{
      qs('#productForm').appendChild(holder);
    }
    this.el = holder;
    this.bind();
    return holder;
  },

  bind(){
    const drop = qs('#upDrop'), input = qs('#upInput');

    input.addEventListener('click', e => e.stopPropagation());   // prevents a click loop
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', e => {
      this.accept(e.target.files);
      input.value = '';                                          // allow re-picking the same file
    });

    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.remove('over');
    }));
    drop.addEventListener('drop', e => this.accept(e.dataTransfer.files));

    qs('#upUrlBtn').addEventListener('click', () => {
      const v = qs('#upUrl').value.trim();
      if(!v) return;
      if(!/^https?:\/\//i.test(v)) return toast('Image URL must start with http', true);
      this.push({ src: v, name: v.split('/').pop().split('?')[0].slice(0, 26) || 'link',
                  bytes: 0, kind: 'url' });
      qs('#upUrl').value = '';
      this.render();
    });

    this._paste = e => {
      if(!document.querySelector('.modal.open')) return;
      const files = [...(e.clipboardData && e.clipboardData.items || [])]
        .filter(i => i.type.indexOf('image/') === 0)
        .map(i => i.getAsFile())
        .filter(Boolean);
      if(files.length){
        e.preventDefault();
        this.accept(files);
      }
    };
    document.addEventListener('paste', this._paste);

    qs('#upGrid').addEventListener('click', e => {
      const b = e.target.closest('button');
      if(!b) return;
      const i = +b.dataset.i;
      if(b.dataset.act === 'del')  this.items.splice(i, 1);
      if(b.dataset.act === 'main') this.items.unshift(this.items.splice(i, 1)[0]);
      this.render();
    });
  },

  async accept(fileList){
    const files = [...fileList];
    if(!files.length) return;
    const hint = qs('#upHint');
    const skipped = [];
    let added = 0;

    for(const f of files){
      if(this.items.length >= IMG.MAX_FILES){
        skipped.push(`${f.name} (limit is ${IMG.MAX_FILES})`);
        continue;
      }
      if(IMG.TYPES.indexOf(f.type) === -1){
        skipped.push(`${f.name} (unsupported format)`);
        continue;
      }
      if(f.size > IMG.MAX_SOURCE_MB * 1024 * 1024){
        skipped.push(`${f.name} (over ${IMG.MAX_SOURCE_MB} MB)`);
        continue;
      }
      hint.textContent = `Processing ${f.name}...`;
      try{
        const src = await compressImage(f);
        this.push({ src, name: f.name.slice(0, 26),
                    bytes: Math.round(src.length * 0.75), kind: 'file' });
        added++;
      }catch(err){
        skipped.push(`${f.name} ${err.message}`);
      }
    }
    this.render();
    if(skipped.length) toast('Skipped: ' + skipped.join(', '), true);
    else if(added)     toast(added + ' image' + (added > 1 ? 's' : '') + ' added');
  },

  push(item){
    if(this.items.some(x => x.src === item.src)) return;          // silent de-duplication
    this.items.push(item);
  },

  render(){
    const grid = qs('#upGrid');
    grid.innerHTML = this.items.length
      ? this.items.map((it, i) => `
        <figure class="up-card">
          <img src="${it.src}" alt="${it.name}">
          ${i === 0 ? '<span class="up-main">Main</span>' : ''}
          <figcaption>${it.name}${it.bytes ? ' &middot; ' + kb(it.bytes) : ' &middot; link'}</figcaption>
          <div class="up-acts">
            ${i === 0 ? '' : `<button type="button" class="btn neutral sm"
                                data-act="main" data-i="${i}">Make main</button>`}
            <button type="button" class="btn danger sm" data-act="del" data-i="${i}">Remove</button>
          </div>
        </figure>`).join('')
      : '<p class="hint">No image yet — the first image becomes the card thumbnail.</p>';

    const total = this.items.reduce((s, i) => s + i.bytes, 0);
    qs('#upHint').textContent = this.items.length
      ? `${this.items.length} of ${IMG.MAX_FILES} images · about ${kb(total)} stored in this browser`
      : '';
  },

  set(images){
    this.items = (images || []).filter(Boolean).map(src => ({
      src,
      name:  src.indexOf('data:') === 0 ? 'uploaded image'
                                        : src.split('/').pop().split('?')[0].slice(0, 26),
      bytes: src.indexOf('data:') === 0 ? Math.round(src.length * 0.75) : 0,
      kind:  src.indexOf('data:') === 0 ? 'file' : 'url'
    }));
    this.render();
  },

  values(){ return this.items.map(i => i.src); },

  injectStyles(){
    if(qs('#upStyles')) return;
    const s = document.createElement('style');
    s.id = 'upStyles';
    s.textContent = `
      .up{margin-bottom:16px}
      .up-label{display:block;font-size:.78rem;color:var(--muted);margin-bottom:6px;letter-spacing:.6px}
      .up-drop{border:1px dashed var(--border);border-radius:var(--radius);padding:22px 16px;
        text-align:center;cursor:pointer;transition:.2s;background:var(--surface-2)}
      .up-drop:hover,.up-drop:focus,.up-drop.over{border-color:var(--gold);
        background:rgba(45,212,191,.08);outline:none}
      .up-drop strong{display:block;font-size:.95rem;margin-bottom:4px}
      .up-drop span{display:block;font-size:.82rem;color:var(--muted)}
      .up-drop small{display:block;font-size:.72rem;color:var(--muted);margin-top:6px}
      .up-url{display:flex;gap:8px;margin-top:10px}
      .up-url input{flex:1}
      .up-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));
        gap:10px;margin-top:12px}
      .up-card{position:relative;border:1px solid var(--border);border-radius:var(--radius);
        overflow:hidden;background:var(--surface-2)}
      .up-card img{aspect-ratio:1/1;object-fit:cover;width:100%}
      .up-card figcaption{font-size:.68rem;color:var(--muted);padding:6px 8px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .up-main{position:absolute;top:6px;left:6px;background:var(--gold);color:#111;
        font-size:.62rem;padding:2px 7px;border-radius:4px;letter-spacing:.8px;text-transform:uppercase}
      .up-acts{display:flex;gap:5px;padding:0 6px 8px}
      .up-acts .btn{flex:1;padding:5px 6px;font-size:.65rem}`;
    document.head.appendChild(s);
  }
};
document.addEventListener('DOMContentLoaded', () => {
  if(!document.querySelector('.admin-layout')) return;

  const user = Auth.guard('admin');
  if(!user) return;
  qs('#adminName').textContent = user.name;
  qs('#logoutBtn').onclick = e => { e.preventDefault(); Auth.logout(); };

  /* ---------- panel navigation ---------- */
  const showPanel = name => {
    qsa('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
    qsa('[data-panel]').forEach(s => s.classList.toggle('hidden', s.dataset.panel !== name));
    if(name === 'overview')   renderOverview();
    if(name === 'orders')     renderOrders();
    if(name === 'products')   renderProducts();
    if(name === 'categories') renderCategories();
    if(name === 'pricing')    renderPricing();
    if(name === 'settings')   renderSettings();
  };
  qsa('[data-tab]').forEach(a => a.onclick = e => { e.preventDefault(); showPanel(a.dataset.tab); });

  /* ---------- shared refresh ---------- */
  function refreshAll(){
    Store.sync();
    renderOverview(); renderProducts(); renderCategories(); renderPricing(); fillCategorySelects();
  }
  const orders = () => JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');

  /* =========================================================
     OVERVIEW
     ========================================================= */
  function renderOverview(){
    const os_ = orders();
    const revenue = os_.filter(o=>o.payment.status==='paid').reduce((s,o)=>s+o.amounts.total,0);
    const stockValue = PRODUCTS.reduce((s,p)=>s+p.price*p.stock,0);
    const low = PRODUCTS.filter(p=>p.stock<=STORE.lowStockAt).length;

    qs('#statOrders').textContent   = os_.length;
    qs('#statRevenue').textContent  = money(revenue);
    qs('#statProducts').textContent = PRODUCTS.length;
    qs('#statCats').textContent     = CATEGORIES.length;
    qs('#statStockVal').textContent = money(stockValue);
    qs('#statLow').textContent      = low;
    qs('#statLow').className        = 'value' + (low ? '' : ' plain');

    qs('#auditList').innerHTML = Store.audit().length
      ? Store.audit().slice(0,12).map(a=>`<li>
          <span><strong>${esc(a.action)}</strong> — ${esc(a.detail)}</span>
          <span>${new Date(a.at).toLocaleString()}</span></li>`).join('')
      : `<li><span>No catalogue changes recorded yet.</span><span></span></li>`;

    qs('#lowStockBody').innerHTML = PRODUCTS.filter(p=>p.stock<=STORE.lowStockAt)
      .sort((a,b)=>a.stock-b.stock)
      .map(p=>`<tr>
        <td>${esc(p.name)}<br><small class="hint">${esc(p.sku)}</small></td>
        <td>${esc(catName(p.category))}</td>
        <td class="num">${money(p.price)}</td>
        <td class="num"><span class="tag ${p.stock===0?'bad':'warn'}">${p.stock} left</span></td>
        <td class="num"><button class="btn ghost sm" data-edit="${p.id}">Edit</button></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">All products are well stocked.</td></tr>`;
  }

  /* =========================================================
     ORDERS
     ========================================================= */
  function renderOrders(){
    const os_ = orders();
    qs('#ordersBody').innerHTML = os_.length ? os_.map(o=>`
      <tr>
        <td>${esc(o.id)}</td>
        <td>${esc(o.delivery.fullName)}<br><small class="hint">${esc(o.delivery.city)}, ${esc(o.delivery.country)}</small></td>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td class="num">${o.items.reduce((s,i)=>s+i.qty,0)}</td>
        <td><span class="tag ${o.payment.status}">${esc(o.payment.status)}</span> ${esc(o.payment.method.toUpperCase())}</td>
        <td class="num">${money(o.amounts.total)}</td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">No orders yet.</td></tr>`;
  }

  /* =========================================================
     PRODUCTS  (list + inline price/stock editing + CRUD)
     ========================================================= */
  const pState = { q:'', cat:'all', sort:'name' };

  function fillCategorySelects(){
    const opts = CATEGORIES.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    qs('#pFilterCat').innerHTML  = `<option value="all">All categories</option>${opts}`;
    qs('#bulkScope').innerHTML   = `<option value="all">Entire catalogue</option>${opts}`;
    qs('#pFilterCat').value = pState.cat;
  }

  function productRows(){
    let list = PRODUCTS.filter(p =>
      (pState.cat==='all' || p.category===pState.cat) &&
      (!pState.q || (p.name+p.sku+p.metal+p.stone).toLowerCase().includes(pState.q.toLowerCase())));
    if(pState.sort==='name')  list.sort((a,b)=>a.name.localeCompare(b.name));
    if(pState.sort==='low')   list.sort((a,b)=>a.price-b.price);
    if(pState.sort==='high')  list.sort((a,b)=>b.price-a.price);
    if(pState.sort==='stock') list.sort((a,b)=>a.stock-b.stock);
    return list;
  }

  function renderProducts(){
    const list = productRows();
    qs('#pCount').textContent = `${list.length} of ${PRODUCTS.length} products`;
    qs('#productsBody').innerHTML = list.length ? list.map(p=>{
      const off = p.old ? Math.round((1 - p.price/p.old)*100) : 0;
      return `<tr data-row="${p.id}">
        <td><div class="cart-item">
          <img class="thumb-sm" src="${esc(p.images[0])}" alt="">
          <div>${esc(p.name)}<br><small class="hint">${esc(p.sku)}${p.tag?' · '+esc(p.tag):''}</small></div>
        </div></td>
        <td>${esc(catName(p.category))}</td>
        <td class="num"><input class="cell-input" type="number" step="0.01" min="0.01"
             value="${p.price.toFixed(2)}" data-field="price" data-id="${p.id}" aria-label="Price"></td>
        <td class="num"><input class="cell-input" type="number" step="0.01" min="0"
             value="${p.old ?? ''}" placeholder="none" data-field="old" data-id="${p.id}" aria-label="Compare-at price">
             ${off?`<div class="hint neg">-${off}%</div>`:''}</td>
        <td class="num"><input class="cell-input" type="number" step="1" min="0" style="width:78px"
             value="${p.stock}" data-field="stock" data-id="${p.id}" aria-label="Stock"></td>
        <td><span class="tag ${p.active===false?'muted':(p.stock===0?'bad':(p.stock<=STORE.lowStockAt?'warn':'ok'))}">
             ${p.active===false?'Hidden':(p.stock===0?'Sold out':(p.stock<=STORE.lowStockAt?'Low':'Live'))}</span></td>
        <td><div class="row-actions">
          <button class="btn ghost sm" data-edit="${p.id}">Edit</button>
          <button class="btn neutral sm" data-toggle="${p.id}">${p.active===false?'Publish':'Hide'}</button>
          <button class="btn danger sm" data-del="${p.id}">Delete</button>
        </div></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7" class="empty">No products match this filter.</td></tr>`;
  }

  /* inline edit: commit on change / blur */
  qs('#productsBody').addEventListener('change', e => {
    const el = e.target.closest('.cell-input'); if(!el) return;
    const res = Store.setField(+el.dataset.id, el.dataset.field, el.value);
    if(res && res.error){ el.classList.add('dirty'); toast(res.error, true); return; }
    el.classList.remove('dirty'); el.classList.add('saved');
    toast('Saved');
    Store.sync(); renderProducts(); renderOverview(); renderPricing();
  });
  qs('#productsBody').addEventListener('input', e => {
    if(e.target.closest('.cell-input')) e.target.classList.add('dirty');
  });

  qs('#pSearch').oninput   = e => { pState.q = e.target.value; renderProducts(); };
  qs('#pFilterCat').onchange = e => { pState.cat = e.target.value; renderProducts(); };
  qs('#pSort').onchange    = e => { pState.sort = e.target.value; renderProducts(); };
  qs('#addProductBtn').onclick = () => openProductModal(null);

  /* row buttons (products panel + low-stock table) */
  document.addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    const dl = e.target.closest('[data-del]');
    const tg = e.target.closest('[data-toggle]');
    if(ed && ed.closest('.admin-main')){ openProductModal(+ed.dataset.edit); }
    if(tg){ Store.toggleProduct(+tg.dataset.toggle); refreshAll(); toast('Visibility updated'); }
    if(dl && dl.closest('.admin-main')){
      const p = findProduct(+dl.dataset.del); if(!p) return;
      confirmModal(`Delete "${p.name}"?`,
        'This removes the product from the store permanently.',
        () => { Store.deleteProduct(p.id); refreshAll(); toast('Product deleted'); });
    }
  });

  /* ---------- product modal ---------- */
  function openProductModal(id){
    const p = id ? findProduct(id) : null;
    const catOpts = CATEGORIES.map(c=>
      `<option value="${c.id}" ${p&&p.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
    const tagOpts = PRODUCT_TAGS.map(t=>
      `<option value="${t}" ${p&&(p.tag||'')===t?'selected':''}>${t||'No badge'}</option>`).join('');

    openModal(`
      <h3>${p ? 'Edit product' : 'New product'}</h3>
      <form id="productForm" novalidate>
        <div class="form-row">
          <div class="field"><label for="fName">Product name *</label>
            <input id="fName" value="${p?esc(p.name):''}"><span class="error"></span></div>
          <div class="field"><label for="fSku">SKU *</label>
            <input id="fSku" value="${p?esc(p.sku):''}" placeholder="AR-RG-004"><span class="error"></span></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="fCat">Category *</label>
            <select id="fCat">${catOpts}</select><span class="error"></span></div>
          <div class="field"><label for="fTag">Badge</label><select id="fTag">${tagOpts}</select></div>
        </div>
        <div class="form-row three">
          <div class="field"><label for="fPrice">Selling price *</label>
            <input id="fPrice" type="number" step="0.01" min="0.01" value="${p?p.price:''}"><span class="error"></span></div>
          <div class="field"><label for="fOld">Compare-at price</label>
            <input id="fOld" type="number" step="0.01" min="0" value="${p&&p.old?p.old:''}" placeholder="optional"><span class="error"></span></div>
          <div class="field"><label for="fStock">Stock units *</label>
            <input id="fStock" type="number" step="1" min="0" value="${p?p.stock:0}"><span class="error"></span></div>
        </div>
        <div class="form-row three">
          <div class="field"><label for="fMetal">Metal</label><input id="fMetal" value="${p?esc(p.metal):''}"></div>
          <div class="field"><label for="fStone">Stone</label><input id="fStone" value="${p?esc(p.stone):''}"></div>
          <div class="field"><label for="fWeight">Weight</label><input id="fWeight" value="${p?esc(p.weight):''}"></div>
        </div>
        <div class="field"><label for="fDesc">Description</label>
          <textarea id="fDesc" rows="3">${p?esc(p.desc):''}</textarea></div>
        <div class="field"><label for="fImages">Image URLs (one per line)</label>
          <textarea id="fImages" rows="3" placeholder="img/ring-1.jpg">${p?p.images.map(esc).join('\n'):''}</textarea>
          <span class="hint">First image is used as the thumbnail. Relative paths such as img/ring.jpg work too.</span></div>
        <label style="display:flex;gap:8px;align-items:center;font-size:.85rem;color:var(--muted)">
          <input type="checkbox" id="fActive" style="width:auto" ${!p||p.active!==false?'checked':''}> Visible on the storefront
        </label>
        <div class="modal-actions">
          <button type="button" class="btn neutral" data-close>Cancel</button>
          <button type="submit" class="btn">${p?'Save changes':'Create product'}</button>
        </div>
      </form>`);

    /* Wire the device-upload widget into the modal that already exists above.
       Uploader / IMG / compressImage are defined once at the top of this file. */
    Uploader.el = null;               // force a fresh mount into this modal's new DOM
    Uploader.mount();
    Uploader.set(p ? p.images : []);

    if(!p) qs('#fCat').onchange = () => { qs('#fSku').value = Store.nextSku(qs('#fCat').value); };
    if(!p) qs('#fSku').value = Store.nextSku(qs('#fCat').value);

    qs('#productForm').onsubmit = ev => {
      ev.preventDefault();
      const data = {
        name:qs('#fName').value, sku:qs('#fSku').value, category:qs('#fCat').value,
        price:qs('#fPrice').value, old:qs('#fOld').value, stock:qs('#fStock').value,
        tag:qs('#fTag').value || null, metal:qs('#fMetal').value, stone:qs('#fStone').value,
        weight:qs('#fWeight').value, desc:qs('#fDesc').value, active:qs('#fActive').checked,
        images: Uploader.values().length
          ? Uploader.values()
          : qs('#fImages').value.split('\n').map(s=>s.trim()).filter(Boolean)
      };
      const map = { name:'#fName', sku:'#fSku', category:'#fCat', price:'#fPrice', old:'#fOld', stock:'#fStock' };
      qsa('.field').forEach(f=>f.classList.remove('invalid'));
      const errs = Store.validateProduct(data, id);
      if(Object.keys(errs).length){
        for(const [k,msg] of Object.entries(errs)){
          const f = qs(map[k])?.closest('.field');
          if(f){ f.classList.add('invalid'); f.querySelector('.error').textContent = msg; }
        }
        return;
      }
      Store.saveProduct(data, id);
      closeModal(); refreshAll();
      toast(id ? 'Product updated' : 'Product created');
    };
  }

  /* =========================================================
     CATEGORIES
     ========================================================= */
  function renderCategories(){
    qs('#cCount').textContent = `${CATEGORIES.length} categories`;
    qs('#categoriesBody').innerHTML = CATEGORIES.length ? CATEGORIES.map(c=>{
      const items = PRODUCTS.filter(p=>p.category===c.id);
      const value = items.reduce((s,p)=>s+p.price*p.stock,0);
      const avg   = items.length ? items.reduce((s,p)=>s+p.price,0)/items.length : 0;
      return `<tr>
        <td><div class="cart-item"><img class="thumb-sm" src="${esc(c.img)}" alt="">
          <div>${esc(c.name)}<br><small class="hint">/${esc(c.id)}</small></div></div></td>
        <td>${esc(c.desc)}</td>
        <td class="num">${items.length}</td>
        <td class="num">${avg?money(avg):'-'}</td>
        <td class="num">${money(value)}</td>
        <td><div class="row-actions">
          <button class="btn ghost sm" data-cedit="${c.id}">Edit</button>
          <button class="btn danger sm" data-cdel="${c.id}">Delete</button>
        </div></td></tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">No categories yet.</td></tr>`;
  }

  qs('#addCategoryBtn').onclick = () => openCategoryModal(null);
  qs('#categoriesBody').addEventListener('click', e => {
    const ed = e.target.closest('[data-cedit]');
    const dl = e.target.closest('[data-cdel]');
    if(ed) openCategoryModal(ed.dataset.cedit);
    if(dl) openCategoryDelete(dl.dataset.cdel);
  });

  function openCategoryModal(id){
    const c = id ? CATEGORIES.find(x=>x.id===id) : null;
    openModal(`
      <h3>${c ? 'Edit category' : 'New category'}</h3>
      <form id="catForm" novalidate>
        <div class="form-row">
          <div class="field"><label for="cName">Category name *</label>
            <input id="cName" value="${c?esc(c.name):''}" placeholder="Anklets"><span class="error"></span></div>
          <div class="field"><label for="cId">URL slug *</label>
            <input id="cId" value="${c?esc(c.id):''}" placeholder="anklets"><span class="error"></span>
            <span class="hint">Used in products.html?cat=<em>slug</em></span></div>
        </div>
        <div class="field"><label for="cDesc">Short description</label>
          <input id="cDesc" value="${c?esc(c.desc):''}" placeholder="Delicate chains for the ankle"></div>
        <div class="field">
  <label for="cImg">Cover image</label>

  <div style="display:flex; gap:8px; align-items:center;">
    <input
      id="cImg"
      value="${c ? esc(c.img) : ''}"
      placeholder="img/anklets.jpg"
      style="flex:1;"
    >

    <label
      for="cImgFile"
      class="btn neutral"
      style="cursor:pointer; white-space:nowrap;"
    >
      Upload from device
    </label>

    <input
      type="file"
      id="cImgFile"
      accept="image/*"
      style="display:none;"
    >
  </div>

  <span class="hint">
    Enter an image URL or upload an image from your device.
  </span>

  <div id="cImgPreview" style="margin-top:10px;"></div>
</div>
        ${c ? `<p class="hint">Renaming the slug automatically re-points all
               ${Store.countProducts(c.id)} product(s) in this category.</p>` : ''}
        <div class="modal-actions">
          <button type="button" class="btn neutral" data-close>Cancel</button>
          <button type="submit" class="btn">${c?'Save changes':'Create category'}</button>
        </div>
      </form>`);

    if(!c) qs('#cName').oninput = () => { qs('#cId').value = Store.slug(qs('#cName').value); };

    qs('#catForm').onsubmit = ev => {
      ev.preventDefault();
      const data = { name:qs('#cName').value, id:Store.slug(qs('#cId').value),
                     desc:qs('#cDesc').value, img:qs('#cImg').value.trim() };
      qsa('.field').forEach(f=>f.classList.remove('invalid'));
      const errs = Store.validateCategory(data, id);
      if(Object.keys(errs).length){
        for(const [k,msg] of Object.entries(errs)){
          const f = qs(k==='name'?'#cName':'#cId').closest('.field');
          f.classList.add('invalid'); f.querySelector('.error').textContent = msg;
        }
        return;
      }
      Store.saveCategory(data, id);
      closeModal(); refreshAll();
      toast(id ? 'Category updated' : 'Category created');
    };
  }

  function openCategoryDelete(id){
    const c = CATEGORIES.find(x=>x.id===id);
    const n = Store.countProducts(id);
    const others = CATEGORIES.filter(x=>x.id!==id);
    openModal(`
      <h3>Delete "${esc(c.name)}"</h3>
      ${n ? `<p class="hint">${n} product(s) are in this category. Choose what happens to them.</p>
        <div class="field" style="margin-top:12px"><label for="reassign">Move products to</label>
          <select id="reassign">
            ${others.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}
            <option value="__delete__">Delete these ${n} product(s) as well</option>
          </select></div>`
        : `<p class="hint">This category is empty and can be removed safely.</p>`}
      <div class="modal-actions">
        <button type="button" class="btn neutral" data-close>Cancel</button>
        <button type="button" class="btn danger" id="confirmCatDel">Delete category</button>
      </div>`, true);

    qs('#confirmCatDel').onclick = () => {
      if(n && !others.length){ toast('Create another category first', true); return; }
      Store.deleteCategory(id, n ? qs('#reassign').value : null);
      closeModal(); refreshAll();
      toast('Category deleted');
    };
  }

  /* =========================================================
     PRICING  (bulk price + stock tools)
     ========================================================= */
  function bulkOpts(){
    return { scope:qs('#bulkScope').value, op:qs('#bulkOp').value,
             value:parseFloat(qs('#bulkValue').value) || 0, rounding:qs('#bulkRound').value };
  }
  function renderPricing(){
    const rows = Store.previewBulk(bulkOpts());
    qs('#previewCount').textContent = `${rows.length} product(s) affected`;
    qs('#applyBulkBtn').disabled = rows.length === 0;
    qs('#previewBody').innerHTML = rows.length ? rows.map(r=>{
      const diff = r.newPrice - r.price;
      const pct  = (diff / r.price * 100).toFixed(1);
      return `<tr>
        <td>${esc(r.name)}<br><small class="hint">${esc(catName(r.category))} · ${esc(r.sku)}</small></td>
        <td class="num">${money(r.price)}</td>
        <td class="num">${money(r.newPrice)}</td>
        <td class="num ${diff>0?'neg':'pos'}">${diff>0?'+':''}${money(diff)} (${diff>0?'+':''}${pct}%)</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" class="empty">Nothing changes with these settings.</td></tr>`;

    /* category price snapshot */
    qs('#catPriceBody').innerHTML = CATEGORIES.map(c=>{
      const items = PRODUCTS.filter(p=>p.category===c.id);
      if(!items.length) return `<tr><td>${esc(c.name)}</td><td class="num">0</td>
        <td class="num">-</td><td class="num">-</td><td class="num">-</td></tr>`;
      const prices = items.map(p=>p.price);
      const avg = prices.reduce((a,b)=>a+b,0)/prices.length;
      return `<tr><td>${esc(c.name)}</td><td class="num">${items.length}</td>
        <td class="num">${money(Math.min(...prices))}</td>
        <td class="num">${money(avg)}</td>
        <td class="num">${money(Math.max(...prices))}</td></tr>`;
    }).join('');
  }
  ['#bulkScope','#bulkOp','#bulkValue','#bulkRound'].forEach(sel=>{
    qs(sel).addEventListener('input', renderPricing);
    qs(sel).addEventListener('change', renderPricing);
  });
  qs('#applyBulkBtn').onclick = () => {
    const o = bulkOpts();
    const n = Store.previewBulk(o).length;
    confirmModal(`Apply price change to ${n} product(s)?`,
      'Prices update instantly on the storefront. Export a backup first if you are unsure.',
      () => { const c = Store.applyBulk(o); refreshAll(); toast(`${c} price(s) updated`); });
  };
  qs('#restockBtn').onclick = () => {
    const qty = parseInt(qs('#restockQty').value,10) || 0;
    if(qty <= 0){ toast('Enter a quantity above 0', true); return; }
    const n = Store.restock(qty, qs('#restockLow').checked);
    refreshAll(); toast(`${n} product(s) restocked`);
  };

  /* =========================================================
     SETTINGS  (tax % + MVR/USD conversion, manually managed)
     ========================================================= */
  function renderSettings(){
    const s = Store.settings();
    qs('#taxRateInput').value = +(s.taxRate * 100).toFixed(2);
    qs('#fxRateInput').value  = s.fxRate;
    qs('#fxUsdInput').value   = qs('#fxUsdInput').value || 100;
    updateConverter();
  }
  function updateConverter(){
    const rate = Number(qs('#fxRateInput').value) || Store.settings().fxRate;
    const usd = Number(qs('#fxUsdInput').value) || 0;
    qs('#fxMvrInput').value = (usd * rate).toFixed(2);
  }
  qs('#saveTaxBtn').onclick = () => {
    const pct = Number(qs('#taxRateInput').value);
    if(isNaN(pct) || pct < 0 || pct > 100){ toast('Enter a tax rate between 0 and 100', true); return; }
    Store.saveSettings({ taxRate: +(pct / 100).toFixed(4) });
    toast(`Tax rate saved: ${pct}%`);
  };
  qs('#saveFxBtn').onclick = () => {
    const rate = Number(qs('#fxRateInput').value);
    if(isNaN(rate) || rate <= 0){ toast('Enter a conversion rate greater than 0', true); return; }
    Store.saveSettings({ fxRate: rate });
    qs('#fxRateSavedNote').textContent = `Saved: 1 USD = ${rate} MVR · used across storefront, checkout and this dashboard`;
    updateConverter();
    toast('Conversion rate saved');
  };
  qs('#fxUsdInput').addEventListener('input', updateConverter);
  qs('#fxMvrInput').addEventListener('input', () => {
    const rate = Number(qs('#fxRateInput').value) || Store.settings().fxRate;
    const mvr = Number(qs('#fxMvrInput').value) || 0;
    qs('#fxUsdInput').value = rate ? (mvr / rate).toFixed(2) : 0;
  });

  /* =========================================================
     DATA  (export / import / reset)
     ========================================================= */
  qs('#exportBtn').onclick = () => {
    const blob = new Blob([Store.exportJSON()], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Turqs-catalogue-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('Catalogue exported');
  };
  qs('#importFile').onchange = e => {
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = () => {
      try{ Store.importJSON(r.result); refreshAll(); toast('Catalogue imported'); }
      catch(err){ toast('Import failed: ' + err.message, true); }
      e.target.value = '';
    };
    r.readAsText(file);
  };
  qs('#resetBtn').onclick = () => confirmModal('Reset the catalogue?',
    'All admin changes to products, categories and prices are discarded and the seed data from data.js is restored.',
    () => { Store.reset(); refreshAll(); toast('Catalogue reset to defaults'); });

  /* =========================================================
     Modal helpers
     ========================================================= */
  const modal = qs('#adminModal');
  function openModal(html, narrow){
    qs('#adminModalBox').className = 'modal-box' + (narrow ? ' narrow' : '');
    qs('#adminModalBody').innerHTML = html;
    modal.classList.add('open');
    setTimeout(()=>modal.querySelector('input,select,textarea')?.focus(), 40);
  }
  function closeModal(){ modal.classList.remove('open'); }
  modal.addEventListener('click', e => {
    if(e.target === modal || e.target.closest('.modal-close') || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

  function confirmModal(title, text, onYes){
    openModal(`<h3>${esc(title)}</h3><p class="hint">${esc(text)}</p>
      <div class="modal-actions">
        <button type="button" class="btn neutral" data-close>Cancel</button>
        <button type="button" class="btn danger" id="confirmYes">Confirm</button>
      </div>`, true);
    qs('#confirmYes').onclick = () => { closeModal(); onYes(); };
  }

  /* ---------- boot ---------- */
  fillCategorySelects();
  showPanel('overview');
  renderOrders();
  renderProducts();
  renderCategories();
});
