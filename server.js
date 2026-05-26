require('dotenv').config();
// cPanel: .env file may still list old MySQL — Supabase must win
if (process.env.DATABASE_URL) {
  delete process.env.DB_HOST;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DB_DRIVER;
}

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { renderMaintenanceIfNeeded } = require('./lib/maintenanceGate');
const { registerAdminAuth } = require('./lib/registerAdminAuth');
const { usePostgres } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// cPanel / reverse proxy: HTTPS terminates in front of Node
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMaxAge = 7 * 24 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET || 'rakushopbd-dev-secret-change-me';

// Signed cookie session — survives page reload & cPanel multi-worker (no shared memory/DB store)
app.use(
  cookieSession({
    name: 'rakushopbd.sid',
    keys: [sessionSecret],
    maxAge: sessionMaxAge,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.COOKIE_SECURE === 'true',
  })
);

app.use(renderMaintenanceIfNeeded);

// Admin auth on app (live cPanel: always reachable after restart)
registerAdminAuth(app);

/** Live diagnostic (works after git pull + restart) */
app.get('/api/db-check', async (req, res) => {
  const { getPool, usePostgres, query } = require('./config/db');
  const info = {
    ok: false,
    build: 'supabase-v2',
    usePostgres: usePostgres(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    nodeEnv: process.env.NODE_ENV || null,
  };
  try {
    require.resolve('pg');
    info.hasPgModule = true;
  } catch {
    info.hasPgModule = false;
    info.hint = 'cPanel → Run NPM Install (pg package missing)';
  }
  try {
    await getPool().query('SELECT 1');
    info.connected = true;
    const [row] = await query('SELECT COUNT(*) AS adminCount FROM admins');
    const [prow] = await query('SELECT COUNT(*) AS productCount FROM products');
    info.adminCount = Number(row.adminCount ?? row.admincount) || 0;
    info.productCount = Number(prow.productCount ?? prow.productcount) || 0;
    info.ok = true;
    res.json(info);
  } catch (err) {
    info.connected = false;
    info.errorCode = err.code || 'UNKNOWN';
    info.errorMessage = err.message;
    info.hint =
      err.code === 'MODULE_NOT_FOUND'
        ? 'Run NPM Install on cPanel'
        : 'Check DATABASE_URL password matches Supabase; then STOP → START';
    res.status(503).json(info);
  }
});

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Storefront SPA — clean URLs (no hash)
app.get(
  ['/account', '/cart', '/checkout', '/wishlist', '/success'],
  (req, res) => res.render('index')
);
app.get('/product/:id', (req, res) => res.render('index'));
app.get('/category/:slug', (req, res) => res.render('index'));

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
    if (!path.extname(req.path)) {
      return res.render('index');
    }
  }
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  const db = usePostgres() ? 'Supabase (PostgreSQL)' : 'MySQL';
  console.log(`RakuShopBD running — http://localhost:${PORT} [${db}]`);
});
