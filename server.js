require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { renderMaintenanceIfNeeded } = require('./lib/maintenanceGate');

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
const sessionCookie = {
  maxAge: sessionMaxAge,
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  // cPanel: default off. Set COOKIE_SECURE=true only when HTTPS + proxy is confirmed working.
  secure: process.env.COOKIE_SECURE === 'true',
};

let sessionStore;
if (process.env.DB_USER && process.env.DB_NAME) {
  sessionStore = new MySQLStore(
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      clearExpired: true,
      checkExpirationInterval: 900000,
      expiration: sessionMaxAge,
      createDatabaseTable: true,
      schema: { tableName: 'sessions' },
    },
    null,
    (err) => {
      if (err) console.error('Session store error:', err.message);
      else console.log('MySQL session store ready');
    }
  );
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'rakushopbd-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: sessionCookie,
  })
);

app.use(renderMaintenanceIfNeeded);

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
  console.log(`RakuShopBD running — http://localhost:${PORT}`);
});
