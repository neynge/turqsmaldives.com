/* ============ Checkout: delivery details + payment gateway ============ */
const API_BASE  = 'http://localhost:4000';   // your backend
const DEMO_MODE = true;                      // true = simulate the gateway, no server needed

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#checkoutForm'); if(!form) return;

  const t = Cart.totals();
  if(!t.count){ location.href = 'cart.html'; return; }

  const fv = id => (document.querySelector('#'+id)?.value || '').trim();

  /* ---- Summary (prices come live from the catalogue) ---- */
  document.querySelector('#coItems').innerHTML = t.items.map(i=>`
    <div class="summary-row"><span>${esc(i.name)} x ${i.qty}</span><span>${money(i.line)}</span></div>`).join('');
  document.querySelector('#coSub').textContent   = money(t.subtotal);
  document.querySelector('#coShip').textContent  = t.shipping ? money(t.shipping) : 'Free';
  document.querySelector('#coTax').textContent   = money(t.tax);
  document.querySelector('#coTotal').textContent = money(t.total);
  document.querySelector('#payBtn').textContent  = 'Pay ' + money(t.total);

  /* ---- Payment method ---- */
  const cardFields = document.querySelector('#cardFields');
  document.querySelectorAll('.pay-option').forEach(opt=>{
    opt.addEventListener('click', ()=>{
      document.querySelectorAll('.pay-option').forEach(o=>o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
      cardFields.style.display = opt.dataset.method === 'card' ? 'block' : 'none';
    });
  });

  /* ---- Masks ---- */
  const cardNo = document.querySelector('#cardNumber');
  cardNo.addEventListener('input', ()=>{
    cardNo.value = cardNo.value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  });
  const exp = document.querySelector('#cardExpiry');
  exp.addEventListener('input', ()=>{
    const v = exp.value.replace(/\D/g,'').slice(0,4);
    exp.value = v.length>2 ? v.slice(0,2)+'/'+v.slice(2) : v;
  });

  /* ---- Validation ---- */
  const rules = {
    fullName: v => v.trim().length>=3 || 'Enter your full name',
    email:    v => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) || 'Enter a valid email',
    phone:    v => /^[\d+\-\s()]{8,16}$/.test(v) || 'Enter a valid phone number',
    address1: v => v.trim().length>=5 || 'Enter your street address',
    city:     v => v.trim().length>=2 || 'Enter your city',
    state:    v => v.trim().length>=2 || 'Enter your state / region',
    zip:      v => /^[A-Za-z0-9\s-]{3,10}$/.test(v) || 'Enter a valid postal code',
    country:  v => !!v || 'Select a country'
  };
  const cardRules = {
    cardName:   v => v.trim().length>=3 || 'Name on card is required',
    cardNumber: v => v.replace(/\s/g,'').length===16 || 'Card number must be 16 digits',
    cardExpiry: v => /^(0[1-9]|1[0-2])\/\d{2}$/.test(v) || 'Use MM/YY',
    cardCvv:    v => /^\d{3,4}$/.test(v) || 'CVV must be 3-4 digits'
  };
  function validate(set){
    let ok = true;
    for(const [id,fn] of Object.entries(set)){
      const el = document.querySelector('#'+id);
      const field = el.closest('.field');
      const res = fn(el.value);
      if(res !== true){ field.classList.add('invalid'); field.querySelector('.error').textContent = res; ok = false; }
      else field.classList.remove('invalid');
    }
    return ok;
  }

  /* ---- Submit ---- */
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const method = document.querySelector('input[name="pay"]:checked').value;
    let valid = validate(rules);
    if(method === 'card') valid = validate(cardRules) && valid;
    if(!valid){ document.querySelector('.field.invalid input')?.focus(); return; }

    const btn = document.querySelector('#payBtn');
    btn.disabled = true; btn.textContent = 'Processing...';

    const order = {
      id: 'AUR-' + Date.now().toString().slice(-8),
      createdAt: new Date().toISOString(),
      items: t.items.map(i=>({ id:i.id, sku:i.sku, name:i.name, qty:i.qty, price:i.price })),
      amounts: { subtotal:t.subtotal, shipping:t.shipping, tax:t.tax, total:t.total },
      delivery: {
        fullName:fv('fullName'), email:fv('email'), phone:fv('phone'),
        address1:fv('address1'), address2:fv('address2'), city:fv('city'),
        state:fv('state'), zip:fv('zip'), country:fv('country'),
        method:document.querySelector('#shipMethod').value, notes:fv('notes')
      },
      payment: { method, status:'pending' }
    };

    try{
      if(DEMO_MODE || method === 'cod'){
        await new Promise(r=>setTimeout(r, 1200));
        order.payment.status = method === 'cod' ? 'pending' : 'paid';
        order.payment.reference = 'DEMO-' + Math.random().toString(36).slice(2,10).toUpperCase();
      }else{
        const res = await fetch(`${API_BASE}/api/checkout/session`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(order) });
        if(!res.ok) throw new Error('Gateway error');
        const data = await res.json();
        saveOrder(order);
        location.href = data.url;
        return;
      }
      saveOrder(order);
      decrementStock(order);
      Cart.clear();
      location.href = 'thank-you.html?order=' + order.id;
    }catch(err){
      const a = document.querySelector('#coAlert');
      a.textContent = 'Payment failed: ' + err.message; a.className = 'alert err show';
      btn.disabled = false; btn.textContent = 'Pay ' + money(t.total);
    }
  });

  function saveOrder(o){
    const all = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    all.unshift(o); localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
  }
  /* keep admin stock figures in step with sales (demo only) */
  function decrementStock(o){
    const list = Store.products();
    o.items.forEach(i => {
      const p = list.find(x=>x.id===i.id);
      if(p) p.stock = Math.max(0, p.stock - i.qty);
    });
    Store.saveProducts(list);
  }
});
