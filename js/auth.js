/* ============ Authentication (demo - swap for the server API) ============ */
const API_AUTH = '/api/auth/login';
const USE_SERVER_AUTH = true;   // true -> POST to the backend instead of DEMO_USERS

const DEMO_USERS = [
  { email:'admin@turqs.com', password:'Admin@123', role:'admin', name:'Store Admin' }
];

const Auth = {
  key:'turqs_session',
  session(){ try{ return JSON.parse(sessionStorage.getItem(Auth.key)); }catch(e){ return null; } },
  set(u){ sessionStorage.setItem(Auth.key, JSON.stringify(u)); },
  logout(){ sessionStorage.removeItem(Auth.key); location.href='admin.html'; },
  guard(role){
    const s = Auth.session();
    if(!s || (role && s.role !== role)){
      location.href = 'admin.html';
      return null;
    }
    return s;
  },
  async login(email, password, requiredRole){
    if(USE_SERVER_AUTH){
      const res = await fetch(API_AUTH, { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ email, password }) });
      if(!res.ok) throw new Error('Invalid email or password');
      const data = await res.json();
      if(requiredRole && data.user.role !== requiredRole) throw new Error('You do not have access to this panel');
      Auth.set({ ...data.user, token:data.token });
      return data.user;
    }
    await new Promise(r=>setTimeout(r,600));
    const u = DEMO_USERS.find(u => u.email === email.toLowerCase().trim() && u.password === password);
    if(!u) throw new Error('Invalid email or password');
    if(requiredRole && u.role !== requiredRole) throw new Error('You do not have access to this panel');
    Auth.set({ email:u.email, role:u.role, name:u.name, token:'demo-token' });
    return u;
  }
};

/* Shared login form handler (admin.html) */
function initLoginForm(formId, requiredRole, redirect){
  const form = document.querySelector('#'+formId); if(!form) return;
  const alertEl = form.querySelector('.alert');
  const btn = form.querySelector('button[type=submit]');
  const show = m => { alertEl.textContent = m; alertEl.className = 'alert err show';
                      btn.disabled = false; btn.textContent = 'Sign in'; };

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    alertEl.className = 'alert';
    const email = form.email.value, pass = form.password.value;
    if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return show('Enter a valid email address');
    if(pass.length < 6) return show('Password must be at least 6 characters');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try{
      await Auth.login(email, pass, requiredRole);
      if(form.remember?.checked) localStorage.setItem('turqs_last_email', email);
      location.href = redirect;
    }catch(err){ show(err.message); }
  });

  const last = localStorage.getItem('turqs_last_email');
  if(last) form.email.value = last;
  document.querySelectorAll('[data-toggle-pass]').forEach(b => b.onclick = () => {
    const i = form.password; i.type = i.type === 'password' ? 'text' : 'password';
    b.textContent = i.type === 'password' ? 'Show' : 'Hide';
  });
}
