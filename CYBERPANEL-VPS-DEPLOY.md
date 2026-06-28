# RakuShopBD — CyberPanel VPS Deploy (সম্পূর্ণ গাইড)

Database: **Supabase** (already setup)  
Images: **VPS folder** `public/uploads/`  
GitHub: https://github.com/advanceseoacademy/rakushopbd

---

## আগে যা লাগবে

- VPS + **CyberPanel** installed
- Domain `rakushopbd.com` → VPS IP (DNS A record)
- CyberPanel-এ website তৈরি (`rakushopbd.com`)
- SSH access (root বা sudo)

---

## ধাপ ১ — CyberPanel-এ website

1. CyberPanel → **Create Website**
2. Domain: `rakushopbd.com`
3. PHP: যেকোনো (Node আলাদা চলবে) — বা **Static** যদি থাকে
4. SSL: **Issue SSL** (Let's Encrypt)

---

## ধাপ ২ — SSH: কোড + Node

```bash
# CyberPanel site path (উদাহরণ)
mkdir -p /home/rakushopbd.com
cd /home/rakushopbd.com

git clone https://github.com/advanceseoacademy/rakushopbd.git rakushopbd
cd rakushopbd

# Node 20 (না থাকলে)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

npm install -g pm2
npm install
```

---

## ধাপ ৩ — `.env` ফাইল

```bash
nano /home/rakushopbd.com/rakushopbd/.env
```

`env-for-cpanel-supabase.txt` বা `env.vps.example.txt` এর মতো — **কিন্তু PORT বদলান:**

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://postgres.dymliuodmmmgvwjbonjn:RakuShopBd_Supabase_2026_Xk9@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://dymliuodmmmgvwjbonjn.supabase.co
SESSION_SECRET=your-long-secret
ADMIN_USERNAME=admin@rakushopbd.com
ADMIN_EMAIL=admin@rakushopbd.com
ADMIN_PASSWORD=BDRakuadmin2026%%
```

> CyberPanel-এ port **3000** অনেক সময় busy থাকে → **3001** ব্যবহার করুন।

---

## ধাপ ৪ — PM2 দিয়ে app চালু

```bash
cd /home/rakushopbd.com/rakushopbd
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# যে command দেখায় সেটা run করুন
```

টেস্ট (VPS-এ):

```bash
curl http://127.0.0.1:3001/api/db-check
# {"ok":true,"build":"supabase-v2","productCount":23}
```

---

## ধাপ ৫ — OpenLiteSpeed Reverse Proxy

CyberPanel → **Websites** → `rakushopbd.com` → **Manage** → **OpenLiteSpeed** / **vHost Conf**

### পদ্ধতি A — CyberPanel Rewrite (সহজ)

**Rewrite Rules** এ যোগ করুন:

```apache
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
```

### পদ্ধতি B — OpenLiteSpeed WebAdmin (7090)

1. `https://YOUR_VPS_IP:7090` → Login
2. **Virtual Hosts** → `rakushopbd.com`
3. **External App** → Add:
   - Name: `nodejs`
   - Address: `127.0.0.1:3001`
   - Type: Proxy
4. **Context** → Add:
   - URI: `/`
   - Type: Proxy
   - Handler: `nodejs`
5. **Graceful Restart**

বিস্তারিত: [OpenLiteSpeed Reverse Proxy](https://docs.openlitespeed.org/config/reverseproxy/)

### পদ্ধতি C — NodeCyber (automatic)

```bash
# optional tool
sudo npm install -g nodecyber
sudo nodecyber install rakushopbd.com /home/rakushopbd.com/rakushopbd "pm2 start ecosystem.config.cjs"
```

---

## ধাপ ৬ — public_html conflict এড়ান

`public_html/index.html` থাকলে Node-এর আগে static page দেখাতে পারে।

```bash
rm -f /home/rakushopbd.com/public_html/index.html
# অথবা public_html খালি রাখুন — সব traffic proxy → 3001
```

---

## ধাপ ৭ — uploads folder

```bash
mkdir -p /home/rakushopbd.com/rakushopbd/public/uploads
chmod 755 /home/rakushopbd.com/rakushopbd/public/uploads
```

Admin থেকে upload করা image এখানে যাবে।

---

## ধাপ ৮ — টেস্ট

| URL | কী দেখবেন |
|-----|-----------|
| https://rakushopbd.com/api/db-check | ok:true, productCount:23 |
| https://rakushopbd.com/ | products load |
| https://rakushopbd.com/admin | login |

---

## ধাপ ৯ — Redis cache (optional, recommended on VPS)

Shared cache — bootstrap, SEO, product lists faster across PM2 restarts.

**VPS-এ (root SSH):**

```bash
cd /home/rakushopbd.com/rakushopbd
bash scripts/setup-redis-vps.sh
```

অথবা one-liner:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/advanceseoacademy/rakushopbd/main/scripts/setup-redis-vps.sh)"
```

`.env`-এ যোগ হবে:

```env
REDIS_URL=redis://127.0.0.1:6379
REDIS_KEY_PREFIX=rakushopbd:
```

Verify:

```bash
curl -s http://127.0.0.1:3001/api/health
# {"ok":true,"cache":"redis","redis":true}
```

Local test: `npm run redis:check`

---

## আপডেট (git pull)

```bash
cd /home/rakushopbd.com/rakushopbd
git pull origin main
npm install
pm2 restart rakushopbd
```

---

## সমস্যা

| সমস্যা | সমাধান |
|--------|--------|
| 503 / blank | `pm2 logs rakushopbd` |
| Database error | `.env` এ `DATABASE_URL` চেক |
| Port busy | `PORT=3001` in .env |
| Static page only | Rewrite proxy + delete public_html/index.html |
| SSL error | CyberPanel → Issue SSL again |

```bash
pm2 status
pm2 logs rakushopbd --lines 50
```

---

## cPanel থেকে VPS-এ স্থানান্তর

| cPanel | CyberPanel VPS |
|--------|----------------|
| Setup Node.js App | PM2 + ecosystem.config.cjs |
| cPanel env UI | `.env` file |
| MySQL | Supabase (same DATABASE_URL) |
| git pull | same repo |

Shared hosting ছাড়িয়ে VPS-এ **full control** — Supabase + PM2 সহজ।
