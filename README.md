# RakuShopBD

English-language e-commerce website for Bangladesh — **Node.js + Express + MySQL**. UI matches your original `shopbd-ecommerce-full` HTML design.

## বৈশিষ্ট্য

- হোম, প্রোডাক্ট, কার্ট, চেকআউট, অর্ডার সাকসেস — সব পেজ একই ডিজাইনে
- MySQL থেকে পণ্য লোড
- সেশন-ভিত্তিক কার্ট
- অর্ডার MySQL-এ সেভ
- cPanel Node.js App-এ ডিপ্লয়যোগ্য

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
- Login uses the `admins` table (username/email + bcrypt `password_hash`). On first `npm run db:setup`, set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env` — credentials are not shown on the login page.
- `npm run db:setup` চালালে `database/admin-schema.sql` ও `database/admin-extended.sql` স্বয়ংক্রিয়ভাবে চলে (reviews, banners, coupons, analytics, export)

### Storefront (admin-controlled)

- **Hero & promo banners** from admin → Banners
- **Product images** via admin product image URL / upload
- **Reviews** on product page; customers can submit (pending if approval is on in Settings)
- **Coupons** on cart; **delivery fee** uses admin settings (Dhaka vs outside Dhaka on checkout)
- **Clean URLs** (no `#`): `/account`, `/cart`, `/product/3`, `/category/electronics` — reload-safe

---

## cPanel এ ডিপ্লয়

### ১. MySQL

1. cPanel → **MySQL Databases**
2. নতুন database ও user তৈরি করুন
3. user-কে database-এ **All Privileges** দিন
4. phpMyAdmin → **Import** → `database/schema.sql` তারপর `database/seed.sql`

### ২. ফাইল আপলোড

`RakuShopBD` ফোল্ডারের সব ফাইল `public_html` বা subdomain ফোল্ডারে আপলোড করুন (FTP / File Manager)।

### ৩. Node.js App

1. cPanel → **Setup Node.js App**
2. **Create Application**
   - Node version: 18 বা তার উপরে
   - Application root: আপনার প্রজেক্ট ফোল্ডার (যেখানে `server.js` আছে)
   - Application URL: আপনার ডোমেইন
   - Application startup file: `server.js`
3. Environment variables যোগ করুন:

   | Variable | Value |
   |----------|--------|
   | `DB_HOST` | `localhost` |
   | `DB_USER` | cPanel MySQL user |
   | `DB_PASSWORD` | MySQL password |
   | `DB_NAME` | cPanel database name |
   | `SESSION_SECRET` | দীর্ঘ র্যান্ডম স্ট্রিং |
   | `NODE_ENV` | `production` |
   | `PORT` | cPanel যে পোর্ট দেয় (সাধারণত অটো) |

4. **Run NPM Install** ক্লিক করুন
5. **Restart** করুন

### ৪. `.env` (ঐচ্ছিক)

cPanel Environment variables ব্যবহার করলে `.env` ফাইল লাগবে না। লোকালের মতো `.env` রাখতে চাইলে প্রজেক্ট রুটে রাখুন — `dotenv` সেটা পড়বে।

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
