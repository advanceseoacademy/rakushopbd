# RakuShopBD

English-language e-commerce website for Bangladesh — **Node.js + Express + MySQL**. UI matches your original `shopbd-ecommerce-full` HTML design.

## বৈশিষ্ট্য

- হোম, প্রোডাক্ট, কার্ট, চেকআউট, অর্ডার সাকসেস — সব পেজ একই ডিজাইনে
- MySQL থেকে পণ্য লোড
- সেশন-ভিত্তিক কার্ট
- অর্ডার MySQL-এ সেভ
- cPanel Node.js App-এ ডিপ্লয়যোগ্য

## Live deploy (cPanel Node.js)

**সম্পূর্ণ গাইড:** [`CPANEL-NODEJS-FULL-GUIDE.md`](CPANEL-NODEJS-FULL-GUIDE.md)  
দ্রুত commands: [`CPANEL-COPY-PASTE.txt`](CPANEL-COPY-PASTE.txt)  
Database: [`database/rakushopbd-full-import.sql`](database/rakushopbd-full-import.sql)

## লোকাল সেটআপ

### ১. Dependencies

```bash
cd "Website Project/RakuShopBD"
npm install
```

### ২. Environment

```bash
cp .env.example .env
```

`.env` এ MySQL তথ্য দিন:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rakushopbd
SESSION_SECRET=একটি-দীর্ঘ-র্যান্ডম-স্ট্রিং
PORT=3000
```

### ৩. Database

phpMyAdmin বা টার্মিনালে:

```bash
npm run db:setup
```

অথবা `database/schema.sql` ও `database/seed.sql` ম্যানুয়ালি import করুন।

### ৪. চালু করুন

```bash
npm start
```

ব্রাউজার: [http://localhost:3000](http://localhost:3000)

### ৫. Admin panel

- URL: [http://localhost:3000/admin](http://localhost:3000/admin)
- Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run admin:sync
```

- Login with **ADMIN_USERNAME** (or email) + **ADMIN_PASSWORD** from `.env`.
- On live server: same `.env` values in cPanel Node environment variables, then `npm run admin:sync` via Terminal (virtualenv), or `database/insert-admin.sql` in phpMyAdmin.
- `npm run db:setup` চালালে `database/admin-schema.sql` ও `database/admin-extended.sql` স্বয়ংক্রিয়ভাবে চলে (reviews, banners, coupons, analytics, export)

### Storefront (admin-controlled)

- **Hero & promo banners** from admin → Banners
- **Product images** via admin product image URL / upload
- **Reviews** on product page; customers can submit (pending if approval is on in Settings)
- **Coupons** on cart; **delivery fee** uses admin settings (Dhaka vs outside Dhaka on checkout)
- **Clean URLs** (no `#`): `/account`, `/cart`, `/product/3`, `/category/electronics` — reload-safe

---

## cPanel এ ডিপ্লয়

সম্পূর্ণ ধাপ: **[DEPLOY.md](./DEPLOY.md)**

সংক্ষেপ: Git clone → MySQL import (`schema`, `auth-schema`, `admin-schema`, `admin-extended`) → Node.js app → env variables → `npm run admin:sync` → `public_html/index.html` মুছুন → Restart।

---

## প্রজেক্ট স্ট্রাকচার

```
RakuShopBD/
├── server.js           # Express সার্ভার
├── config/db.js        # MySQL connection pool
├── routes/api.js       # REST API (products, cart, orders)
├── database/
│   ├── schema.sql
│   └── seed.sql
├── public/
│   ├── css/main.css    # মূল ডিজাইন CSS
│   └── js/
│       ├── app.js      # UI ইন্টারঅ্যাকশন (মূল HTML থেকে)
│       └── api.js      # Backend সংযোগ
└── views/index.ejs     # মূল পেজ (আপনার HTML ডিজাইন)
```

## API Endpoints

| Method | URL | বিবরণ |
|--------|-----|--------|
| GET | `/api/products` | সব পণ্য (`?category=electronics`) |
| GET | `/api/products/:id` | একটি পণ্য |
| GET | `/api/cart` | কার্ট + টোটাল |
| POST | `/api/cart/add` | কার্টে যোগ `{ productId, qty }` |
| PATCH | `/api/cart/:productId` | পরিমাণ আপডেট |
| DELETE | `/api/cart/:productId` | আইটেম মুছুন |
| POST | `/api/orders` | অর্ডার প্লেস |

---

## পরবর্তী ধাপ (ঐচ্ছিক)

- Admin panel (পণ্য CRUD)
- bKash / Nagad payment gateway
- ইউজার লগইন / অর্ডার হিস্ট্রি
- প্রোডাক্ট ইমেজ আপলোড
