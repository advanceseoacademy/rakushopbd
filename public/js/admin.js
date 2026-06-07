(function () {
  const API = '/api/admin';
  const ADMIN_TOKEN_KEY = 'rakushopbd_admin_token';
  const ADMIN_USER_KEY = 'rakushopbd_admin_user';
  const ADMIN_PAGE_KEY = 'rakushopbd_admin_active_page';

  function getAdminToken() {
    try {
      return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function setAdminToken(token) {
    try {
      if (token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
        sessionStorage.removeItem(ADMIN_USER_KEY);
      }
    } catch (_) {}
  }

  function cacheAdminUser(admin) {
    try {
      const json = JSON.stringify(admin);
      localStorage.setItem(ADMIN_USER_KEY, json);
      sessionStorage.setItem(ADMIN_USER_KEY, json);
    } catch (_) {}
  }

  function getCachedAdminUser() {
    try {
      const raw = localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function authHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = getAdminToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Admin-Token'] = token;
    }
    return headers;
  }

  let currentAdmin = null;
  let categories = [];
  let coupons = [];
  let banners = [];
  let faqs = [];
  let currentOrderId = null;

  let ordersPage = 1;
  let appointmentsPage = 1;
  let contactsPage = 1;
  let subscribersPage = 1;
  let productsPage = 1;
  let authRedirectHold = false;

  const pageTitles = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    appointments: 'Appointments',
    contacts: 'Contact Messages',
    products: 'Products',
    'product-form': 'Add Product',
    customers: 'Customers',
    analytics: 'Analytics',
    categories: 'Categories',
    faq: 'FAQ',
    coupons: 'Coupons',
    reviews: 'Reviews',
    banners: 'Banners',
    marketing: 'Marketing',
    settings: 'Settings',
  };
  const validPages = new Set(Object.keys(pageTitles));

  function getSavedPage() {
    try {
      const page = localStorage.getItem(ADMIN_PAGE_KEY) || sessionStorage.getItem(ADMIN_PAGE_KEY);
      return validPages.has(page) ? page : 'dashboard';
    } catch (_) {
      return 'dashboard';
    }
  }

  function saveActivePage(page) {
    if (!validPages.has(page) && page !== 'product-form') return;
    const toSave = page === 'product-form' ? 'products' : page;
    if (!validPages.has(toSave)) return;
    try {
      localStorage.setItem(ADMIN_PAGE_KEY, toSave);
      sessionStorage.setItem(ADMIN_PAGE_KEY, toSave);
    } catch (_) {}
  }

  async function api(url, options = {}) {
    const res = await fetch(API + url, {
      headers: url.includes('/login')
        ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
        : authHeaders(options.headers || {}),
      credentials: 'same-origin',
      ...options,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { ok: false, error: 'Invalid server response' };
    }
    if (res.status === 401 && !authRedirectHold && !url.includes('/login') && !url.includes('/me')) {
      logoutAdmin();
    }
    return data;
  }

  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    const tone = type === 'error' ? 'error' : type === 'info' ? 'info' : 'success';
    const icon = tone === 'error' ? '✖' : tone === 'info' ? 'ℹ' : '✓';
    const bg =
      tone === 'error'
        ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
        : tone === 'info'
          ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
          : 'linear-gradient(135deg,#15803d,#166534)';
    el.style.background = bg;
    el.style.boxShadow = '0 12px 28px rgba(15,23,42,.25)';
    el.textContent = `${icon} ${msg}`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function statusBadgeHtml(status) {
    const labels = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
    const cls = { pending: 'amber', confirmed: 'blue', shipped: 'blue', delivered: 'green', cancelled: 'red' };
    return `<span class="badge badge-${cls[status] || 'gray'}">${labels[status] || status}</span>`;
  }

  function setOrderBadge(count) {
    const badge = document.getElementById('order-badge');
    if (badge) badge.textContent = String(Number(count) || 0);
  }

  function showLoginPanel() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('admin-page').style.display = 'none';
  }

  function logoutAdmin() {
    setAdminToken('');
    showLoginPanel();
  }

  function showAdmin() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('admin-page').style.display = 'block';
  }

  function setAdminUI(admin) {
    currentAdmin = admin;
    const initial = (admin.fullName || admin.username || 'A')[0].toUpperCase();
    ['sidebar-avatar', 'topbar-avatar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = initial;
    });
    const name = document.getElementById('sidebar-name');
    const email = document.getElementById('sidebar-email');
    if (name) name.textContent = admin.fullName || admin.username;
    if (email) email.textContent = admin.email;
  }

  function switchPage(page) {
    if (!validPages.has(page)) page = 'dashboard';
    document.querySelectorAll('.adm-section').forEach((s) => s.classList.remove('active'));
    const sec = document.getElementById('sec-' + page);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.nav-item').forEach((n) => {
      const navPage = n.dataset.page;
      n.classList.toggle('active', navPage === page || (page === 'product-form' && navPage === 'products'));
    });
    const title = pageTitles[page] || page;
    document.getElementById('page-title').textContent = title;
    document.getElementById('breadcrumb-current').textContent = title;
    window.scrollTo(0, 0);
    if (page !== 'product-form') saveActivePage(page);

    if (page === 'dashboard') loadDashboard();
    if (page === 'orders') loadOrders();
    if (page === 'appointments') loadAppointments();
    if (page === 'contacts') loadContactMessages();
    if (page === 'products') loadProducts();
    if (page === 'customers') loadCustomers();
    if (page === 'categories') loadCategories();
    if (page === 'faq') loadFaqs();
    if (page === 'coupons') loadCoupons();
    if (page === 'settings') loadSettings();
    if (page === 'analytics') loadAnalytics();
    if (page === 'reviews') loadReviews();
    if (page === 'banners') loadBanners();
    if (page === 'marketing') loadMarketing();
  }

  window.adminSwitchPage = switchPage;

  async function restoreSession() {
    const token = getAdminToken();
    if (!token) return false;

    const me = await api('/me');
    if (me.ok && me.admin) {
      cacheAdminUser(me.admin);
      setAdminUI(me.admin);
      showAdmin();
      switchPage(getSavedPage());
      return true;
    }

    const dash = await api('/dashboard');
    if (dash.ok) {
      const cached = getCachedAdminUser();
      if (cached) setAdminUI(cached);
      showAdmin();
      switchPage(getSavedPage());
      return true;
    }

    return false;
  }

  async function init() {
    if (await restoreSession()) return;
    if (getAdminToken()) {
      setAdminToken('');
      toast('Session expired — please sign in again', 'info');
    }
    showLoginPanel();
  }

  // ——— Login ———
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('login-error');
    err.style.display = 'none';
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('inp-user').value.trim(),
        password: document.getElementById('inp-pass').value,
      }),
    });
    if (data.ok && data.admin) {
      if (data.token) {
        setAdminToken(data.token);
      } else {
          toast('Reload-এ login থাকতে: cPanel git pull + STOP → START (১ মিনিট)', 'info');
      }
      cacheAdminUser(data.admin);
      authRedirectHold = true;
      setAdminUI(data.admin);
      showAdmin();
      switchPage('dashboard');
      setTimeout(() => {
        authRedirectHold = false;
      }, 8000);
    } else {
      const msg = err.querySelector('span') || err;
      if (msg.tagName === 'SPAN') msg.textContent = data.error || 'Invalid username or password';
      else err.lastChild.textContent = ' ' + (data.error || 'Invalid username or password');
      err.style.display = 'flex';
    }
  });

  document.getElementById('toggle-pass').onclick = () => {
    const inp = document.getElementById('inp-pass');
    const eye = document.getElementById('pass-eye');
    if (inp.type === 'password') {
      inp.type = 'text';
      eye.className = 'ti ti-eye-off';
    } else {
      inp.type = 'password';
      eye.className = 'ti ti-eye';
    }
  };

  document.getElementById('logout-btn').onclick = async () => {
    await api('/logout', { method: 'POST' });
    logoutAdmin();
  };

  document.getElementById('view-site-btn').onclick = () => window.open('/', '_blank');

  function setProductFormTitle(label) {
    const h2 = document.getElementById('product-form-title');
    const top = document.getElementById('page-title');
    const bc = document.getElementById('breadcrumb-current');
    if (h2) h2.textContent = label;
    if (top) top.textContent = label;
    if (bc) bc.textContent = label;
    pageTitles['product-form'] = label;
  }

  async function openProductForm(product) {
    await loadCategoriesList();
    if (product) {
      const detail = await api('/products/' + product.id);
      if (detail.ok && detail.product) product = detail.product;
      setProductFormTitle('Edit Product');
      document.getElementById('pf-id').value = product.id;
      document.getElementById('pf-name').value = product.name_bn;
      const pfSlug = document.getElementById('pf-slug');
      if (pfSlug) pfSlug.value = product.slug || '';
      document.getElementById('pf-category').value = product.category_id;
      document.getElementById('pf-price').value = product.price;
      document.getElementById('pf-old-price').value = product.old_price || '';
      document.getElementById('pf-stock').value = product.stock;
      document.getElementById('pf-sku').value = product.sku || '';
      document.getElementById('pf-desc').value = product.description_bn || '';
      const pfShort = document.getElementById('pf-short-desc');
      if (pfShort) pfShort.value = product.short_description || '';
      const gallery = product.gallery_urls?.length
        ? product.gallery_urls
        : product.image_url
          ? [product.image_url]
          : [];
      resetPfGallery(gallery);
      document.getElementById('pf-icon').value = product.icon;
      document.getElementById('pf-icon-color').value = product.icon_color;
      document.getElementById('pf-bg').value = product.bg_color;
      document.getElementById('pf-tag').value = product.tag_type;
      document.getElementById('pf-featured').checked = !!product.is_featured;
      document.getElementById('pf-seo-title').value = product.seo_title || '';
      document.getElementById('pf-seo-desc').value = product.seo_description || '';
      document.getElementById('pf-seo-keywords').value = product.seo_keywords || '';
      document.getElementById('pf-image-alt').value = product.image_alt || '';
      document.getElementById('pf-og-image').value = product.og_image || '';
    } else {
      resetProductForm();
      setProductFormTitle('Add Product');
    }
    switchPage('product-form');
    setTimeout(() => document.getElementById('pf-name')?.focus(), 50);
  }

  function closeProductForm() {
    switchPage('products');
  }

  const addProductBtn = document.getElementById('add-product-btn');
  if (addProductBtn) {
    addProductBtn.onclick = () => openProductForm();
  }

  document.getElementById('product-form-back')?.addEventListener('click', closeProductForm);
  document.getElementById('product-form-cancel')?.addEventListener('click', closeProductForm);

  function openCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('category-modal-open');
    setTimeout(() => document.getElementById('cf-name')?.focus(), 50);
  }

  function closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('category-modal-open');
  }

  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) {
    addCategoryBtn.onclick = () => {
      switchPage('categories');
      resetCategoryForm();
      openCategoryModal();
    };
  }

  document.getElementById('category-modal-close')?.addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-cancel')?.addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'category-modal') closeCategoryModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('category-modal')?.classList.contains('open')) {
      closeCategoryModal();
    }
    if (e.key === 'Escape' && document.getElementById('coupon-modal')?.classList.contains('open')) {
      closeCouponModal();
    }
    if (e.key === 'Escape' && document.getElementById('banner-modal')?.classList.contains('open')) {
      closeBannerModal();
    }
  });

  function openBannerModal() {
    const modal = document.getElementById('banner-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('banner-modal-open');
    setTimeout(() => document.getElementById('bn-title')?.focus(), 50);
  }

  function closeBannerModal() {
    const modal = document.getElementById('banner-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('banner-modal-open');
  }

  const addBannerBtn = document.getElementById('add-banner-btn');
  if (addBannerBtn) {
    addBannerBtn.onclick = () => {
      switchPage('banners');
      resetBannerForm();
      openBannerModal();
    };
  }

  document.getElementById('banner-modal-close')?.addEventListener('click', closeBannerModal);
  document.getElementById('banner-modal-cancel')?.addEventListener('click', closeBannerModal);
  document.getElementById('banner-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'banner-modal') closeBannerModal();
  });

  function openCouponModal() {
    const modal = document.getElementById('coupon-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('coupon-modal-open');
    setTimeout(() => document.getElementById('cp-code')?.focus(), 50);
  }

  function closeCouponModal() {
    const modal = document.getElementById('coupon-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('coupon-modal-open');
  }

  const addCouponBtn = document.getElementById('add-coupon-btn');
  if (addCouponBtn) {
    addCouponBtn.onclick = () => {
      switchPage('coupons');
      resetCouponForm();
      openCouponModal();
    };
  }

  document.getElementById('coupon-modal-close')?.addEventListener('click', closeCouponModal);
  document.getElementById('coupon-modal-cancel')?.addEventListener('click', closeCouponModal);
  document.getElementById('coupon-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'coupon-modal') closeCouponModal();
  });

  function closeAdminSidebar() {
    document.body.classList.remove('adm-sidebar-open');
    const overlay = document.getElementById('adm-sidebar-overlay');
    const btn = document.getElementById('adm-menu-btn');
    if (overlay) overlay.classList.remove('visible');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openAdminSidebar() {
    document.body.classList.add('adm-sidebar-open');
    const overlay = document.getElementById('adm-sidebar-overlay');
    const btn = document.getElementById('adm-menu-btn');
    if (overlay) overlay.classList.add('visible');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  const admMenuBtn = document.getElementById('adm-menu-btn');
  const admOverlay = document.getElementById('adm-sidebar-overlay');
  if (admMenuBtn) {
    admMenuBtn.onclick = () => {
      if (document.body.classList.contains('adm-sidebar-open')) closeAdminSidebar();
      else openAdminSidebar();
    };
  }
  if (admOverlay) admOverlay.onclick = closeAdminSidebar;
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeAdminSidebar();
  });

  document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
    el.onclick = () => {
      switchPage(el.dataset.page);
      if (window.innerWidth <= 900) closeAdminSidebar();
    };
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.onclick = () => switchPage(el.dataset.goto);
  });

  // ——— Dashboard ———
  async function loadDashboard() {
    const data = await api('/dashboard');
    if (!data.ok) {
      toast(data.error || 'Could not load dashboard data', 'error');
      return;
    }

    const s = data.stats;
    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon" style="background:#e8f5e8;"><i class="ti ti-currency-taka" style="color:#2d8a2d;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.monthRevenueFormatted}</div><div class="stat-label">Revenue (this month)</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="ti ti-shopping-bag" style="color:#1D9E75;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.pendingOrders}</div><div class="stat-label">Orders in progress</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="ti ti-users" style="color:#EF9F27;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.totalCustomers}</div><div class="stat-label">Registered customers</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fee2e2;"><i class="ti ti-box" style="color:#d48696;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.totalProducts}</div><div class="stat-label">Products (${s.lowStock} low stock)</div></div></div>`;

    setOrderBadge(s.totalOrders);
    api('/appointments?limit=1&page=1').then((d) => {
      if (d.ok && d.pendingCount != null) setAppointmentBadge(d.pendingCount);
    });
    api('/contact-messages?limit=1&page=1').then((d) => {
      if (d.ok && d.newCount != null) setContactBadge(d.newCount);
    });
    api('/phone-subscribers?limit=1&page=1').then((d) => {
      if (d.ok && d.newCount != null) setSubscriberBadge(d.newCount);
    });

    document.getElementById('dash-orders-tbody').innerHTML = data.recentOrders
      .map(
        (o) => `<tr>
        <td><b>${o.orderNumber}</b></td><td>${o.customerName}</td><td>${o.itemsPreview}</td>
        <td>${o.totalFormatted}</td><td>${statusBadgeHtml(o.status)}</td></tr>`
      )
      .join('');

    drawCharts(data);

    const actEl = document.getElementById('dash-activity');
    if (actEl) {
      const icons = { order: 'ti-shopping-bag', user: 'ti-user-plus', alert: 'ti-alert-triangle', review: 'ti-star', contact: 'ti-mail' };
      const colors = { order: '#e8f5e8', user: '#dcfce7', alert: '#fee2e2', review: '#fef3c7', contact: '#dbeafe' };
      const acts = data.activity || [];
      actEl.innerHTML = acts.length
        ? acts
            .map(
              (a) => `<div class="activity-item"><div class="act-icon" style="background:${colors[a.type] || '#f1f5f9'};"><i class="ti ${icons[a.type] || 'ti-bell'}" style="color:#64748b;"></i></div><div><div class="act-text">${a.text}</div><div class="act-time">${timeAgo(a.time)}</div></div></div>`
            )
            .join('')
        : '<p style="color:#94a3b8;font-size:13px;">No recent activity</p>';
    }
  }

  function timeAgo(d) {
    const diff = (Date.now() - new Date(d)) / 1000;
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    return fmtDate(d);
  }

  function drawCharts(data) {
    drawRevenueChart(data.monthlyRevenue || []);
    drawDonutChart(data.statusBreakdown || []);
  }

  function drawRevenueChart(monthly) {
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const values = new Array(12).fill(0);
    monthly.forEach((r) => {
      values[r.month - 1] = Math.round(Number(r.revenue) / 1000);
    });
    const W = canvas.offsetWidth || 600;
    canvas.width = W;
    const H = 220;
    canvas.height = H;
    const pad = { t: 20, r: 16, b: 38, l: 54 };
    const max = Math.max(...values, 1) * 1.15;
    ctx.clearRect(0, 0, W, H);
    const bw = (W - pad.l - pad.r) / 12;
    values.forEach((val, i) => {
      const bh = (H - pad.t - pad.b) * (val / max);
      const x = pad.l + i * bw + bw * 0.18;
      const y = H - pad.b - bh;
      const w = bw * 0.64;
      const grad = ctx.createLinearGradient(0, y, 0, H - pad.b);
      grad.addColorStop(0, '#2d8a2d');
      grad.addColorStop(1, '#93c5fd');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, bh);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(months[i], x + w / 2, H - pad.b + 14);
    });
  }

  function drawDonutChart(breakdown) {
    const canvas = document.getElementById('donut-chart');
    if (!canvas) return;
    const colors = { delivered: '#2d8a2d', pending: '#EF9F27', confirmed: '#64748b', shipped: '#1D9E75', cancelled: '#d48696' };
    const slices = breakdown.map((b) => ({ val: b.cnt, color: colors[b.status] || '#94a3b8', label: b.status }));
    const total = slices.reduce((a, s) => a + s.val, 0) || 1;
    const dc = canvas.getContext('2d');
    const W = canvas.width,
      H = canvas.height;
    const cx = W / 2,
      cy = H / 2,
      r = 62,
      inner = 38;
    let angle = -Math.PI / 2;
    dc.clearRect(0, 0, W, H);
    slices.forEach((s) => {
      const sweep = (s.val / total) * 2 * Math.PI;
      dc.beginPath();
      dc.moveTo(cx, cy);
      dc.arc(cx, cy, r, angle, angle + sweep);
      dc.closePath();
      dc.fillStyle = s.color;
      dc.fill();
      angle += sweep;
    });
    dc.beginPath();
    dc.arc(cx, cy, inner, 0, 2 * Math.PI);
    dc.fillStyle = '#fff';
    dc.fill();
    dc.fillStyle = '#0f172a';
    dc.font = 'bold 13px sans-serif';
    dc.textAlign = 'center';
    dc.fillText(String(total), cx, cy + 4);

    const legend = document.getElementById('donut-legend');
    if (legend) {
      legend.innerHTML = slices
        .map(
          (s) =>
            `<div class="legend-row"><div class="legend-left"><div class="legend-dot" style="background:${s.color}"></div>${s.label}</div><span style="font-weight:700;">${Math.round((s.val / total) * 100)}%</span></div>`
        )
        .join('');
    }
  }

  // ——— Orders ———
  async function loadOrders(page) {
    if (page) ordersPage = page;
    const status = document.getElementById('orders-status-filter').value;
    const payment = document.getElementById('orders-payment-filter')?.value || 'all';
    const search = document.getElementById('orders-search').value.trim();
    const q = new URLSearchParams({ page: ordersPage, limit: 20 });
    if (status !== 'all') q.set('status', status);
    if (payment !== 'all') q.set('payment', payment);
    if (search) q.set('search', search);
    const data = await api('/orders?' + q.toString());
    if (!data.ok) return;
    if (data.totalOrders != null) setOrderBadge(data.totalOrders);
    document.getElementById('orders-tbody').innerHTML = data.orders
      .map(
        (o) => `<tr>
        <td><b>${o.orderNumber}</b></td><td>${o.customerName}<br><small style="color:#94a3b8">${o.customerPhone}</small></td>
        <td>${o.itemsPreview}</td><td>${o.paymentMethod}</td><td>${fmtDate(o.createdAt)}</td>
        <td>${o.totalFormatted}</td><td>${statusBadgeHtml(o.status)}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-order-id="${o.id}">Details</button></td></tr>`
      )
      .join('');
    document.querySelectorAll('[data-order-id]').forEach((btn) => {
      btn.onclick = () => openOrderModal(btn.dataset.orderId);
    });

    const pag = data.pagination;
    const pagEl = document.getElementById('orders-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} orders)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-op="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-op="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-op]').forEach((b) => {
        b.onclick = () => loadOrders(ordersPage + Number(b.dataset.op));
      });
    }
  }

  document.getElementById('orders-status-filter').onchange = () => loadOrders(1);
  document.getElementById('orders-payment-filter')?.addEventListener('change', () => loadOrders(1));
  document.getElementById('orders-search').oninput = debounce(() => loadOrders(1), 400);

  function setAppointmentBadge(n) {
    const el = document.getElementById('appointment-badge');
    if (!el) return;
    const c = Number(n) || 0;
    el.textContent = c > 99 ? '99+' : String(c);
    el.style.display = c > 0 ? '' : 'none';
  }

  function setContactBadge(n) {
    const el = document.getElementById('contact-badge');
    if (!el) return;
    const c = Number(n) || 0;
    el.textContent = c > 99 ? '99+' : String(c);
    el.style.display = c > 0 ? '' : 'none';
  }

  function setSubscriberBadge(n) {
    const el = document.getElementById('subscriber-badge');
    if (!el) return;
    const c = Number(n) || 0;
    el.textContent = c > 99 ? '99+' : String(c);
    el.style.display = c > 0 ? '' : 'none';
  }

  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function contactStatusBadge(status) {
    const labels = { new: 'New', read: 'Read', replied: 'Replied', archived: 'Archived' };
    const cls = { new: 'amber', read: 'blue', replied: 'green', archived: 'gray' };
    return `<span class="badge badge-${cls[status] || 'gray'}">${labels[status] || escHtml(status)}</span>`;
  }

  async function loadAppointments(page) {
    if (page) appointmentsPage = page;
    const status = document.getElementById('appointments-status-filter')?.value || 'all';
    const search = document.getElementById('appointments-search')?.value.trim() || '';
    const q = new URLSearchParams({ page: appointmentsPage, limit: 20 });
    if (status !== 'all') q.set('status', status);
    if (search) q.set('search', search);
    const data = await api('/appointments?' + q.toString());
    if (!data.ok) return;
    if (data.pendingCount != null) setAppointmentBadge(data.pendingCount);
    const tbody = document.getElementById('appointments-tbody');
    if (!tbody) return;
    tbody.innerHTML = (data.appointments || [])
      .map(
        (a) => {
          const notesRaw = String(a.notes || '').trim();
          const notesHtml = notesRaw
            ? `<span title="${escHtml(notesRaw)}">${escHtml(notesRaw.length > 100 ? notesRaw.slice(0, 100) + '…' : notesRaw)}</span>`
            : '<span style="color:#94a3b8">—</span>';
          return `<tr>
        <td><b>${a.referenceNumber}</b><br><small style="color:#94a3b8">${fmtDate(a.createdAt)}</small></td>
        <td>${escHtml(a.customerName)}<br><small style="color:#94a3b8">${escHtml(a.customerPhone)}</small>${a.customerEmail ? `<br><small style="color:#94a3b8">${escHtml(a.customerEmail)}</small>` : ''}</td>
        <td>${escHtml(a.serviceLabel || a.serviceType)}</td>
        <td>${a.appointmentDate}<br><small>${escHtml(a.appointmentTime)}</small></td>
        <td style="max-width:220px;white-space:normal;line-height:1.45;">${notesHtml}</td>
        <td>${statusBadgeHtml(a.status)}</td>
        <td>
          <select class="tbl-select" style="min-width:110px" data-appt-status="${a.id}">
            <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="confirmed" ${a.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td></tr>`;
        }
      )
      .join('');

    tbody.querySelectorAll('[data-appt-status]').forEach((sel) => {
      sel.onchange = async () => {
        const id = sel.dataset.apptStatus;
        const res = await api('/appointments/' + id, {
          method: 'PATCH',
          body: JSON.stringify({ status: sel.value }),
        });
        if (res.ok) {
          toast('Appointment updated');
          loadAppointments();
        } else toast(res.error || 'Update failed', true);
      };
    });

    const pag = data.pagination;
    const pagEl = document.getElementById('appointments-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} appointments)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-ap="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-ap="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-ap]').forEach((b) => {
        b.onclick = () => loadAppointments(appointmentsPage + Number(b.dataset.ap));
      });
    }
  }

  document.getElementById('appointments-status-filter')?.addEventListener('change', () => loadAppointments(1));
  document.getElementById('appointments-search')?.addEventListener('input', debounce(() => loadAppointments(1), 400));

  async function loadContactMessages(page) {
    if (page) contactsPage = page;
    const status = document.getElementById('contacts-status-filter')?.value || 'all';
    const search = document.getElementById('contacts-search')?.value.trim() || '';
    const q = new URLSearchParams({ page: contactsPage, limit: 20 });
    if (status !== 'all') q.set('status', status);
    if (search) q.set('search', search);
    const data = await api('/contact-messages?' + q.toString());
    if (!data.ok) return;
    if (data.newCount != null) setContactBadge(data.newCount);
    const tbody = document.getElementById('contacts-tbody');
    if (!tbody) return;

    if (!data.messages?.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">No contact messages yet.</td></tr>';
    } else {
      tbody.innerHTML = data.messages
        .map((m) => {
          const preview = escHtml(String(m.message || '').slice(0, 120));
          const full = escHtml(m.message || '');
          const emailLine = m.customerEmail
            ? `<br><small style="color:#94a3b8">${escHtml(m.customerEmail)}</small>`
            : '';
          return `<tr>
        <td><b>${escHtml(m.customerName)}</b><br><small style="color:#94a3b8">${escHtml(m.customerPhone)}</small>${emailLine}</td>
        <td>${escHtml(m.subjectLabel || m.subject)}</td>
        <td><span title="${full}">${preview}${String(m.message || '').length > 120 ? '…' : ''}</span></td>
        <td>${fmtDate(m.createdAt)}</td>
        <td>${contactStatusBadge(m.status)}</td></tr>`;
        })
        .join('');
    }

    const pag = data.pagination;
    const pagEl = document.getElementById('contacts-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} messages)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-cp="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-cp="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-cp]').forEach((b) => {
        b.onclick = () => loadContactMessages(contactsPage + Number(b.dataset.cp));
      });
    }
  }

  document.getElementById('contacts-status-filter')?.addEventListener('change', () => loadContactMessages(1));
  document.getElementById('contacts-search')?.addEventListener('input', debounce(() => loadContactMessages(1), 400));

  function subscriberStatusBadge(status) {
    const map = {
      new: ['badge-amber', 'New'],
      read: ['badge-blue', 'Read'],
      archived: ['badge-gray', 'Archived'],
    };
    const [cls, lbl] = map[status] || ['badge-gray', status];
    return `<span class="badge ${cls}">${lbl}</span>`;
  }

  function setMktImagePreview(wrapId, imgId, url) {
    const wrap = document.getElementById(wrapId);
    const img = document.getElementById(imgId);
    if (!wrap || !img) return;
    const src = String(url || '').trim();
    if (src) {
      img.src = src;
      wrap.hidden = false;
    } else {
      img.removeAttribute('src');
      wrap.hidden = true;
    }
  }

  function collectMarketingSettings() {
    return {
      marketing_enabled: document.getElementById('mkt-enabled')?.checked ? '1' : '0',
      marketing_card1_title: document.getElementById('mkt1-title')?.value.trim() || '',
      marketing_card1_desc: document.getElementById('mkt1-desc')?.value.trim() || '',
      marketing_card1_btn: document.getElementById('mkt1-btn')?.value.trim() || '',
      marketing_card1_link: document.getElementById('mkt1-link')?.value.trim() || '#products',
      marketing_card1_image: document.getElementById('mkt1-image')?.value.trim() || '',
      marketing_card1_bg: document.getElementById('mkt1-bg')?.value.trim() || '#fce4ec',
      marketing_card2_title: document.getElementById('mkt2-title')?.value.trim() || '',
      marketing_card2_desc: document.getElementById('mkt2-desc')?.value.trim() || '',
      marketing_card2_btn: document.getElementById('mkt2-btn')?.value.trim() || 'Submit',
      marketing_card2_image: document.getElementById('mkt2-image')?.value.trim() || '',
      marketing_card2_bg: document.getElementById('mkt2-bg')?.value.trim() || '#ede7f6',
    };
  }

  async function loadMarketing() {
    const data = await api('/settings');
    if (data.ok && data.settings) {
      const s = data.settings;
      const en = document.getElementById('mkt-enabled');
      if (en) en.checked = s.marketing_enabled !== '0';
      document.getElementById('mkt1-title').value = s.marketing_card1_title || '';
      document.getElementById('mkt1-desc').value = s.marketing_card1_desc || '';
      document.getElementById('mkt1-btn').value = s.marketing_card1_btn || '';
      document.getElementById('mkt1-link').value = s.marketing_card1_link || '';
      document.getElementById('mkt1-image').value = s.marketing_card1_image || '';
      document.getElementById('mkt1-bg').value = s.marketing_card1_bg || '#fce4ec';
      setMktImagePreview('mkt1-preview-wrap', 'mkt1-preview', s.marketing_card1_image);
      const mkt1File = document.getElementById('mkt1-file');
      if (mkt1File) mkt1File.value = '';
      document.getElementById('mkt2-title').value = s.marketing_card2_title || '';
      document.getElementById('mkt2-desc').value = s.marketing_card2_desc || '';
      document.getElementById('mkt2-btn').value = s.marketing_card2_btn || 'Submit';
      document.getElementById('mkt2-image').value = s.marketing_card2_image || '';
      document.getElementById('mkt2-bg').value = s.marketing_card2_bg || '#ede7f6';
      setMktImagePreview('mkt2-preview-wrap', 'mkt2-preview', s.marketing_card2_image);
      const mkt2File = document.getElementById('mkt2-file');
      if (mkt2File) mkt2File.value = '';
    }
    await loadPhoneSubscribers();
  }

  document.getElementById('mkt1-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMktImagePreview('mkt1-preview-wrap', 'mkt1-preview', URL.createObjectURL(f));
  });
  document.getElementById('mkt2-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMktImagePreview('mkt2-preview-wrap', 'mkt2-preview', URL.createObjectURL(f));
  });
  document.getElementById('mkt1-image')?.addEventListener('input', (e) => {
    setMktImagePreview('mkt1-preview-wrap', 'mkt1-preview', e.target.value);
  });
  document.getElementById('mkt2-image')?.addEventListener('input', (e) => {
    setMktImagePreview('mkt2-preview-wrap', 'mkt2-preview', e.target.value);
  });

  document.getElementById('marketing-save-btn')?.addEventListener('click', async () => {
    let img1 = document.getElementById('mkt1-image')?.value.trim() || '';
    let img2 = document.getElementById('mkt2-image')?.value.trim() || '';
    const f1 = document.getElementById('mkt1-file')?.files?.[0];
    const f2 = document.getElementById('mkt2-file')?.files?.[0];

    if (f1) {
      const up = await uploadProductImage(f1);
      if (!up.ok) {
        toast(up.error || 'Left card image upload failed', 'error');
        return;
      }
      img1 = up.url;
      document.getElementById('mkt1-image').value = img1;
      document.getElementById('mkt1-file').value = '';
      setMktImagePreview('mkt1-preview-wrap', 'mkt1-preview', img1);
    }
    if (f2) {
      const up = await uploadProductImage(f2);
      if (!up.ok) {
        toast(up.error || 'Right card image upload failed', 'error');
        return;
      }
      img2 = up.url;
      document.getElementById('mkt2-image').value = img2;
      document.getElementById('mkt2-file').value = '';
      setMktImagePreview('mkt2-preview-wrap', 'mkt2-preview', img2);
    }

    const settings = collectMarketingSettings();
    settings.marketing_card1_image = img1;
    settings.marketing_card2_image = img2;

    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
    if (data.ok) toast('Marketing cards saved');
    else toast(data.error || 'Save failed', 'error');
  });

  async function loadPhoneSubscribers(page) {
    if (page) subscribersPage = page;
    const status = document.getElementById('subscribers-status-filter')?.value || 'all';
    const search = document.getElementById('subscribers-search')?.value.trim() || '';
    const q = new URLSearchParams({ page: subscribersPage, limit: 20 });
    if (status !== 'all') q.set('status', status);
    if (search) q.set('search', search);
    const data = await api('/phone-subscribers?' + q.toString());
    if (!data.ok) return;
    if (data.newCount != null) setSubscriberBadge(data.newCount);

    const tbody = document.getElementById('subscribers-tbody');
    if (!tbody) return;

    if (!data.subscribers?.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">No phone subscribers yet.</td></tr>';
    } else {
      tbody.innerHTML = data.subscribers
        .map(
          (row) => `<tr>
        <td><b>${escHtml(row.customerPhone)}</b></td>
        <td>${escHtml(row.source || 'marketing')}</td>
        <td>${fmtDate(row.createdAt)}</td>
        <td>${subscriberStatusBadge(row.status)}</td>
        <td>
          <select class="tbl-select subscriber-status" data-id="${row.id}" style="min-width:100px;padding:4px 8px;font-size:12px;">
            <option value="new" ${row.status === 'new' ? 'selected' : ''}>New</option>
            <option value="read" ${row.status === 'read' ? 'selected' : ''}>Read</option>
            <option value="archived" ${row.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
          <button type="button" class="btn btn-danger btn-xs subscriber-del" data-id="${row.id}">Delete</button>
        </td></tr>`
        )
        .join('');

      tbody.querySelectorAll('.subscriber-status').forEach((sel) => {
        sel.onchange = async () => {
          const r = await api('/phone-subscribers/' + sel.dataset.id, {
            method: 'PATCH',
            body: JSON.stringify({ status: sel.value }),
          });
          if (r.ok) loadPhoneSubscribers(subscribersPage);
          else toast(r.error || 'Update failed', 'error');
        };
      });
      tbody.querySelectorAll('.subscriber-del').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this subscriber?')) return;
          const r = await api('/phone-subscribers/' + btn.dataset.id, { method: 'DELETE' });
          if (r.ok) {
            toast('Deleted');
            loadPhoneSubscribers(subscribersPage);
          } else toast(r.error || 'Delete failed', 'error');
        };
      });
    }

    const pag = data.pagination;
    const pagEl = document.getElementById('subscribers-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} subscribers)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-sp="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-sp="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-sp]').forEach((b) => {
        b.onclick = () => loadPhoneSubscribers(subscribersPage + Number(b.dataset.sp));
      });
    }
  }

  document.getElementById('subscribers-status-filter')?.addEventListener('change', () => loadPhoneSubscribers(1));
  document.getElementById('subscribers-search')?.addEventListener('input', debounce(() => loadPhoneSubscribers(1), 400));

  function openFaqModal() {
    document.getElementById('faq-modal')?.classList.add('open');
  }

  function closeFaqModal() {
    document.getElementById('faq-modal')?.classList.remove('open');
  }

  function resetFaqForm() {
    document.getElementById('faq-form-title').textContent = 'Add FAQ';
    document.getElementById('faq-id').value = '';
    document.getElementById('faq-question').value = '';
    document.getElementById('faq-answer').value = '';
    document.getElementById('faq-sort').value = '0';
    document.getElementById('faq-active').checked = true;
  }

  async function loadFaqs() {
    const data = await api('/faqs');
    if (!data.ok) return;
    faqs = data.faqs || [];
    const tbody = document.getElementById('faq-tbody');
    if (!tbody) return;
    if (!faqs.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">No FAQs yet. Click “Add FAQ” to create one.</td></tr>';
      return;
    }
    tbody.innerHTML = faqs
      .map((f) => {
        const preview = escHtml(String(f.answer || '').replace(/<[^>]+>/g, ' ').slice(0, 80));
        return `<tr>
        <td>${f.sortOrder ?? 0}</td>
        <td><b>${escHtml(f.question)}</b></td>
        <td>${preview}${String(f.answer || '').length > 80 ? '…' : ''}</td>
        <td><span class="badge badge-${f.isActive ? 'green' : 'gray'}">${f.isActive ? 'Active' : 'Hidden'}</span></td>
        <td>
          <button type="button" class="btn btn-outline btn-xs" data-edit-faq="${f.id}">Edit</button>
          <button type="button" class="btn btn-danger btn-xs" data-del-faq="${f.id}">Delete</button>
        </td></tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-edit-faq]').forEach((btn) => {
      btn.onclick = () => {
        const f = faqs.find((x) => x.id === Number(btn.dataset.editFaq));
        if (!f) return;
        document.getElementById('faq-form-title').textContent = 'Edit FAQ';
        document.getElementById('faq-id').value = f.id;
        document.getElementById('faq-question').value = f.question || '';
        document.getElementById('faq-answer').value = f.answer || '';
        document.getElementById('faq-sort').value = f.sortOrder ?? 0;
        document.getElementById('faq-active').checked = !!f.isActive;
        openFaqModal();
      };
    });

    tbody.querySelectorAll('[data-del-faq]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this FAQ?')) return;
        const res = await api('/faqs/' + btn.dataset.delFaq, { method: 'DELETE' });
        if (res.ok) {
          toast('FAQ deleted');
          loadFaqs();
        } else toast(res.error || 'Delete failed', 'error');
      };
    });
  }

  document.getElementById('add-faq-btn')?.addEventListener('click', () => {
    resetFaqForm();
    openFaqModal();
  });
  document.getElementById('faq-modal-close')?.addEventListener('click', closeFaqModal);
  document.getElementById('faq-modal-cancel')?.addEventListener('click', closeFaqModal);
  document.getElementById('faq-reset')?.addEventListener('click', resetFaqForm);

  document.getElementById('faq-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('faq-id').value;
    const body = {
      question: document.getElementById('faq-question').value.trim(),
      answer: document.getElementById('faq-answer').value.trim(),
      sortOrder: Number(document.getElementById('faq-sort').value) || 0,
      isActive: document.getElementById('faq-active').checked,
    };
    const res = id
      ? await api('/faqs/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/faqs', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      toast(id ? 'FAQ updated' : 'FAQ created');
      closeFaqModal();
      resetFaqForm();
      loadFaqs();
    } else toast(res.error || 'Save failed', 'error');
  });

  async function openOrderModal(id) {
    currentOrderId = id;
    const data = await api('/orders/' + id);
    if (!data.ok) return;
    const o = data.order;
    document.getElementById('order-status-select').value = o.status;
    document.getElementById('order-modal-body').innerHTML = `
      <p><b>${o.order_number}</b> — ${fmtDate(o.created_at)}</p>
      <p>${o.customer_name} · ${o.customer_phone}</p>
      <p>${o.address_line}, ${o.district}</p>
      <p>Payment: <b>${o.payment_method}</b></p>
      <hr style="margin:12px 0;border:none;border-top:1px solid #e2e8f0;">
      ${data.order.items
        .map((i) => `<p>${i.product_name} ×${i.quantity} — ৳${Number(i.line_total).toLocaleString()}</p>`)
        .join('')}
      <p style="margin-top:8px;font-weight:700;">Total: ৳${Number(o.total).toLocaleString()}</p>`;
    document.getElementById('order-modal').classList.add('open');
  }

  document.getElementById('order-modal-close').onclick = () => document.getElementById('order-modal').classList.remove('open');
  document.getElementById('order-status-save').onclick = async () => {
    const status = document.getElementById('order-status-select').value;
    const data = await api('/orders/' + currentOrderId, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (data.ok) {
      toast('Order updated');
      document.getElementById('order-modal').classList.remove('open');
      loadOrders();
      loadDashboard();
    }
  };

  // ——— Products ———
  /** @type {{ url: string, file?: File, preview?: string }[]} */
  let pfGalleryItems = [];
  const PF_GALLERY_MAX = 12;

  function revokePfGalleryPreviews(items) {
    (items || pfGalleryItems).forEach((item) => {
      if (item.preview && String(item.preview).startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
  }

  function pfGalleryDisplayUrl(item) {
    return item.preview || item.url;
  }

  async function uploadProductImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', body: fd });
    return up.json();
  }

  function renderPfGallery() {
    const el = document.getElementById('pf-gallery-list');
    if (!el) return;
    if (!pfGalleryItems.length) {
      el.innerHTML = '<div class="pf-gallery-empty">No images yet. Upload files or add a URL below.</div>';
      return;
    }
    el.innerHTML = pfGalleryItems
      .map((item, i) => {
        const src = pfGalleryDisplayUrl(item).replace(/"/g, '&quot;');
        const pending = item.file ? '<span class="pf-gallery-pending">New</span>' : '';
        return `<div class="pf-gallery-item" data-idx="${i}">
          <img src="${src}" alt="" width="108" height="108">
          <div class="pf-gallery-item-actions">
            ${pending}
            ${i === 0 ? '<span class="pf-gallery-main">Main</span>' : `<button type="button" class="btn btn-outline btn-sm pf-gallery-main-btn" data-idx="${i}">Set main</button>`}
            <button type="button" class="btn btn-outline btn-sm pf-gallery-remove" data-idx="${i}">Remove</button>
          </div>
        </div>`;
      })
      .join('');
    el.querySelectorAll('.pf-gallery-remove').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const item = pfGalleryItems[idx];
        if (item?.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
        pfGalleryItems.splice(idx, 1);
        renderPfGallery();
      };
    });
    el.querySelectorAll('.pf-gallery-main-btn').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const [item] = pfGalleryItems.splice(idx, 1);
        pfGalleryItems.unshift(item);
        renderPfGallery();
      };
    });
  }

  function resetPfGallery(urls) {
    revokePfGalleryPreviews(pfGalleryItems);
    pfGalleryItems = (Array.isArray(urls) ? urls : [])
      .filter(Boolean)
      .slice(0, PF_GALLERY_MAX)
      .map((url) => ({ url: String(url) }));
    const files = document.getElementById('pf-gallery-files');
    const urlInput = document.getElementById('pf-image-url');
    if (files) files.value = '';
    if (urlInput) urlInput.value = '';
    renderPfGallery();
  }

  document.getElementById('pf-gallery-files')?.addEventListener('change', (e) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      if (pfGalleryItems.length >= PF_GALLERY_MAX) {
        toast(`Maximum ${PF_GALLERY_MAX} images`, 'error');
        break;
      }
      if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) continue;
      const preview = URL.createObjectURL(file);
      pfGalleryItems.push({ url: preview, preview, file });
      added++;
    }
    if (added) renderPfGallery();
  });

  document.getElementById('pf-gallery-url-add')?.addEventListener('click', () => {
    const input = document.getElementById('pf-image-url');
    const url = input?.value?.trim();
    if (!url) return;
    if (pfGalleryItems.some((item) => item.url === url && !item.file)) {
      toast('Image already in gallery', 'error');
      return;
    }
    if (pfGalleryItems.length >= PF_GALLERY_MAX) {
      toast(`Maximum ${PF_GALLERY_MAX} images`, 'error');
      return;
    }
    pfGalleryItems.push({ url });
    if (input) input.value = '';
    renderPfGallery();
  });

  function productThumbHtml(p) {
    const bg = p.bg_color || '#f0f0f0';
    const icon = p.icon || 'ti ti-package';
    const color = p.icon_color || '#2d8a2d';
    if (p.image_url) {
      const alt = String(p.name_bn || 'Product').replace(/"/g, '&quot;');
      const src = String(p.image_url).replace(/"/g, '&quot;');
      return `<div class="prod-thumb prod-thumb--img" style="background:${bg};"><img src="${src}" alt="${alt}" width="42" height="42" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><i class="${icon}" style="color:${color};" hidden></i></div>`;
    }
    return `<div class="prod-thumb" style="background:${bg};"><i class="${icon}" style="color:${color};"></i></div>`;
  }

  async function loadCategoriesList() {
    const data = await api('/categories');
    if (!data.ok) return;
    categories = data.categories;
    const opts = categories.map((c) => `<option value="${c.id}">${c.name_bn}</option>`).join('');
    document.getElementById('pf-category').innerHTML = opts;
    document.getElementById('products-cat-filter').innerHTML =
      '<option value="all">All categories</option>' + categories.map((c) => `<option value="${c.slug}">${c.name_bn}</option>`).join('');
  }

  async function loadProducts(page) {
    if (page) productsPage = page;
    await loadCategoriesList();
    const cat = document.getElementById('products-cat-filter').value;
    const search = document.getElementById('products-search').value.trim();
    const q = new URLSearchParams({ page: productsPage, limit: 6 });
    if (cat !== 'all') q.set('category', cat);
    if (search) q.set('search', search);
    const data = await api('/products?' + q.toString());
    if (!data.ok) return;
    document.getElementById('products-tbody').innerHTML = data.products
      .map((p) => {
        const stockCls = p.stock <= 0 ? 'badge-red' : p.stock <= 5 ? 'badge-amber' : 'badge-green';
        const stockLbl = p.stock <= 0 ? 'Out of stock' : p.stock <= 5 ? 'Low' : 'Active';
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:10px;">
            ${productThumbHtml(p)}
            <div><div style="font-weight:600;">${p.name_bn}</div><small style="color:#94a3b8">${p.slug}</small></div></div></td>
          <td>${p.category_name}</td><td>৳${Number(p.price).toLocaleString()}</td><td>${p.stock}</td>
          <td><span class="badge ${stockCls}">${stockLbl}</span></td>
          <td>
            <button type="button" class="btn btn-outline btn-xs" data-edit-product="${p.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-product="${p.id}">Delete</button>
          </td></tr>`;
      })
      .join('');

    document.querySelectorAll('[data-edit-product]').forEach((btn) => {
      btn.onclick = () => {
        const p = data.products.find((x) => x.id === Number(btn.dataset.editProduct));
        if (!p) return;
        openProductForm(p);
      };
    });

    document.querySelectorAll('[data-del-product]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this product?')) return;
        const r = await api('/products/' + btn.dataset.delProduct, { method: 'DELETE' });
        if (r.ok) {
          toast('Product deleted');
          loadProducts();
        } else toast(r.error || 'Failed', 'error');
      };
    });

    const pag = data.pagination;
    const pagEl = document.getElementById('products-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} products)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-pp="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-pp="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-pp]').forEach((b) => {
        b.onclick = () => loadProducts(productsPage + Number(b.dataset.pp));
      });
    }
  }

  document.getElementById('products-cat-filter').onchange = () => loadProducts(1);
  document.getElementById('products-search').oninput = debounce(() => loadProducts(1), 400);

  document.getElementById('pf-reset').onclick = resetProductForm;
  function resetProductForm() {
    document.getElementById('product-form-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-icon').value = 'ti-package';
    document.getElementById('pf-icon-color').value = '#2d8a2d';
    document.getElementById('pf-bg').value = '#e8f5e8';
    document.getElementById('pf-stock').value = 100;
    document.getElementById('pf-featured').checked = true;
    ['pf-short-desc', 'pf-seo-title', 'pf-seo-desc', 'pf-seo-keywords', 'pf-image-alt', 'pf-og-image'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    resetPfGallery([]);
  }

  document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('pf-id').value;
    const galleryUrls = [];
    for (const item of pfGalleryItems) {
      if (galleryUrls.length >= PF_GALLERY_MAX) break;
      if (item.file) {
        try {
          const upData = await uploadProductImage(item.file);
          if (upData.ok) galleryUrls.push(upData.url);
          else toast(upData.error || 'Image upload failed', 'error');
        } catch {
          toast('Image upload failed', 'error');
        }
      } else if (item.url) {
        galleryUrls.push(item.url);
      }
    }
    const imageUrl = galleryUrls[0] || null;
    const body = {
      name: document.getElementById('pf-name').value.trim(),
      slug: document.getElementById('pf-slug')?.value?.trim() || undefined,
      categoryId: Number(document.getElementById('pf-category').value),
      price: Number(document.getElementById('pf-price').value),
      oldPrice: document.getElementById('pf-old-price').value || null,
      stock: Number(document.getElementById('pf-stock').value),
      sku: document.getElementById('pf-sku').value.trim(),
      description: document.getElementById('pf-desc').value.trim(),
      shortDescription: document.getElementById('pf-short-desc')?.value?.trim() || null,
      imageUrl,
      galleryUrls,
      icon: document.getElementById('pf-icon').value,
      iconColor: document.getElementById('pf-icon-color').value,
      bgColor: document.getElementById('pf-bg').value,
      tagType: document.getElementById('pf-tag').value,
      isFeatured: document.getElementById('pf-featured').checked,
      seoTitle: document.getElementById('pf-seo-title')?.value?.trim() || null,
      seoDescription: document.getElementById('pf-seo-desc')?.value?.trim() || null,
      seoKeywords: document.getElementById('pf-seo-keywords')?.value?.trim() || null,
      imageAlt: document.getElementById('pf-image-alt')?.value?.trim() || null,
      ogImage: document.getElementById('pf-og-image')?.value?.trim() || null,
    };
    const data = id
      ? await api('/products/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/products', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      toast(id ? 'Product updated' : 'Product created');
      closeProductForm();
      resetProductForm();
      loadProducts(productsPage || 1);
    } else toast(data.error || 'Save failed', 'error');
  };

  // ——— Customers ———
  async function loadCustomers() {
    const statsData = await api('/customers/stats');
    if (statsData.ok) {
      const s = statsData.stats;
      document.getElementById('customer-stats').innerHTML = `
        <div class="stat-card"><div class="stat-icon" style="background:#e8f5e8;"><i class="ti ti-users" style="color:#2d8a2d;"></i></div><div><div class="stat-num">${s.total}</div><div class="stat-label">Total customers</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="ti ti-user-plus" style="color:#1D9E75;"></i></div><div><div class="stat-num">${s.monthNew}</div><div class="stat-label">New this month</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="ti ti-chart-line" style="color:#EF9F27;"></i></div><div><div class="stat-num">${s.avgSpentFormatted}</div><div class="stat-label">Avg. spent</div></div></div>`;
    }
    const search = document.getElementById('customers-search').value.trim();
    const q = search ? '?search=' + encodeURIComponent(search) : '';
    const data = await api('/customers' + q);
    if (!data.ok) return;
    document.getElementById('customers-tbody').innerHTML = data.customers
      .map(
        (c) => `<tr>
        <td>${c.fullName}</td><td>${c.email}</td><td>${c.phone}</td>
        <td>${c.orderCount}</td><td>${c.totalSpentFormatted}</td><td>${fmtDate(c.createdAt)}</td></tr>`
      )
      .join('');
  }
  document.getElementById('customers-search').oninput = debounce(loadCustomers, 400);

  // ——— Categories ———
  function resetCategoryForm() {
    document.getElementById('category-form-title').textContent = 'Add Category';
    const submitBtn = document.getElementById('cf-submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Category';
    document.getElementById('cf-id').value = '';
    document.getElementById('category-form').reset();
    document.getElementById('cf-icon').value = 'ti-category';
    document.getElementById('cf-sort').value = '0';
  }

  async function loadCategories() {
    const data = await api('/categories');
    if (!data.ok) return;
    categories = data.categories;
    document.getElementById('categories-tbody').innerHTML = categories
      .map(
        (c) => `<tr>
        <td>${c.name_bn}</td><td><code>${c.slug}</code></td><td>${c.product_count}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-edit-cat="${c.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-xs" data-del-cat="${c.id}">Delete</button></td></tr>`
      )
      .join('');
    document.querySelectorAll('[data-edit-cat]').forEach((btn) => {
      btn.onclick = () => {
        const c = categories.find((x) => x.id === Number(btn.dataset.editCat));
        if (!c) return;
        document.getElementById('category-form-title').textContent = 'Edit Category';
        const submitBtn = document.getElementById('cf-submit-btn');
        if (submitBtn) submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Category';
        document.getElementById('cf-id').value = c.id;
        document.getElementById('cf-name').value = c.name_bn;
        document.getElementById('cf-slug').value = c.slug;
        document.getElementById('cf-icon').value = c.icon || 'ti-category';
        document.getElementById('cf-sort').value = c.sort_order ?? 0;
        openCategoryModal();
      };
    });
    document.querySelectorAll('[data-del-cat]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete category?')) return;
        const r = await api('/categories/' + btn.dataset.delCat, { method: 'DELETE' });
        if (r.ok) {
          toast('Deleted');
          loadCategories();
          loadCategoriesList();
        } else toast(r.error || 'Failed', 'error');
      };
    });
  }

  document.getElementById('cf-reset')?.addEventListener('click', resetCategoryForm);

  document.getElementById('category-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cf-id').value;
    const body = {
      name: document.getElementById('cf-name').value.trim(),
      slug: document.getElementById('cf-slug').value.trim() || undefined,
      icon: document.getElementById('cf-icon').value.trim() || 'ti-category',
      sortOrder: Number(document.getElementById('cf-sort').value) || 0,
    };
    const data = id
      ? await api('/categories/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/categories', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      toast(id ? 'Category updated' : 'Category added');
      closeCategoryModal();
      resetCategoryForm();
      loadCategories();
      loadCategoriesList();
    } else toast(data.error || 'Failed', 'error');
  };

  // ——— Coupons ———
  function resetCouponForm() {
    document.getElementById('coupon-form-title').textContent = 'New Coupon';
    document.getElementById('cp-id').value = '';
    document.getElementById('coupon-form').reset();
    document.getElementById('cp-min').value = '0';
    const submitBtn = document.getElementById('cp-submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Coupon';
  }

  async function loadCoupons() {
    const data = await api('/coupons');
    if (!data.ok) return;
    coupons = data.coupons;
    document.getElementById('coupons-tbody').innerHTML = coupons
      .map(
        (c) => `<tr>
        <td><code style="background:#e8f5e8;padding:3px 8px;border-radius:4px;font-weight:700;">${c.code}</code></td>
        <td>${c.discount_type}</td><td>${c.discount_type === 'percent' ? c.discount_value + '%' : '৳' + c.discount_value}</td>
        <td>৳${Number(c.min_order).toLocaleString()}</td>
        <td>${c.used_count}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
        <td>${c.expires_at ? String(c.expires_at).slice(0, 10) : '—'}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-edit-cp="${c.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-xs" data-del-coupon="${c.id}">Delete</button></td></tr>`
      )
      .join('');
    document.querySelectorAll('[data-edit-cp]').forEach((btn) => {
      btn.onclick = () => {
        const c = coupons.find((x) => x.id === Number(btn.dataset.editCp));
        if (!c) return;
        document.getElementById('coupon-form-title').textContent = 'Edit Coupon';
        document.getElementById('cp-id').value = c.id;
        document.getElementById('cp-code').value = c.code;
        document.getElementById('cp-type').value = c.discount_type;
        document.getElementById('cp-value').value = c.discount_value;
        document.getElementById('cp-min').value = c.min_order;
        document.getElementById('cp-limit').value = c.usage_limit || '';
        document.getElementById('cp-expires').value = c.expires_at ? String(c.expires_at).slice(0, 10) : '';
        openCouponModal();
      };
    });
    document.querySelectorAll('[data-del-coupon]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete coupon?')) return;
        const r = await api('/coupons/' + btn.dataset.delCoupon, { method: 'DELETE' });
        if (r.ok) {
          toast('Coupon deleted');
          loadCoupons();
        } else toast(r.error || 'Failed', 'error');
      };
    });
  }

  document.getElementById('cp-reset')?.addEventListener('click', resetCouponForm);

  document.getElementById('coupon-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cp-id').value;
    const body = {
      code: document.getElementById('cp-code').value.trim(),
      discountType: document.getElementById('cp-type').value,
      discountValue: Number(document.getElementById('cp-value').value),
      minOrder: Number(document.getElementById('cp-min').value),
      usageLimit: document.getElementById('cp-limit').value || null,
      expiresAt: document.getElementById('cp-expires').value || null,
      isActive: true,
    };
    const data = id
      ? await api('/coupons/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/coupons', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      toast(id ? 'Coupon updated' : 'Coupon created');
      closeCouponModal();
      resetCouponForm();
      loadCoupons();
    } else toast(data.error || 'Failed', 'error');
  };

  // ——— Settings ———
  function parseFooterLinksAdmin(raw) {
    if (!raw) return [];
    const text = String(raw).trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const pipe = trimmed.indexOf('|');
        const label = pipe >= 0 ? trimmed.slice(0, pipe).trim() : trimmed;
        const target = pipe >= 0 ? trimmed.slice(pipe + 1).trim() : '#';
        if (!label) return null;
        if (target.startsWith('page:')) return { label, page: target.slice(5) };
        return { label, href: target || '#' };
      })
      .filter(Boolean);
  }

  function footerLinksToText(raw) {
    const links = parseFooterLinksAdmin(raw);
    if (!links.length) return '';
    return links
      .map((l) => (l.page ? `${l.label}|page:${l.page}` : `${l.label}|${l.href || '#'}`))
      .join('\n');
  }

  function footerLinksFromText(text) {
    const links = parseFooterLinksAdmin(text);
    return JSON.stringify(links);
  }

  async function loadSettings() {
    const data = await api('/settings');
    if (!data.ok) return;
    const s = data.settings;
    document.getElementById('set-site-name').value = s.site_name || '';
    document.getElementById('set-tagline').value = s.site_tagline || '';
    document.getElementById('set-announcement').value = s.announcement_text || '';
    document.getElementById('set-email').value = s.contact_email || '';
    document.getElementById('set-phone').value = s.contact_phone || '';
    const pb = document.getElementById('set-payment-bkash');
    if (pb) pb.value = s.payment_bkash || '';
    const pn = document.getElementById('set-payment-nagad');
    if (pn) pn.value = s.payment_nagad || '';
    const pr = document.getElementById('set-payment-rocket');
    if (pr) pr.value = s.payment_rocket || '';
    document.getElementById('set-address').value = s.contact_address || '';
    const fd = document.getElementById('set-footer-desc');
    if (fd) fd.value = s.footer_desc || '';
    const sh = document.getElementById('set-store-hours');
    if (sh) sh.value = s.store_hours || '';
    const lu = document.getElementById('set-logo-url');
    if (lu) lu.value = s.site_logo_url || '/images/rakushopbd-logo.png';
    const sf = document.getElementById('set-social-facebook');
    if (sf) sf.value = s.social_facebook || '';
    const si = document.getElementById('set-social-instagram');
    if (si) si.value = s.social_instagram || '';
    const sy = document.getElementById('set-social-youtube');
    if (sy) sy.value = s.social_youtube || '';
    const sw = document.getElementById('set-social-whatsapp');
    if (sw) sw.value = s.social_whatsapp || '';
    const fq = document.getElementById('set-footer-quick');
    if (fq) fq.value = footerLinksToText(s.footer_quick_links);
    const fh = document.getElementById('set-footer-help');
    if (fh) fh.value = footerLinksToText(s.footer_help_links);
    document.getElementById('set-free-min').value = s.free_delivery_min || '500';
    document.getElementById('set-delivery-fee').value = s.delivery_fee || '60';
    const outFee = document.getElementById('set-delivery-outside');
    if (outFee) outFee.value = s.delivery_fee_outside || '120';
    document.getElementById('set-maintenance').checked = s.maintenance_mode === '1';
    const faceAnalyzer = document.getElementById('set-face-analyzer');
    if (faceAnalyzer) faceAnalyzer.checked = s.face_analyzer_enabled !== '0';
    document.getElementById('set-guest').checked = s.feature_guest_checkout !== '0';
    document.getElementById('set-cod').checked = s.feature_cod !== '0';
    const flash = document.getElementById('set-flash');
    if (flash) flash.checked = s.feature_flash_sale !== '0';
    const rev = document.getElementById('set-review-approval');
    if (rev) rev.checked = s.feature_review_approval !== '0';
    const em = document.getElementById('set-email-notify');
    if (em) em.checked = s.feature_email_notify !== '0';
    const sms = document.getElementById('set-sms');
    if (sms) sms.checked = s.feature_sms_notify === '1';
    const siteUrl = document.getElementById('set-site-url');
    if (siteUrl) siteUrl.value = s.site_url || '';
    const seoDesc = document.getElementById('set-seo-description');
    if (seoDesc) seoDesc.value = s.seo_meta_description || '';
    const seoKw = document.getElementById('set-seo-keywords');
    if (seoKw) seoKw.value = s.seo_meta_keywords || '';
    const seoOg = document.getElementById('set-seo-og-image');
    if (seoOg) seoOg.value = s.seo_og_image || '';
    const seoGoogle = document.getElementById('set-seo-google');
    if (seoGoogle) seoGoogle.value = s.seo_google_verification || '';
    const seoTwitter = document.getElementById('set-seo-twitter');
    if (seoTwitter) seoTwitter.value = s.seo_twitter_handle || '';
    const seoHome = document.getElementById('set-seo-home-title');
    if (seoHome) seoHome.value = s.seo_home_title || '';
  }

  async function loadAnalytics() {
    const data = await api('/analytics');
    if (!data.ok) return;
    const s = data.stats;
    document.getElementById('analytics-stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon" style="background:#e8f5e8;"><i class="ti ti-shopping-bag"></i></div><div><div class="stat-num">${s.monthOrders}</div><div class="stat-label">Orders this month</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="ti ti-users"></i></div><div><div class="stat-num">${s.monthCustomers}</div><div class="stat-label">New customers</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="ti ti-receipt"></i></div><div><div class="stat-num">${s.avgOrderFormatted}</div><div class="stat-label">Avg. order value</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fee2e2;"><i class="ti ti-chart-line"></i></div><div><div class="stat-num">—</div><div class="stat-label">Top products below</div></div></div>`;
    document.getElementById('analytics-tbody').innerHTML = data.topProducts
      .map((p) => `<tr><td>${p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}</td><td>${p.name}</td><td>${p.qty}</td><td>${p.revenueFormatted}</td></tr>`)
      .join('');
  }

  async function loadReviews() {
    const status = document.getElementById('reviews-filter').value;
    const data = await api('/reviews?status=' + status);
    if (!data.ok) return toast(data.error || 'Load failed', 'error');
    const rb = document.getElementById('review-badge');
    if (rb) rb.textContent = data.pendingCount || 0;
    document.getElementById('reviews-tbody').innerHTML = data.reviews
      .map((r) => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        return `<tr><td>${r.customer_name}</td><td>${r.product_name}</td><td style="color:#EF9F27;">${stars}</td>
        <td>${(r.comment || '').slice(0, 40)}</td><td>${fmtDate(r.created_at)}</td>
        <td><span class="badge badge-${r.status === 'approved' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}">${r.status}</span></td>
        <td>${r.status === 'pending' ? `<button class="btn btn-primary btn-xs" data-approve="${r.id}">Approve</button>` : ''}
        <button class="btn btn-danger btn-xs" data-del-review="${r.id}">Delete</button></td></tr>`;
      })
      .join('');
    document.querySelectorAll('[data-approve]').forEach((b) => {
      b.onclick = async () => {
        await api('/reviews/' + b.dataset.approve, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
        loadReviews();
      };
    });
    document.querySelectorAll('[data-del-review]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Delete review?')) return;
        await api('/reviews/' + b.dataset.delReview, { method: 'DELETE' });
        loadReviews();
      };
    });
  }
  document.getElementById('reviews-filter').onchange = loadReviews;

  function resetBannerForm() {
    document.getElementById('banner-form-title').textContent = 'Add Banner';
    document.getElementById('bn-id').value = '';
    document.getElementById('banner-form').reset();
    document.getElementById('bn-link').value = '/';
    document.getElementById('bn-gradient').value = 'linear-gradient(135deg,#2d8a2d,#164816)';
    document.getElementById('bn-sort').value = '0';
    document.getElementById('bn-active').checked = true;
    const fileEl = document.getElementById('bn-file');
    if (fileEl) fileEl.value = '';
  }

  async function loadBanners() {
    const data = await api('/banners');
    if (!data.ok) return;
    banners = data.banners;
    document.getElementById('banners-tbody').innerHTML = banners
      .map(
        (b) => `<tr><td>${b.title}</td><td>${b.position}</td><td>${b.link_url}</td>
        <td><span class="badge badge-${b.is_active ? 'green' : 'gray'}">${b.is_active ? 'Active' : 'Off'}</span></td>
        <td><button type="button" class="btn btn-outline btn-xs" data-edit-bn="${b.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-xs" data-del-bn="${b.id}">Delete</button></td></tr>`
      )
      .join('');
    document.querySelectorAll('[data-edit-bn]').forEach((btn) => {
      btn.onclick = () => {
        const b = banners.find((x) => x.id === Number(btn.dataset.editBn));
        if (!b) return;
        document.getElementById('banner-form-title').textContent = 'Edit Banner';
        document.getElementById('bn-id').value = b.id;
        document.getElementById('bn-title').value = b.title;
        document.getElementById('bn-position').value = b.position;
        document.getElementById('bn-link').value = b.link_url || '/';
        document.getElementById('bn-gradient').value = b.bg_gradient || 'linear-gradient(135deg,#2d8a2d,#164816)';
        document.getElementById('bn-image').value = b.image_url || '';
        document.getElementById('bn-expires').value = b.expires_at ? String(b.expires_at).slice(0, 10) : '';
        document.getElementById('bn-sort').value = b.sort_order ?? 0;
        document.getElementById('bn-active').checked = !!b.is_active;
        const fileEl = document.getElementById('bn-file');
        if (fileEl) fileEl.value = '';
        openBannerModal();
      };
    });
    document.querySelectorAll('[data-del-bn]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this banner?')) return;
        const r = await api('/banners/' + btn.dataset.delBn, { method: 'DELETE' });
        if (r.ok) {
          toast('Banner deleted');
          loadBanners();
        } else toast(r.error || 'Failed', 'error');
      };
    });
  }

  document.getElementById('bn-reset')?.addEventListener('click', resetBannerForm);

  document.getElementById('banner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let imageUrl = document.getElementById('bn-image').value.trim();
    const f = document.getElementById('bn-file');
    if (f?.files?.[0]) {
      const fd = new FormData();
      fd.append('image', f.files[0]);
      const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', body: fd });
      const upData = await up.json();
      if (upData.ok) imageUrl = upData.url;
      else {
        toast(upData.error || 'Image upload failed', 'error');
        return;
      }
    }
    const id = document.getElementById('bn-id').value;
    const body = {
      title: document.getElementById('bn-title').value.trim(),
      position: document.getElementById('bn-position').value,
      linkUrl: document.getElementById('bn-link').value.trim() || '/',
      bgGradient: document.getElementById('bn-gradient').value.trim(),
      expiresAt: document.getElementById('bn-expires').value || null,
      imageUrl: imageUrl || null,
      sortOrder: Number(document.getElementById('bn-sort').value) || 0,
      isActive: document.getElementById('bn-active').checked,
    };
    const res = id
      ? await api('/banners/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/banners', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      toast(id ? 'Banner updated' : 'Banner created');
      closeBannerModal();
      resetBannerForm();
      loadBanners();
    } else toast(res.error || 'Failed', 'error');
  });

  function collectSeoSettings() {
    return {
      site_url: document.getElementById('set-site-url')?.value?.trim() || '',
      seo_home_title: document.getElementById('set-seo-home-title')?.value?.trim() || '',
      seo_meta_description: document.getElementById('set-seo-description')?.value?.trim() || '',
      seo_meta_keywords: document.getElementById('set-seo-keywords')?.value?.trim() || '',
      seo_og_image: document.getElementById('set-seo-og-image')?.value?.trim() || '',
      seo_google_verification: document.getElementById('set-seo-google')?.value?.trim() || '',
      seo_twitter_handle: document.getElementById('set-seo-twitter')?.value?.trim() || '',
    };
  }

  function collectSettings() {
    return {
      site_name: document.getElementById('set-site-name').value,
      site_tagline: document.getElementById('set-tagline').value,
      announcement_text: document.getElementById('set-announcement').value,
      contact_email: document.getElementById('set-email').value,
      contact_phone: document.getElementById('set-phone').value,
      payment_bkash: document.getElementById('set-payment-bkash')?.value || '',
      payment_nagad: document.getElementById('set-payment-nagad')?.value || '',
      payment_rocket: document.getElementById('set-payment-rocket')?.value || '',
      contact_address: document.getElementById('set-address').value,
      footer_desc: document.getElementById('set-footer-desc')?.value?.trim() || '',
      store_hours: document.getElementById('set-store-hours')?.value?.trim() || '',
      site_logo_url: document.getElementById('set-logo-url')?.value?.trim() || '',
      social_facebook: document.getElementById('set-social-facebook')?.value?.trim() || '',
      social_instagram: document.getElementById('set-social-instagram')?.value?.trim() || '',
      social_youtube: document.getElementById('set-social-youtube')?.value?.trim() || '',
      social_whatsapp: document.getElementById('set-social-whatsapp')?.value?.trim() || '',
      footer_quick_links: footerLinksFromText(document.getElementById('set-footer-quick')?.value || ''),
      footer_help_links: footerLinksFromText(document.getElementById('set-footer-help')?.value || ''),
      free_delivery_min: document.getElementById('set-free-min').value,
      delivery_fee: document.getElementById('set-delivery-fee').value,
      delivery_fee_outside: document.getElementById('set-delivery-outside')?.value || '120',
      maintenance_mode: document.getElementById('set-maintenance').checked ? '1' : '0',
      face_analyzer_enabled: document.getElementById('set-face-analyzer')?.checked ? '1' : '0',
      feature_guest_checkout: document.getElementById('set-guest').checked ? '1' : '0',
      feature_cod: document.getElementById('set-cod').checked ? '1' : '0',
      feature_flash_sale: document.getElementById('set-flash')?.checked ? '1' : '0',
      feature_review_approval: document.getElementById('set-review-approval')?.checked ? '1' : '0',
      feature_email_notify: document.getElementById('set-email-notify')?.checked ? '1' : '0',
      feature_sms_notify: document.getElementById('set-sms')?.checked ? '1' : '0',
      ...collectSeoSettings(),
    };
  }

  document.getElementById('settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const logoFile = document.getElementById('set-logo-file');
    const logoUrlInput = document.getElementById('set-logo-url');
    if (logoFile?.files?.[0]) {
      try {
        const upData = await uploadProductImage(logoFile.files[0]);
        if (upData.ok && logoUrlInput) {
          logoUrlInput.value = upData.url;
          logoFile.value = '';
        } else if (!upData.ok) {
          toast(upData.error || 'Logo upload failed', 'error');
          return;
        }
      } catch {
        toast('Logo upload failed', 'error');
        return;
      }
    }
    const data = await api('/settings', { method: 'PUT', body: JSON.stringify({ settings: collectSettings() }) });
    if (data.ok) toast('Settings saved');
    else toast(data.error || 'Failed', 'error');
  };

  document.getElementById('delivery-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = await api('/settings', { method: 'PUT', body: JSON.stringify({ settings: collectSettings() }) });
    if (data.ok) toast('Delivery settings saved');
    else toast(data.error || 'Failed to save delivery settings', 'error');
  };

  document.getElementById('seo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { ...collectSettings(), ...collectSeoSettings() } }),
    });
    if (data.ok) toast('SEO settings saved');
    else toast(data.error || 'Failed to save SEO settings', 'error');
  });

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  async function downloadExport(path, filename) {
    const res = await fetch(API + path, { credentials: 'same-origin' });
    if (!res.ok) {
      toast('Export failed', 'error');
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.getElementById('orders-export-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    downloadExport('/orders/export', 'orders.csv');
  });
  document.querySelector('a[href="/api/admin/customers/export"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    downloadExport('/customers/export', 'customers.csv');
  });

  init();
})();
