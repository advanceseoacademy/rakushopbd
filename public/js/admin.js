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
  let currentOrderId = null;

  let ordersPage = 1;
  let authRedirectHold = false;

  const pageTitles = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    products: 'Products',
    customers: 'Customers',
    analytics: 'Analytics',
    categories: 'Categories',
    coupons: 'Coupons',
    reviews: 'Reviews',
    banners: 'Banners',
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
    if (!validPages.has(page)) return;
    try {
      localStorage.setItem(ADMIN_PAGE_KEY, page);
      sessionStorage.setItem(ADMIN_PAGE_KEY, page);
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
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
    const title = pageTitles[page] || page;
    document.getElementById('page-title').textContent = title;
    document.getElementById('breadcrumb-current').textContent = title;
    window.scrollTo(0, 0);
    saveActivePage(page);

    if (page === 'dashboard') loadDashboard();
    if (page === 'orders') loadOrders();
    if (page === 'products') loadProducts();
    if (page === 'customers') loadCustomers();
    if (page === 'categories') loadCategories();
    if (page === 'coupons') loadCoupons();
    if (page === 'settings') loadSettings();
    if (page === 'analytics') loadAnalytics();
    if (page === 'reviews') loadReviews();
    if (page === 'banners') loadBanners();
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
  const addProductBtn = document.getElementById('add-product-btn');
  if (addProductBtn) {
    addProductBtn.onclick = () => {
      switchPage('products');
      resetProductForm();
      setTimeout(() => {
        const nameInput = document.getElementById('pf-name');
        if (nameInput) nameInput.focus();
      }, 0);
    };
  }

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
      const icons = { order: 'ti-shopping-bag', user: 'ti-user-plus', alert: 'ti-alert-triangle', review: 'ti-star' };
      const colors = { order: '#e8f5e8', user: '#dcfce7', alert: '#fee2e2', review: '#fef3c7' };
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
  async function loadCategoriesList() {
    const data = await api('/categories');
    if (!data.ok) return;
    categories = data.categories;
    const opts = categories.map((c) => `<option value="${c.id}">${c.name_bn}</option>`).join('');
    document.getElementById('pf-category').innerHTML = opts;
    document.getElementById('products-cat-filter').innerHTML =
      '<option value="all">All categories</option>' + categories.map((c) => `<option value="${c.slug}">${c.name_bn}</option>`).join('');
  }

  async function loadProducts() {
    await loadCategoriesList();
    const cat = document.getElementById('products-cat-filter').value;
    const search = document.getElementById('products-search').value.trim();
    const q = new URLSearchParams();
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
            <div class="prod-thumb" style="background:${p.bg_color};"><i class="${p.icon}" style="color:${p.icon_color};"></i></div>
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
        document.getElementById('product-form-title').textContent = 'Edit Product';
        document.getElementById('pf-id').value = p.id;
        document.getElementById('pf-name').value = p.name_bn;
        document.getElementById('pf-category').value = p.category_id;
        document.getElementById('pf-price').value = p.price;
        document.getElementById('pf-old-price').value = p.old_price || '';
        document.getElementById('pf-stock').value = p.stock;
        document.getElementById('pf-sku').value = p.sku || '';
        document.getElementById('pf-desc').value = p.description_bn || '';
        document.getElementById('pf-image-url').value = p.image_url || '';
        document.getElementById('pf-icon').value = p.icon;
        document.getElementById('pf-icon-color').value = p.icon_color;
        document.getElementById('pf-bg').value = p.bg_color;
        document.getElementById('pf-tag').value = p.tag_type;
        document.getElementById('pf-featured').checked = !!p.is_featured;
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
  }

  document.getElementById('products-cat-filter').onchange = loadProducts;
  document.getElementById('products-search').oninput = debounce(loadProducts, 400);

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
  }

  document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('pf-id').value;
        let imageUrl = document.getElementById('pf-image-url').value.trim();
    const fileInput = document.getElementById('pf-image-file');
    if (fileInput?.files?.[0]) {
      const fd = new FormData();
      fd.append('image', fileInput.files[0]);
      const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', body: fd });
      const upData = await up.json();
      if (upData.ok) imageUrl = upData.url;
    }
    const body = {
      name: document.getElementById('pf-name').value.trim(),
      categoryId: Number(document.getElementById('pf-category').value),
      price: Number(document.getElementById('pf-price').value),
      oldPrice: document.getElementById('pf-old-price').value || null,
      stock: Number(document.getElementById('pf-stock').value),
      sku: document.getElementById('pf-sku').value.trim(),
      description: document.getElementById('pf-desc').value.trim(),
      imageUrl: imageUrl || null,
      icon: document.getElementById('pf-icon').value,
      iconColor: document.getElementById('pf-icon-color').value,
      bgColor: document.getElementById('pf-bg').value,
      tagType: document.getElementById('pf-tag').value,
      isFeatured: document.getElementById('pf-featured').checked,
    };
    const data = id
      ? await api('/products/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/products', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      toast(id ? 'Product updated' : 'Product created');
      resetProductForm();
      loadProducts();
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
        document.getElementById('cf-id').value = c.id;
        document.getElementById('cf-name').value = c.name_bn;
        document.getElementById('cf-slug').value = c.slug;
        document.getElementById('cf-icon').value = c.icon;
      };
    });
    document.querySelectorAll('[data-del-cat]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete category?')) return;
        const r = await api('/categories/' + btn.dataset.delCat, { method: 'DELETE' });
        if (r.ok) {
          toast('Deleted');
          loadCategories();
        } else toast(r.error || 'Failed', 'error');
      };
    });
  }

  document.getElementById('cf-reset')?.addEventListener('click', () => {
    document.getElementById('category-form-title').textContent = 'Add Category';
    document.getElementById('cf-id').value = '';
    document.getElementById('category-form').reset();
    document.getElementById('cf-icon').value = 'ti-category';
  });

  document.getElementById('category-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cf-id').value;
    const body = {
      name: document.getElementById('cf-name').value.trim(),
      slug: document.getElementById('cf-slug').value.trim() || undefined,
      icon: document.getElementById('cf-icon').value,
    };
    const data = id
      ? await api('/categories/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/categories', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      toast(id ? 'Category updated' : 'Category added');
      document.getElementById('cf-reset').click();
      loadCategories();
    } else toast(data.error || 'Failed', 'error');
  };

  // ——— Coupons ———
  async function loadCoupons() {
    const data = await api('/coupons');
    if (!data.ok) return;
    document.getElementById('coupons-tbody').innerHTML = data.coupons
      .map(
        (c) => `<tr>
        <td><code style="background:#e8f5e8;padding:3px 8px;border-radius:4px;font-weight:700;">${c.code}</code></td>
        <td>${c.discount_type}</td><td>${c.discount_type === 'percent' ? c.discount_value + '%' : '৳' + c.discount_value}</td>
        <td>৳${Number(c.min_order).toLocaleString()}</td>
        <td>${c.used_count}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
        <td>${c.expires_at || '—'}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-edit-cp="${c.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-xs" data-del-coupon="${c.id}">Delete</button></td></tr>`
      )
      .join('');
    document.querySelectorAll('[data-edit-cp]').forEach((btn) => {
      btn.onclick = () => {
        const c = data.coupons.find((x) => x.id === Number(btn.dataset.editCp));
        document.getElementById('coupon-form-title').textContent = 'Edit Coupon';
        document.getElementById('cp-id').value = c.id;
        document.getElementById('cp-code').value = c.code;
        document.getElementById('cp-type').value = c.discount_type;
        document.getElementById('cp-value').value = c.discount_value;
        document.getElementById('cp-min').value = c.min_order;
        document.getElementById('cp-limit').value = c.usage_limit || '';
        document.getElementById('cp-expires').value = c.expires_at ? c.expires_at.slice(0, 10) : '';
      };
    });
    document.querySelectorAll('[data-del-coupon]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete coupon?')) return;
        await api('/coupons/' + btn.dataset.delCoupon, { method: 'DELETE' });
        loadCoupons();
      };
    });
  }

  document.getElementById('coupon-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cp-id').value;
    const body = {
      code: document.getElementById('cp-code').value,
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
      document.getElementById('cp-id').value = '';
      document.getElementById('coupon-form-title').textContent = 'New Coupon';
      e.target.reset();
      loadCoupons();
    } else toast(data.error || 'Failed', 'error');
  };

  // ——— Settings ———
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
    document.getElementById('set-free-min').value = s.free_delivery_min || '500';
    document.getElementById('set-delivery-fee').value = s.delivery_fee || '60';
    const outFee = document.getElementById('set-delivery-outside');
    if (outFee) outFee.value = s.delivery_fee_outside || '120';
    document.getElementById('set-maintenance').checked = s.maintenance_mode === '1';
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

  async function loadBanners() {
    const data = await api('/banners');
    if (!data.ok) return;
    document.getElementById('banners-tbody').innerHTML = data.banners
      .map(
        (b) => `<tr><td>${b.title}</td><td>${b.position}</td><td>${b.link_url}</td>
        <td><span class="badge badge-${b.is_active ? 'green' : 'gray'}">${b.is_active ? 'Active' : 'Off'}</span></td>
        <td><button class="btn btn-outline btn-xs" data-edit-bn="${b.id}">Edit</button>
        <button class="btn btn-danger btn-xs" data-del-bn="${b.id}">Delete</button></td></tr>`
      )
      .join('');
    document.querySelectorAll('[data-edit-bn]').forEach((btn) => {
      btn.onclick = () => {
        const b = data.banners.find((x) => x.id === Number(btn.dataset.editBn));
        document.getElementById('banner-form-title').textContent = 'Edit Banner';
        document.getElementById('bn-id').value = b.id;
        document.getElementById('bn-title').value = b.title;
        document.getElementById('bn-position').value = b.position;
        document.getElementById('bn-link').value = b.link_url;
        document.getElementById('bn-gradient').value = b.bg_gradient;
        document.getElementById('bn-image').value = b.image_url || '';
        document.getElementById('bn-expires').value = b.expires_at ? b.expires_at.slice(0, 10) : '';
      };
    });
    document.querySelectorAll('[data-del-bn]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete?')) return;
        await api('/banners/' + btn.dataset.delBn, { method: 'DELETE' });
        loadBanners();
      };
    });
  }

  document.getElementById('bn-reset')?.addEventListener('click', () => {
    document.getElementById('banner-form-title').textContent = 'Add Banner';
    document.getElementById('banner-form').reset();
    document.getElementById('bn-id').value = '';
    document.getElementById('bn-gradient').value = 'linear-gradient(135deg,#2d8a2d,#164816)';
  });

  document.getElementById('banner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let imageUrl = document.getElementById('bn-image').value;
    const f = document.getElementById('bn-file');
    if (f?.files?.[0]) {
      const fd = new FormData();
      fd.append('image', f.files[0]);
      const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', body: fd });
      const upData = await up.json();
      if (upData.ok) imageUrl = upData.url;
    }
    const id = document.getElementById('bn-id').value;
    const body = {
      title: document.getElementById('bn-title').value,
      position: document.getElementById('bn-position').value,
      linkUrl: document.getElementById('bn-link').value,
      bgGradient: document.getElementById('bn-gradient').value,
      expiresAt: document.getElementById('bn-expires').value || null,
      imageUrl: imageUrl || null,
      isActive: true,
    };
    const res = id
      ? await api('/banners/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/banners', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      toast('Banner saved');
      document.getElementById('bn-reset').click();
      loadBanners();
    } else toast(res.error || 'Failed', 'error');
  });

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
      free_delivery_min: document.getElementById('set-free-min').value,
      delivery_fee: document.getElementById('set-delivery-fee').value,
      delivery_fee_outside: document.getElementById('set-delivery-outside')?.value || '120',
      maintenance_mode: document.getElementById('set-maintenance').checked ? '1' : '0',
      feature_guest_checkout: document.getElementById('set-guest').checked ? '1' : '0',
      feature_cod: document.getElementById('set-cod').checked ? '1' : '0',
      feature_flash_sale: document.getElementById('set-flash')?.checked ? '1' : '0',
      feature_review_approval: document.getElementById('set-review-approval')?.checked ? '1' : '0',
      feature_email_notify: document.getElementById('set-email-notify')?.checked ? '1' : '0',
      feature_sms_notify: document.getElementById('set-sms')?.checked ? '1' : '0',
    };
  }

  document.getElementById('settings-form').onsubmit = async (e) => {
    e.preventDefault();
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
