require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { renderMaintenanceIfNeeded } = require('./lib/maintenanceGate');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// cPanel / reverse proxy: HTTPS terminates in front of Node — needed for secure session cookies
if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'rakushopbd-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      // Set COOKIE_SECURE=false in cPanel env only if you must test over plain HTTP
      secure: isProduction && process.env.COOKIE_SECURE !== 'false',
    },
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
