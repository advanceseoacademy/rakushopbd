# RakuShopBD — Live Deploy (Hostnin / cPanel)

GitHub: https://github.com/advanceseoacademy/rakushopbd

> **সম্পূর্ণ step-by-step গাইড:** [`CPANEL-NODEJS-FULL-GUIDE.md`](CPANEL-NODEJS-FULL-GUIDE.md)  
> **এক ফাইলে DB:** `database/rakushopbd-full-import.sql`

---

## ১. GitHub থেকে কোড

cPanel → **Git™ Version Control** → Clone:

```
https://github.com/advanceseoacademy/rakushopbd.git
```

Path (উদাহরণ): `repositories/rakushopbd`

---

## ২. MySQL (phpMyAdmin — এই ক্রমে Import)

| ক্রম | ফাইল |
|------|------|
| 1 | `database/schema.sql` |
| 2 | `database/auth-schema.sql` |
| 3 | `database/admin-schema.sql` |
| 4 | `database/admin-extended.sql` |
| 5 | `database/seed.sql` (ডেমো ডেটা, ঐচ্ছিক) |

---

## ২ব. `node_modules` মুছুন (অবশ্যই)

cPanel **লাল error** দেখালে:

> application should not contain folder/file named `node_modules` in application root

**File Manager** → `repositories/rakushopbd` → **`node_modules` ফোল্ডার Delete** করুন।

তারপর cPanel → **Run NPM Install** (symlink নিজে বানাবে)।

ZIP upload করলে `node_modules` সহ upload করবেন **না**।

---

## ৩. Node.js Application

| ফিল্ড | মান |
|--------|-----|
| Node.js | **20** (বা 18+) |
| Application mode | **Production** |
| Application root | `repositories/rakushopbd` |
| Application URL | `rakushopbd.com` |
| Startup file | `server.js` |

**Environment variables** (cPanel → ADD VARIABLE):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=আপনার_cpanel_mysql_user
DB_PASSWORD=আপনার_mysql_password
DB_NAME=আপনার_database_name
SESSION_SECRET=rakushopbd-local-dev-secret-8f3a9c2e1b7d4f6a
NODE_ENV=production
ADMIN_USERNAME=admin@rakushopbd.com
ADMIN_EMAIL=admin@rakushopbd.com
ADMIN_PASSWORD=BDRakuadmin2026%%
```

তারপর: **STOP** → **Run NPM Install** → **START** → **Restart**

---

## ৪. Admin password DB-তে সেট

Terminal (Node virtualenv activate করে):

```bash
cd ~/repositories/rakushopbd
source /home/USERNAME/nodevenv/repositories/rakushopbd/20/bin/activate
npm run admin:sync
```

অথবা phpMyAdmin → `database/insert-admin.sql` (password ভিন্ন হবে — `admin:sync` ভালো)

---

## ৫. public_html

`public_html/index.html` **মুছুন** বা rename (`index.html.old`) — নইলে default page দেখাবে।

---

## ৬. যাচাই (Git Pull হয়েছে কিনা)

| URL | প্রত্যাশিত | পুরনো server |
|-----|------------|---------------|
| `/api/admin/version` | `{"ok":true,"apiVersion":2}` | Page not found |
| `/api/admin/ping` | `{"ok":true,"adminCount":1,"apiVersion":2}` | Page not found |
| Login response | `"token":"..."` আছে | token নেই → Missing auth token |

**Login কাজ করে কিন্তু toast “Missing auth token”** = শুধু **backend** পুরনো (Git Pull হয়নি)। Frontend নতুন, server পুরনো।

---

## ৬ব. Admin login

| URL | প্রত্যাশিত |
|-----|------------|
| https://rakushopbd.com/admin | Login |

**Admin login:**

- Username: `admin@rakushopbd.com`
- Password: `BDRakuadmin2026%%`

Login → **F5 reload** → dashboard থাকা উচিত।

---

## ৭. পরের code update

```bash
cd ~/repositories/rakushopbd
git pull origin main
```

cPanel: **STOP** → **Run NPM Install** (শুধু package বদলালে) → **START**

---

## সমস্যা

| সমস্যা | সমাধান |
|--------|--------|
| `/api/admin/ping` Page not found | Git Pull + Restart |
| Server outdated toast | Git Pull + NPM Install + Restart |
| Reload → login page | নতুন code + `SESSION_SECRET` env |
| npm not found | Node app virtualenv activate |
