# RakuShopBD — cPanel Node.js Full Setup Guide (সম্পূর্ণ)

**GitHub:** https://github.com/advanceseoacademy/rakushopbd  
**Live site:** https://rakushopbd.com  
**Admin:** https://rakushopbd.com/admin  

> Mac/Windows Terminal দিয়ে cPanel server এ SSH করার দরকার **নেই**। সব কাজ **cPanel ব্রাউজার** দিয়ে করুন (শুধু Git clone/pull ছাড়া Terminal optional)।

---

## সূচিপত্র

1. [আগে যা লাগবে](#১-আগে-যা-লাগবে)
2. [MySQL Database বানানো](#২-mysql-database-বানানো)
3. [GitHub থেকে কোড আনা](#৩-github-থেকে-কোড-আনা)
4. [Node.js Application সেটআপ](#৪-nodejs-application-সেটআপ)
5. [Environment Variables](#৫-environment-variables)
6. [Database Import (এক ফাইল)](#৬-database-import-এক-ফাইল)
7. [NPM Install ও App চালু](#৭-npm-install-ও-app-চালু)
8. [ডোমেইন / public_html](#৮-ডোমেইন--public_html)
9. [টেস্ট চেকলিস্ট](#৯-টেস্ট-চেকলিস্ট)
10. [Admin Login](#১০-admin-login)
11. [কোড আপডেট (Git Pull)](#১১-কোড-আপডেট-git-pull)
12. [সমস্যা ও সমাধান](#১২-সমস্যা-ও-সমাধান)

---

## ১. আগে যা লাগবে

| জিনিস | বিবরণ |
|--------|--------|
| Hosting | Hostnin (বা যেকোনো cPanel + **Setup Node.js App**) |
| Domain | `rakushopbd.com` (addon/main domain) |
| Node.js | **20.x** (18+ চলবে) |
| MySQL | cPanel MySQL® Databases |
| Git | cPanel **Git™ Version Control** (বা File Manager upload) |

---

## ২. MySQL Database বানানো

### ধাপ ২.১ — Database + User

1. cPanel → **MySQL® Databases**
2. **Create New Database** → নাম দিন, যেমন: `rakushop_rakushopbd`
3. **MySQL Users** → নতুন user বানান (যেমন `rakushop_rakushopbd`) → **শক্তিশালী password** নোট করে রাখুন
4. **Add User To Database** → user + database সিলেক্ট → **ALL PRIVILEGES** → Make Changes

> cPanel-এ পুরো নাম সাধারণত `rakushop_rakushopbd` (prefix সহ) হয়।

### ধাপ ২.২ — লিখে রাখুন (পরে env তে লাগবে)

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rakushop_rakushopbd
DB_USER=rakushop_rakushopbd
DB_PASSWORD=আপনার_যে_password_দিয়েছেন
```

---

## ৩. GitHub থেকে কোড আনা

### পদ্ধতি A — Git Version Control (recommended)

1. cPanel → **Git™ Version Control** → **Create**
2. Clone URL:

```
https://github.com/advanceseoacademy/rakushopbd.git
```

3. Repository Path (উদাহরণ):

```
repositories/rakushopbd
```

4. Branch: `main` → Create

### পদ্ধতি B — ZIP

1. GitHub → **Code** → Download ZIP  
2. cPanel **File Manager** → `repositories/rakushopbd` → Upload + Extract  
3. **`node_modules` ফোল্ডার upload করবেন না**

### নিশ্চিত করুন

File Manager-এ এই ফাইলগুলো আছে:

- `server.js`
- `package.json`
- `routes/`, `lib/`, `public/`, `database/`

---

## ৪. Node.js Application সেটআপ

cPanel → **Setup Node.js App** → **Create Application**

| ফিল্ড | মান |
|--------|-----|
| **Node.js version** | `20` (বা সর্বোচ্চ available) |
| **Application mode** | `Production` |
| **Application root** | `repositories/rakushopbd` |
| **Application URL** | `rakushopbd.com` (আপনার domain) |
| **Application startup file** | `server.js` |

**Create** চাপুন।

---

## ৫. Environment Variables

Node.js App → আপনার app → **Environment Variables** → **ADD VARIABLE**

নিচের সব যোগ করুন (মান আপনার MySQL অনুযায়ী):

| Name | Value (উদাহরণ) |
|------|----------------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `rakushop_rakushopbd` |
| `DB_PASSWORD` | আপনার MySQL password |
| `DB_NAME` | `rakushop_rakushopbd` |
| `SESSION_SECRET` | দীর্ঘ random string (32+ অক্ষর) |
| `ADMIN_USERNAME` | `admin@rakushopbd.com` |
| `ADMIN_EMAIL` | `admin@rakushopbd.com` |
| `ADMIN_PASSWORD` | আপনার admin password |

**SAVE** চাপুন।

> `NODE_ENV` live-এ **`production`** রাখুন (`development` নয়)।  
> Database delete করে নতুন বানালে **`DB_PASSWORD` অবশ্যই আপডেট** করুন।

---

## ৬. Database Import (এক ফাইল)

### সহজ পদ্ধতি — এক SQL

1. cPanel → **phpMyAdmin**
2. বামে **`rakushop_rakushopbd`** (আপনার `DB_NAME`) সিলেক্ট
3. **Import** → Choose file:

```
database/rakushopbd-full-import.sql
```

(Git pull করলে server-এ path: `~/repositories/rakushopbd/database/rakushopbd-full-import.sql`)

4. **Import** / **Go**

এই ফাইলে আছে:

- পুরনো টেবিল DROP (যদি থাকে)
- সব টেবিল + sample products
- Admin user (password: `BDRakuadmin2026%%` — SQL header-এ লেখা)

### Import সফল কিনা দেখুন

SQL ট্যাবে:

```sql
SELECT COUNT(*) AS admins FROM admins;
SELECT COUNT(*) AS products FROM products;
```

`admins` = 1, `products` = 20+ হওয়া উচিত।

বিস্তারিত: `CPANEL-FRESH-DATABASE.txt`

---

## ৭. NPM Install ও App চালু

### ধাপ ৭.১ — `node_modules` মুছুন (গুরুত্বপূর্ণ)

CloudLinux error এড়াতে:

**File Manager** → `repositories/rakushopbd` → **`node_modules` ফোল্ডার DELETE**

> real `node_modules` folder থাকলে cPanel error দেয়। cPanel নিজে symlink বানাবে।

### ধাপ ৭.২ — Run NPM Install

**Setup Node.js App** → আপনার app → **Run NPM Install**

### ধাপ ৭.৩ — Terminal (optional কিন্তু ভালো)

cPanel → **Terminal** (Mac Terminal **নয়**):

```bash
cd ~/repositories/rakushopbd

git pull origin main

source /home/rakushop/nodevenv/repositories/rakushopbd/20/bin/activate
```

> `rakushop` = আপনার cPanel username। ভিন্ন হলে path ঠিক করুন (Node.js App-এ virtualenv path দেখুন)।

```bash
npm install
npm run admin:sync
```

`admin:sync` = `.env` বা cPanel env থেকে admin password database-এ sync।

### ধাপ ৭.৪ — App চালু

**Setup Node.js App** →

1. **STOP APP**
2. **১০ সেকেন্ড** অপেক্ষা
3. **START**

অথবা **Restart** — কাজ না করলে STOP → START ব্যবহার করুন।

---

## ৮. ডোমেইন / public_html

### `public_html/index.html` মুছুন

যদি `public_html/index.html` থাকে, Node app কাজ করলেও পুরনো static page দেখাতে পারে।

**File Manager** → `public_html` → `index.html` **Delete**

### Domain

Node.js App-এ **Application URL** = `rakushopbd.com` সেট থাকলে domain Node-এ point হবে।

---

## ৯. টেস্ট চেকলিস্ট

ব্রাউজারে এক এক করে খুলুন:

| # | URL | সঠিক ফলাফল |
|---|-----|-------------|
| 1 | https://rakushopbd.com/ | হোমপেজ, products দেখা যায় |
| 2 | https://rakushopbd.com/api/products | `{"ok":true,...}` JSON |
| 3 | https://rakushopbd.com/api/admin/version | `"apiVersion":2` |
| 4 | https://rakushopbd.com/api/admin/ping | `"adminCount":1` |
| 5 | https://rakushopbd.com/admin | Login page |

### ভুল ফলাফল

| দেখছেন | মানে | করণীয় |
|--------|------|--------|
| `Database error` | MySQL connect fail | env `DB_*` ঠিক করুন, import করুন, STOP→START |
| `adminCount:0` | admin নেই | `rakushopbd-full-import.sql` আবার import |
| Page not found (API) | পুরনো Node process | git pull + STOP→START |
| Static welcome page | `public_html/index.html` | Delete করুন |

---

## ১০. Admin Login

| | |
|--|--|
| **URL** | https://rakushopbd.com/admin |
| **Username** | `admin@rakushopbd.com` |
| **Password** | SQL import করলে: `BDRakuadmin2026%%` (অথবা env `ADMIN_PASSWORD`) |

Login পর dashboard খুললে ✅ সফল।

Password বদলাতে:

```bash
npm run admin:sync
```

(env-এ `ADMIN_PASSWORD` আগে সেট করুন)

---

## ১১. কোড আপডেট (Git Pull)

নতুন code GitHub-এ থাকলে:

```bash
cd ~/repositories/rakushopbd
git pull origin main
```

তারপর:

1. `node_modules` folder **DELETE** (যদি error হয়)
2. **Run NPM Install**
3. **STOP** → ১০ সেকেন্ড → **START**

দ্রুত reference: `CPANEL-COPY-PASTE.txt`

---

## ১২. সমস্যা ও সমাধান

### `npm: command not found`

Terminal-এ virtualenv activate করুন:

```bash
source /home/YOUR_USER/nodevenv/repositories/rakushopbd/20/bin/activate
```

অথবা শুধু cPanel UI: **Run NPM Install** + **Restart**

---

### লাল error: `node_modules` in application root

→ File Manager থেকে `node_modules` **DELETE** → **Run NPM Install**

---

### Login হয় কিন্তু reload-এ আবার login

→ `git pull` → STOP → START  
→ Login response-এ `token` আসে কিনা (browser Network tab)

---

### `Database error` on ping + products fail

1. phpMyAdmin-এ টেবিল আছে কিনা  
2. `DB_NAME`, `DB_USER`, `DB_PASSWORD` cPanel MySQL-এর সাথে **মিল**  
3. User-কে database-এ **ALL PRIVILEGES**  
4. Database নতুন বানালে password **আপডেট** → SAVE → STOP → START

---

### Git pull কাজ করে না

cPanel → **Git Version Control** → Pull  
অথবা GitHub ZIP → File Manager upload

ম্যানুয়াল fix ফাইল: `LIVE-FIX-UPLOAD.txt`

---

## দ্রুত কমান্ড (copy-paste)

cPanel Terminal:

```bash
cd ~/repositories/rakushopbd
git pull origin main
source /home/rakushop/nodevenv/repositories/rakushopbd/20/bin/activate
npm install
npm run admin:sync
```

তারপর Node.js App → **STOP** → **START**

---

## লোকাল development (Mac)

```bash
cd "Website Project/RakuShopBD"
cp .env.example .env
# .env এ DB_* ও ADMIN_* দিন
npm install
npm run db:setup
npm start
```

→ http://localhost:3000  
→ Admin: http://localhost:3000/admin

---

## সংশ্লিষ্ট ফাইল

| ফাইল | উদ্দেশ্য |
|------|---------|
| `CPANEL-NODEJS-FULL-GUIDE.md` | এই গাইড |
| `CPANEL-COPY-PASTE.txt` | দ্রুত deploy commands |
| `CPANEL-FRESH-DATABASE.txt` | Database fresh install |
| `database/rakushopbd-full-import.sql` | এক ফাইলে পুরো DB |
| `DEPLOY.md` | সংক্ষিপ্ত deploy notes |

---

**সহায়তা:** GitHub Issues: https://github.com/advanceseoacademy/rakushopbd/issues
