/* ============ Shared helpers, rendering and cart engine ============ */
const CART_KEY   = 'Turqs_cart';
const ORDERS_KEY = 'Turqs_orders';

const money = n => STORE.currency + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
const qs  = (s,el=document)=>el.querySelector(s);
const qsa = (s,el=document)=>[...el.querySelectorAll(s)];
const param = k => new URLSearchParams(location.search).get(k);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* products visible on the storefront (admin can hide a product) */
const shopProducts = () => PRODUCTS.filter(p => p.active !== false);
const findProduct  = id => PRODUCTS.find(p => p.id === id);
const catName = id => (CATEGORIES.find(c=>c.id===id)||{}).name || id;

/* ---------- Cart ---------- */
const Cart = {
  get(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch(e){ return []; } },
  save(items){ localStorage.setItem(CART_KEY, JSON.stringify(items)); Cart.badge(); },
  add(id, qty=1){
    const p = findProduct(id); if(!p) return;
    const items = Cart.get();
    const found = items.find(i=>i.id===id);
    if(found) found.qty = Math.min(found.qty+qty, p.stock);
    else items.push({ id, qty:Math.min(qty, p.stock) });
    Cart.save(items);
    toast(`${p.name} added to bag`);
  },
  setQty(id, qty){
    const items = Cart.get();
    const it = items.find(i=>i.id===id); if(!it) return;
    it.qty = Math.max(1, qty); Cart.save(items);
  },
  remove(id){ Cart.save(Cart.get().filter(i=>i.id!==id)); },
  clear(){ localStorage.removeItem(CART_KEY); Cart.badge(); },
  /* prices are always re-read from the catalogue, so an admin price
     change is reflected in an open cart on the next page load */
  detailed(){
    return Cart.get().map(i=>{
      const p = findProduct(i.id);
      return p ? {...p, qty:i.qty, line:p.price*i.qty} : null;
    }).filter(Boolean);
  },
  totals(){
    const items    = Cart.detailed();
    const subtotal = items.reduce((s,i)=>s+i.line,0);
    const shipping = subtotal===0 || subtotal>=STORE.freeShippingOver ? 0 : STORE.shippingFlat;
    const tax      = +(subtotal*STORE.taxRate).toFixed(2);
    return { items, subtotal, shipping, tax,
             total:+(subtotal+shipping+tax).toFixed(2),
             count:items.reduce((s,i)=>s+i.qty,0) };
  },
  badge(){
    const n = Cart.get().reduce((s,i)=>s+i.qty,0);
    qsa('[data-cart-count]').forEach(el=>{ el.textContent = n; el.style.display = n ? 'grid':'none'; });
  }
};

