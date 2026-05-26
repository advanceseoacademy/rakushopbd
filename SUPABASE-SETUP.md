# RakuShopBD — Supabase Database Setup

Product images stay on **cPanel** (`public/uploads/`) — only data moves to Supabase.

---

## 1. Create Supabase project

1. https://supabase.com → New project  
2. Note **Database password**  
3. **Project Settings → Database → Connection string → URI** (mode: Transaction)  
   Example: `postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

---

## 2. Run SQL in Supabase (easiest)

1. Supabase → **SQL Editor** → New query  
2. Open `database/supabase-full.sql` from this repo (generate: `npm run db:build:supabase`)  
3. Paste all → **Run**

---

## 3. Environment variables

### Local Mac (`.env`)

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@[host]:6543/postgres
DB_SSL=true

SESSION_SECRET=your-secret-32-chars
ADMIN_USERNAME=admin@rakushopbd.com
ADMIN_EMAIL=admin@rakushopbd.com
ADMIN_PASSWORD=BDRakuadmin2026%%
```

Remove or comment out `DB_HOST`, `DB_USER`, `DB_NAME` when using Supabase.

### cPanel Node.js App

Add the same `DATABASE_URL` in Environment Variables → **SAVE** → **STOP** → **START**

Optional: keep `DB_DRIVER=postgres` explicit.

---

## 4. Commands

```bash
npm install
npm run db:build:supabase    # regenerate supabase-full.sql
npm run db:setup:supabase    # or use SQL Editor instead
npm run admin:sync
npm start
```

Test: http://localhost:3000/api/admin/ping → `"adminCount":1`

---

## 5. MySQL (old) vs Supabase

| | MySQL cPanel | Supabase |
|--|--------------|----------|
| Env | `DB_HOST`, `DB_USER`, … | `DATABASE_URL` |
| Force MySQL | `DB_DRIVER=mysql` | — |
| Force Postgres | — | `DATABASE_URL` set |

---

## 6. Images

- Upload in Admin → saved to `public/uploads/` on server  
- DB stores path: `/uploads/filename.jpg`  
- No change needed for Supabase

---

## 7. Git pull on cPanel

```bash
cd ~/repositories/rakushopbd
git pull origin main
```

Set `DATABASE_URL` in Node.js App env, restart app.
