# Turqs Maldives — GoDaddy Node.js

This package runs the storefront and Express API from one Node.js application.

### Included

- Express Node.js server
- Persistent JSON database: `server/data/db.json`
- Admin JWT login
- Product/category CRUD
- Category cover image upload from the admin form
- Tax %, FX rate and shipping settings synchronization
- Same-domain `/api/*` endpoints
- Existing jewellery + CANVASES storefront
- Stripe server endpoint retained for later live payment setup

### Local test

```bash
npm install
npm start
```

Open `http://localhost:4000`.

Admin:
- Email: `admin@turqs.com`
- Password: `Admin@123`

Change the admin credentials before going live with GoDaddy environment variables.

### GoDaddy Node.js Hosting

1. Upload this ZIP to GoDaddy Node.js Hosting, or connect the GitHub repository.
2. GoDaddy will install dependencies and run `npm start`.
3. Add these environment variables/secrets:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `CLIENT_URL=https://www.turqsmaldives.com`
   - `STRIPE_SECRET_KEY` (only when Stripe is enabled)
   - `STRIPE_WEBHOOK_SECRET` (only when Stripe webhooks are enabled)
4. Deploy the private preview.
5. Test `/api/health`, the homepage, and `/admin.html`.
6. Connect `www.turqsmaldives.com`.
7. Publish.

GoDaddy's current Node.js Hosting supports ZIP uploads or GitHub connections, automatically installs dependencies, and supports custom domains with HTTPS.

### JSON database note

The JSON database fixes the current in-memory catalogue problem. It is appropriate for this small application, but for a high-volume production store or guaranteed persistence across redeployments, move orders/catalogue to GoDaddy's managed MySQL database.

Never commit real secrets to GitHub.