/* ---------- Toast ---------- */
function toast(msg, bad){
  let t = qs('#toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* ---------- Templates ---------- */
function productCard(p){
  return `
  <article class="product-card">
    <a class="thumb" href="product.html?id=${p.id}">
      ${p.tag ? `<span class="badge">${esc(p.tag)}</span>`:''}
      <img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">
    </a>
    <div class="info">
      <span class="cat">${esc(catName(p.category))}</span>
      <a class="name" href="product.html?id=${p.id}">${esc(p.name)}</a>
      <span class="price">${money(p.price)}${p.old?`<span class="old">${money(p.old)}</span>`:''}</span>
      <div class="card-actions">
        <button class="btn" data-add="${p.id}" ${p.stock?'':'disabled'}>${p.stock?'Add to bag':'Sold out'}</button>
        <button class="btn ghost" data-view="${p.id}">View</button>
      </div>
    </div>
  </article>`;
}
function categoryCard(c){
  const n = PRODUCTS.filter(p=>p.category===c.id && p.active!==false).length;
  return `<a class="cat-card" href="products.html?cat=${c.id}">
    <img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy">
    <div class="label"><h3>${esc(c.name)}</h3><small>${esc(c.desc)} · ${n} piece${n!==1?'s':''}</small></div>
  </a>`;
}

/* ---------- Instagram ---------- */
function renderInstagram(sel){
  const el = qs(sel);
  qsa('[data-insta-link]').forEach(a=>a.href = STORE.instagram);
  if(!el) return;
  el.innerHTML = INSTA_POSTS.map(src=>
    `<a href="${STORE.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Open Instagram">
       <img src="${src}" alt="Instagram post" loading="lazy"></a>`).join('');
}

/* ---------- Quick view ---------- */
function openQuickView(id){
  const p = findProduct(id); if(!p) return;
  let m = qs('#quickview');
  if(!m){
    m = document.createElement('div'); m.id='quickview'; m.className='modal';
    m.innerHTML = `<div class="modal-box"><button class="modal-close" aria-label="Close">&times;</button><div id="qv-body"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e=>{ if(e.target===m||e.target.classList.contains('modal-close')) m.classList.remove('open'); });
  }
  qs('#qv-body', m).innerHTML = `
    <div class="detail">
      <div class="gallery-main"><img src="${esc(p.images[0])}" alt="${esc(p.name)}"></div>
      <div>
        <span class="cat">${esc(catName(p.category))}</span>
        <h2>${esc(p.name)}</h2>
        <p class="price">${money(p.price)}${p.old?`<span class="old">${money(p.old)}</span>`:''}</p>
        <p class="subtitle" style="margin:14px 0">${esc(p.desc)}</p>
        <div class="spec"><span>Metal</span><span>${esc(p.metal)}</span></div>
        <div class="spec"><span>Stone</span><span>${esc(p.stone)}</span></div>
        <div class="spec"><span>SKU</span><span>${esc(p.sku)}</span></div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn" data-add="${p.id}">Add to bag</button>
          <a class="btn ghost" href="product.html?id=${p.id}">Full details</a>
        </div>
      </div>
    </div>`;
  m.classList.add('open');
}

/* ---------- Delegated events ---------- */
document.addEventListener('click', e=>{
  const add  = e.target.closest('[data-add]');
  const view = e.target.closest('[data-view]');
  if(add)  Cart.add(+add.dataset.add, +(add.dataset.qty||1));
  if(view) openQuickView(+view.dataset.view);
  if(e.target.closest('.burger')) qs('.nav-links')?.classList.toggle('open');
});

document.addEventListener('DOMContentLoaded', ()=>{
  Cart.badge();
  if(qs('#categoryGrid')) qs('#categoryGrid').innerHTML = CATEGORIES.map(categoryCard).join('');
  if(qs('#featuredGrid'))
    qs('#featuredGrid').innerHTML = shopProducts().filter(p=>p.tag).slice(0,4).map(productCard).join('');
  renderInstagram('#instaGrid');
  if(qs('#year')) qs('#year').textContent = new Date().getFullYear();
  initShop(); initProductPage(); initCartPage(); initThankYou();
});

/* ============ Shop listing ============ */
function initShop(){
  const grid = qs('#shopGrid'); if(!grid) return;
  const state = { cat: param('cat') || 'all', sort:'featured', q:'' };

  qs('#catChips').innerHTML = [{id:'all',name:'All jewellery'}, ...CATEGORIES]
    .map(c=>`<button class="chip ${c.id===state.cat?'active':''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');

  function render(){
    let list = shopProducts().filter(p =>
      (state.cat==='all' || p.category===state.cat) &&
      (!state.q || (p.name+p.metal+p.stone+p.sku).toLowerCase().includes(state.q.toLowerCase())));
    if(state.sort==='low')  list.sort((a,b)=>a.price-b.price);
    if(state.sort==='high') list.sort((a,b)=>b.price-a.price);
    if(state.sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
    qs('#resultCount').textContent = `${list.length} piece${list.length!==1?'s':''}`;
    qs('#shopTitle').textContent = state.cat==='all' ? 'All Jewellery' : catName(state.cat);
    grid.innerHTML = list.length ? list.map(productCard).join('')
                                 : `<p class="empty">No pieces match your filters.</p>`;
  }
  qs('#catChips').addEventListener('click', e=>{
    const b = e.target.closest('[data-cat]'); if(!b) return;
    state.cat = b.dataset.cat;
    qsa('.chip').forEach(c=>c.classList.toggle('active', c===b));
    history.replaceState(null,'',`?cat=${state.cat}`);
    render();
  });
  qs('#sortSelect').addEventListener('change', e=>{ state.sort=e.target.value; render(); });
  qs('#searchInput').addEventListener('input', e=>{ state.q=e.target.value; render(); });
  render();
}

/* ============ Product page ============ */
function initProductPage(){
  const root = qs('#productDetail'); if(!root) return;
  const p = findProduct(+param('id')) || shopProducts()[0];
  if(!p){ root.innerHTML = '<p class="empty">This product is no longer available.</p>'; return; }
  document.title = `${p.name} - ${STORE.name}`;
  root.innerHTML = `
    <div>
      <div class="gallery-main"><img id="mainImg" src="${esc(p.images[0])}" alt="${esc(p.name)}"></div>
      <div class="thumbs">${p.images.map((s,i)=>`<img src="${esc(s)}" class="${i?'':'active'}" alt="view ${i+1}">`).join('')}</div>
    </div>
    <div>
      <span class="cat">${esc(catName(p.category))}</span>
      <h1>${esc(p.name)}</h1>
      <p class="price" style="margin:10px 0 16px">${money(p.price)}${p.old?`<span class="old">${money(p.old)}</span>`:''}</p>
      <p class="subtitle">${esc(p.desc)}</p>
      <div class="spec"><span>Metal</span><span>${esc(p.metal)}</span></div>
      <div class="spec"><span>Stone</span><span>${esc(p.stone)}</span></div>
      <div class="spec"><span>Weight</span><span>${esc(p.weight)}</span></div>
      <div class="spec"><span>SKU</span><span>${esc(p.sku)}</span></div>
      <div class="spec"><span>Availability</span><span>${p.stock>0?`In stock (${p.stock})`:'Sold out'}</span></div>
      <div style="display:flex;gap:14px;align-items:center;margin-top:22px;flex-wrap:wrap">
        <div class="qty">
          <button id="minus" aria-label="Decrease">-</button>
          <input id="qtyInput" type="number" value="1" min="1" max="${p.stock}">
          <button id="plus" aria-label="Increase">+</button>
        </div>
        <button class="btn" id="addBtn" ${p.stock?'':'disabled'}>Add to bag</button>
        <a class="btn ghost" href="cart.html">Go to bag</a>
      </div>
      <p class="auth-note">Free insured delivery over ${money(STORE.freeShippingOver)} · 30-day returns · Lifetime cleaning.</p>
    </div>`;
  qsa('.thumbs img').forEach(t=>t.onclick=()=>{
    qs('#mainImg').src = t.src;
    qsa('.thumbs img').forEach(x=>x.classList.toggle('active', x===t));
  });
  const qty = qs('#qtyInput');
  qs('#minus').onclick = ()=> qty.value = Math.max(1, +qty.value-1);
  qs('#plus').onclick  = ()=> qty.value = Math.min(p.stock, +qty.value+1);
  qs('#addBtn').onclick= ()=> Cart.add(p.id, +qty.value);
  qs('#relatedGrid').innerHTML = shopProducts()
    .filter(x=>x.category===p.category && x.id!==p.id).slice(0,4).map(productCard).join('');
}

/* ============ Cart page ============ */
function initCartPage(){
  const body = qs('#cartBody'); if(!body) return;
  function render(){
    const t = Cart.totals();
    if(!t.items.length){
      qs('#cartWrap').innerHTML = `<p class="empty">Your bag is empty.<br><br>
        <a class="btn" href="products.html">Continue shopping</a></p>`;
      return;
    }
    body.innerHTML = t.items.map(i=>`
      <tr>
        <td><div class="cart-item"><img src="${esc(i.images[0])}" alt="${esc(i.name)}">
          <div><a class="name" href="product.html?id=${i.id}">${esc(i.name)}</a>
          <div class="cat">${esc(catName(i.category))} · ${esc(i.sku)}</div></div></div></td>
        <td class="num">${money(i.price)}</td>
        <td class="num">
          <div class="qty" style="margin-left:auto">
            <button data-dec="${i.id}">-</button>
            <input type="number" value="${i.qty}" min="1" data-qty="${i.id}">
            <button data-inc="${i.id}">+</button>
          </div></td>
        <td class="num">${money(i.line)}</td>
        <td class="num"><button class="link-danger" data-del="${i.id}">Remove</button></td>
      </tr>`).join('');
    qs('#sumSub').textContent   = money(t.subtotal);
    qs('#sumShip').textContent  = t.shipping? money(t.shipping) : 'Free';
    qs('#sumTax').textContent   = money(t.tax);
    qs('#sumTotal').textContent = money(t.total);
  }
  qs('#cartWrap').addEventListener('click', e=>{
    const d = e.target.dataset;
    if(d.del){ Cart.remove(+d.del); render(); }
    if(d.inc){ const i=Cart.get().find(x=>x.id===+d.inc); Cart.setQty(+d.inc, i.qty+1); render(); }
    if(d.dec){ const i=Cart.get().find(x=>x.id===+d.dec); Cart.setQty(+d.dec, i.qty-1); render(); }
  });
  qs('#cartWrap').addEventListener('change', e=>{
    if(e.target.dataset.qty){ Cart.setQty(+e.target.dataset.qty, +e.target.value||1); render(); }
  });
  render();
}

/* ============ Thank-you page ============ */
function initThankYou(){
  const box = qs('#orderBox'); if(!box) return;
  const id = param('order');
  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  const o = orders.find(x=>x.id===id) || orders[0];
  if(!o){ box.innerHTML = `<p class="empty">No order found. <a href="products.html">Continue shopping</a></p>`; return; }
  const d = o.delivery;
  box.innerHTML = `
    <div class="panel">
      <span class="tag ${o.payment.status==='paid'?'paid':'pending'}">${o.payment.status}</span>
      <h2 style="margin-top:12px">Thank you, ${esc(d.fullName.split(' ')[0])}</h2>
      <p class="subtitle">Order <strong>${esc(o.id)}</strong> · a confirmation was sent to ${esc(d.email)}.</p>
      ${o.items.map(i=>`<div class="summary-row"><span>${esc(i.name)} x ${i.qty}</span><span>${money(i.price*i.qty)}</span></div>`).join('')}
      <div class="summary-row"><span>Delivery</span><span>${o.amounts.shipping?money(o.amounts.shipping):'Free'}</span></div>
      <div class="summary-row"><span>Tax</span><span>${money(o.amounts.tax)}</span></div>
      <div class="summary-row total"><span>Total paid</span><span>${money(o.amounts.total)}</span></div>
    </div>
    <aside class="panel">
      <h3>Delivering to</h3>
      <p class="hint">${esc(d.fullName)}<br>${esc(d.address1)}${d.address2?'<br>'+esc(d.address2):''}<br>
      ${esc(d.city)}, ${esc(d.state)} ${esc(d.zip)}<br>${esc(d.country)}<br>${esc(d.phone)}</p>
      <div class="spec" style="margin-top:14px"><span>Method</span><span>${esc(d.method)}</span></div>
      <div class="spec"><span>Payment</span><span>${esc(o.payment.method.toUpperCase())}</span></div>
      <div class="spec"><span>Reference</span><span>${esc(o.payment.reference||'-')}</span></div>
      <a class="btn block" href="products.html" style="margin-top:18px">Continue shopping</a>
    </aside>`;
}
