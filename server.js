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
const compression = require('compression');
const express = require('express');
const cookieSession = require('cookie-session');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { renderMaintenanceIfNeeded } = require('./lib/maintenanceGate');
const { getStoreBootstrap, getProductById } = require('./lib/storeBootstrap');
const { registerAdminAuth } = require('./lib/registerAdminAuth');
const { usePostgres } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// cPanel / reverse proxy: HTTPS terminates in front of Node
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, 'public');
const staticCache = (maxAge) => ({
  maxAge: isProduction ? maxAge : 0,
  etag: true,
  immutable: Boolean(isProduction && maxAge),
});
app.use('/js', express.static(path.join(publicDir, 'js'), staticCache('365d')));
app.use('/css', express.static(path.join(publicDir, 'css'), staticCache('365d')));
app.use('/images', express.static(path.join(publicDir, 'images'), staticCache('30d')));
app.use('/uploads', express.static(path.join(publicDir, 'uploads'), staticCache('7d')));
app.use(express.static(publicDir, staticCache(0)));

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

async function renderStorefront(req, res) {
  try {
    const productMatch = req.path.match(/^\/product\/(\d+)$/);
    const productId = productMatch ? productMatch[1] : null;
    const [bootstrap, product] = await Promise.all([
      getStoreBootstrap(),
      productId ? getProductById(productId) : null,
    ]);
    const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');
    const productJson = product
      ? JSON.stringify({ ok: true, product }).replace(/</g, '\\u003c')
      : null;
    res.render('index', { bootstrapJson, productJson });
  } catch (err) {
    console.error('renderStorefront', err);
    res.render('index', { bootstrapJson: null, productJson: null });
  }
}

app.get('/', (req, res) => renderStorefront(req, res));

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Storefront SPA — clean URLs (no hash)
app.get(
  ['/account', '/cart', '/checkout', '/wishlist', '/success'],
  (req, res) => renderStorefront(req, res)
);
app.get('/product/:id', (req, res) => renderStorefront(req, res));
app.get('/category/:slug', (req, res) => renderStorefront(req, res));

app.use((req, res) => {
  // API 404 stays JSON/plain
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  // Admin 404
  if (req.path.startsWith('/admin')) {
    return res.status(404).send('Page not found');
  }

  // Website 404 (cute page)
  if (req.method === 'GET') {
    // For clean URLs we do NOT render the SPA shell anymore—unknown paths should be 404
    return res.status(404).render('404', { pathName: req.originalUrl || req.path });
  }

  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  const db = usePostgres() ? 'Supabase (PostgreSQL)' : 'MySQL';
  console.log(`RakuShopBD running — http://localhost:${PORT} [${db}]`);
});
