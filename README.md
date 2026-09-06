# Turqs Maldives. — jewellery store (HTML / CSS / JS + optional Node API)

Static storefront with a cart, a checkout that talks to a payment gateway, and an
**admin dashboard with full catalogue management** (categories, products, prices, stock).

## Structure
```
turqs-store/
├── index.html            Home + categories + Instagram
├── products.html         Category list + product grid
├── product.html          Single product view (?id=1)
├── cart.html             Cart
├── checkout.html         Delivery details + payment gateway
├── thank-you.html        Order confirmation
├── admin.html            Admin login
├── admin-dashboard.html  Admin panel
├── css/style.css
├── js/
│   ├── data.js           Seed categories + products
│   ├── store.js          Catalogue persistence + admin CRUD
│   ├── app.js            Shared UI, rendering, cart engine
│   ├── checkout.js       Delivery validation + payment
│   ├── auth.js           Login logic
│   └── admin.js          Dashboard logic
├── img/                  Your own photos
└── server/               Express API (JWT auth, catalogue CRUD, Stripe)
```

## Run
1. Open the folder in VS Code, right-click `index.html` -> **Open with Live Server**
   (use HTTP, not `file://`).
2. Optional API: `cd server` -> `npm install` -> `cp .env.example .env` -> `npm start`.

## Demo credentials
| Role  | Email             | Password  |
|-------|-------------------|-----------|
| Admin | admin@turqs.com   | Admin@123 |

The separate customer/staff login page has been removed — only the admin panel
requires sign-in.

Test card: `4242 4242 4242 4242`, any future expiry, any CVV.

## Admin dashboard
* **Overview** — orders, revenue, stock value, low-stock table, catalogue activity log.
* **Products** — add / edit / hide / delete; inline editing of price, compare-at price and stock.
* **Categories** — add / edit / delete; deleting asks where to move the products; renaming a
  slug re-points its products automatically.
* **Pricing & stock** — bulk price changes (%, amount, fixed, start/end sale) with a live
  preview, price-range report per category, and bulk restock.
* **Settings** — set the tax rate (%) manually and the MVR/USD conversion rate used across
  the storefront, checkout and this dashboard.
* **Import / export** — JSON backup, restore, reset to the defaults in `js/data.js`.

All changes are stored in `localStorage` and read by the storefront, so they appear on the
shop immediately. Wire `js/store.js` to the `/api/admin/*` routes in `server/server.js`
to move the catalogue into a real database.

## Customise
1. `js/data.js` -> `STORE.instagram` — your Instagram URL (used by every ad link).
2. `js/data.js` -> `STORE.currency`, `taxRate`, `shippingFlat`, `freeShippingOver`, `lowStockAt`.
3. `js/checkout.js` -> `DEMO_MODE = false` and `js/auth.js` -> `USE_SERVER_AUTH = true`
   once the API is running.

## Before going live
Recalculate every price and total on the server, store users in a database with hashed
passwords, serve over HTTPS, keep gateway secret keys server-side only, and confirm
payments through the gateway webhook rather than the browser redirect.
