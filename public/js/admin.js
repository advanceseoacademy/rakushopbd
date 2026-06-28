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

  function adminUploadHeaders() {
    const headers = {};
    const token = getAdminToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Admin-Token'] = token;
    }
    return headers;
  }

  let currentAdmin = null;
  let categories = [];
  let cfSubParentId = null;
  let coupons = [];
  let banners = [];
  let messengerChats = [];
  let faqs = [];
  let blogPosts = [];
  let blogPage = 1;
  let currentOrderId = null;
  const selectedOrderIds = new Set();
  const selectedContactIds = new Set();
  const selectedAppointmentIds = new Set();
  const selectedProductIds = new Set();
  const selectedCustomerIds = new Set();
  const selectedCouponIds = new Set();
  const selectedReviewIds = new Set();

  let ordersPage = 1;
  let reviewsPage = 1;
  let dashRecentOrdersPage = 1;
  let appointmentsPage = 1;
  let contactsPage = 1;
  let subscribersPage = 1;
  let productsPage = 1;
  let galleryPage = 1;
  let authRedirectHold = false;

  function isProductEditorAdmin() {
    return Boolean(currentAdmin?.isProductEditor || currentAdmin?.role === 'product_editor');
  }

  function isSuperAdminUser() {
    if (!currentAdmin) return true;
    if (currentAdmin.isSuperAdmin === true) return true;
    if (currentAdmin.isProductEditor || currentAdmin.role === 'product_editor') return false;
    return currentAdmin.role !== 'product_editor';
  }

  function canDeleteProducts() {
    if (!currentAdmin) return true;
    if (currentAdmin.canDeleteProducts === false) return false;
    return !isProductEditorAdmin();
  }

  function getStartAdminPage() {
    if (isProductEditorAdmin()) return 'products';
    const saved = getSavedPage();
    return validPages.has(saved) ? saved : 'dashboard';
  }

  function applyAdminAccessUi() {
    const layout = document.querySelector('.adm-layout');
    const productOnly = isProductEditorAdmin();
    if (layout) layout.classList.toggle('admin-access-product-only', productOnly);
    document.querySelectorAll('[data-super-only]').forEach((el) => {
      el.hidden = productOnly;
    });
    document.querySelectorAll('.nav-item[data-page="products"]').forEach((el) => {
      el.hidden = false;
    });
    const roleNote = document.getElementById('sidebar-role-note');
    if (roleNote) {
      roleNote.textContent = productOnly ? 'Product access only' : '';
      roleNote.hidden = !productOnly;
    }
    const bulkDeleteBtn = document.getElementById('products-bulk-delete-btn');
    const clearSelBtn = document.getElementById('products-clear-selection-btn');
    const selectAll = document.getElementById('products-select-all');
    const checkCol = document.querySelector('#sec-products .tbl-check-col');
    if (!canDeleteProducts()) {
      if (bulkDeleteBtn) bulkDeleteBtn.hidden = true;
      if (clearSelBtn) clearSelBtn.hidden = true;
      if (selectAll) selectAll.closest('th')?.classList.add('is-hidden');
      document.querySelectorAll('#sec-products .tbl-check-col').forEach((el) => el.classList.add('is-hidden'));
    } else if (checkCol) {
      if (selectAll) selectAll.closest('th')?.classList.remove('is-hidden');
      document.querySelectorAll('#sec-products .tbl-check-col').forEach((el) => el.classList.remove('is-hidden'));
    }
  }

  const pageTitles = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    appointments: 'Appointments',
    contacts: 'Contact Messages',
    products: 'Products',
    gallery: 'Image Gallery',
    'product-form': 'Add Product',
    customers: 'Customers',
    analytics: 'Analytics',
    categories: 'Categories',
    faq: 'FAQ',
    blog: 'Blog',
    'blog-form': 'New Blog Post',
    legal: 'Legal Pages',
    coupons: 'Coupons',
    reviews: 'Reviews',
    'review-videos': 'Review Videos',
    banners: 'Banners',
    marketing: 'Marketing',
    messenger: 'Messenger Chats',
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
    if (!validPages.has(page) && page !== 'product-form' && page !== 'blog-form') return;
    const toSave = page === 'product-form' ? 'products' : page === 'blog-form' ? 'blog' : page;
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
    document.documentElement.classList.remove('admin-auth-restoring');
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('admin-page').style.display = 'none';
  }

  function logoutAdmin() {
    setAdminToken('');
    showLoginPanel();
  }

  function showAdmin() {
    document.documentElement.classList.add('admin-auth-restoring');
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
    applyAdminAccessUi();
  }

  function switchPage(page, opts = {}) {
    if (isProductEditorAdmin() && page !== 'products' && page !== 'product-form') {
      page = 'products';
    }
    if (!validPages.has(page) && page !== 'product-form' && page !== 'blog-form') page = isProductEditorAdmin() ? 'products' : 'dashboard';
    document.querySelectorAll('.adm-section').forEach((s) => s.classList.remove('active'));
    const sec = document.getElementById('sec-' + page);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.nav-item').forEach((n) => {
      const navPage = n.dataset.page;
      n.classList.toggle(
        'active',
        navPage === page ||
          (page === 'product-form' && navPage === 'products') ||
          (page === 'blog-form' && navPage === 'blog')
      );
    });
    updatePagesNavActive(page, opts.legalTab);
    const title = pageTitles[page] || page;
    document.getElementById('page-title').textContent = title;
    document.getElementById('breadcrumb-current').textContent = title;
    window.scrollTo(0, 0);
    if (page !== 'product-form' && page !== 'blog-form') saveActivePage(page);

    if (page === 'dashboard') loadDashboard();
    if (page === 'orders') loadOrders();
    if (page === 'appointments') loadAppointments();
    if (page === 'contacts') loadContactMessages();
    if (page === 'products') loadProducts();
    if (page === 'gallery') loadImageGallery();
    if (page === 'customers') loadCustomers();
    if (page === 'categories') loadCategories();
    if (page === 'faq') loadFaqs();
    if (page === 'blog') loadBlogPosts();
    if (page === 'coupons') loadCoupons();
    if (page === 'settings') loadSettings();
    if (page === 'legal') {
      loadLegalPages();
      if (opts.legalTab) switchLegalTab(opts.legalTab);
    }
    if (page === 'analytics') loadAnalytics();
    if (page === 'reviews') loadReviews();
    if (page === 'review-videos') loadReviewVideos();
    if (page === 'banners') loadBanners();
    if (page === 'marketing') loadMarketing();
    if (page === 'messenger') loadMessengerChats();
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
      switchPage(getStartAdminPage());
      return true;
    }

    const dash = await api('/dashboard');
    if (dash.ok) {
      const cached = getCachedAdminUser();
      if (cached) setAdminUI(cached);
      showAdmin();
      switchPage(getStartAdminPage());
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
      switchPage(getStartAdminPage());
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
    if (product) {
      await loadCategoriesList();
      const detail = await api('/products/' + product.id);
      if (detail.ok && detail.product) product = detail.product;
      setProductFormTitle('Edit Product');
      document.getElementById('pf-id').value = product.id;
      document.getElementById('pf-name').value = product.name_bn;
      const pfSlug = document.getElementById('pf-slug');
      if (pfSlug) pfSlug.value = product.slug || '';
      setProductCategoryPickers(categories, product.category_id);
      document.getElementById('pf-price').value = product.price;
      const pfBuy = document.getElementById('pf-buy-price');
      if (pfBuy) pfBuy.value = product.buy_price != null && product.buy_price !== '' ? product.buy_price : '';
      document.getElementById('pf-old-price').value = product.old_price || '';
      document.getElementById('pf-old-price').dataset.userEdited = product.old_price ? '1' : '';
      delete document.getElementById('pf-price')?.dataset.userEdited;
      const pfDisc = document.getElementById('pf-discount-percent');
      if (pfDisc) {
        const stored = Number(product.discount_percent);
        pfDisc.value = Number.isFinite(stored) && stored > 0 ? stored : '';
      }
      if (!pfDisc?.value) {
        document.getElementById('pf-old-price').value = '';
        delete document.getElementById('pf-old-price')?.dataset.userEdited;
      }
      syncProductPricing('load');
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
      await loadCategoriesList();
      setProductFormTitle('Add Product');
    }
    switchPage('product-form');
    setTimeout(() => {
      window.RakuRichEditor?.initProductEditors();
      document.getElementById('pf-name')?.focus();
    }, 50);
  }

  function closeProductForm() {
    window.RakuRichEditor?.destroy?.('pf-desc');
    window.RakuRichEditor?.destroy?.('pf-short-desc');
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
      document.getElementById('category-form-title').textContent = 'Main Category add korun';
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
    if (e.key === 'Escape' && document.getElementById('messenger-modal')?.classList.contains('open')) {
      closeMessengerModal();
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

  document.querySelectorAll('.nav-sub-item[data-page]').forEach((el) => {
    el.onclick = () => {
      const page = el.dataset.page;
      const legalTab = el.dataset.legalTab || null;
      switchPage(page, legalTab ? { legalTab } : {});
      if (window.innerWidth <= 900) closeAdminSidebar();
    };
  });

  const pagesNavToggle = document.getElementById('nav-pages-toggle');
  const pagesNavGroup = document.getElementById('nav-group-pages');
  if (pagesNavToggle && pagesNavGroup) {
    pagesNavToggle.onclick = () => {
      const open = pagesNavGroup.classList.toggle('open');
      pagesNavToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
  }

  function updatePagesNavActive(page, legalTab) {
    document.querySelectorAll('.nav-sub-item').forEach((el) => {
      const subPage = el.dataset.page;
      const subTab = el.dataset.legalTab || '';
      let active = false;
      if (page === 'faq' && subPage === 'faq') active = true;
      if (page === 'legal' && subPage === 'legal' && subTab === (legalTab || 'privacy')) active = true;
      el.classList.toggle('active', active);
    });
    if ((page === 'faq' || page === 'legal') && pagesNavGroup) {
      pagesNavGroup.classList.add('open');
      pagesNavToggle?.setAttribute('aria-expanded', 'true');
    }
  }

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.onclick = () => switchPage(el.dataset.goto);
  });

  // ——— Dashboard ———
  async function loadDashboardRecentOrders(page) {
    if (page) dashRecentOrdersPage = page;
    const data = await api(`/orders?page=${dashRecentOrdersPage}&limit=5`);
    const tbody = document.getElementById('dash-orders-tbody');
    if (!data.ok || !tbody) return;
    tbody.innerHTML = data.orders.length
      ? data.orders
          .map(
            (o) => `<tr>
        <td><b>${o.orderNumber}</b></td><td>${o.customerName}</td><td>${o.itemsPreview}</td>
        <td>${o.totalFormatted}</td><td>${statusBadgeHtml(o.status)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">No orders yet</td></tr>';

    const pag = data.pagination;
    const pagEl = document.getElementById('dash-orders-pagination');
    if (pagEl && pag) {
      pagEl.hidden = pag.pages <= 1;
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} orders)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-dash-op="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-dash-op="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-dash-op]').forEach((b) => {
        b.onclick = () => loadDashboardRecentOrders(dashRecentOrdersPage + Number(b.dataset.dashOp));
      });
    }
  }

  async function loadDashboard() {
    const data = await api('/dashboard');
    if (!data.ok) {
      toast(data.error || 'Could not load dashboard data', 'error');
      return;
    }

    const s = data.stats;
    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon" style="background:#E8F3EA;"><i class="ti ti-currency-taka" style="color:#2D6B32;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.monthRevenueFormatted}</div><div class="stat-label">Revenue (this month)</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="ti ti-shopping-bag" style="color:#1D9E75;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.pendingOrders}</div><div class="stat-label">Orders in progress</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="ti ti-users" style="color:#EF9F27;font-size:26px;"></i></div>
        <div><div class="stat-num">${s.totalCustomers}</div><div class="stat-label">Registered customers</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#FDE8EF;"><i class="ti ti-box" style="color:#E91E8C;font-size:26px;"></i></div>
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
    api('/review-videos?status=pending').then((d) => {
      if (d.ok && d.pendingCount != null) {
        const badge = document.getElementById('review-video-badge');
        if (badge) badge.textContent = d.pendingCount;
      }
    });

    await loadDashboardRecentOrders(dashRecentOrdersPage);

    drawCharts(data);

    const actEl = document.getElementById('dash-activity');
    if (actEl) {
      const icons = { order: 'ti-shopping-bag', user: 'ti-user-plus', alert: 'ti-alert-triangle', review: 'ti-star', contact: 'ti-mail' };
      const colors = { order: '#E8F3EA', user: '#dcfce7', alert: '#fee2e2', review: '#fef3c7', contact: '#dbeafe' };
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
      grad.addColorStop(0, '#2D6B32');
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
    const colors = { delivered: '#2D6B32', pending: '#EF9F27', confirmed: '#64748b', shipped: '#1D9E75', cancelled: '#E91E8C' };
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
  function updateOrdersSelectionUi() {
    const count = selectedOrderIds.size;
    const bulkBtn = document.getElementById('orders-bulk-delete-btn');
    const clearBtn = document.getElementById('orders-clear-selection-btn');
    const countEl = document.getElementById('orders-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncOrdersSelectAllCheckbox();
  }

  function syncOrdersSelectAllCheckbox() {
    const selectAll = document.getElementById('orders-select-all');
    const checks = [...document.querySelectorAll('#orders-tbody .order-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteOrder(id) {
    if (!confirm('Delete this order permanently? This cannot be undone.')) return;
    const data = await api('/orders/' + id, { method: 'DELETE' });
    if (data.ok) {
      toast('Order deleted');
      selectedOrderIds.delete(Number(id));
      updateOrdersSelectionUi();
      if (String(currentOrderId) === String(id)) {
        document.getElementById('order-modal')?.classList.remove('open');
        currentOrderId = null;
      }
      loadOrders();
      loadDashboard();
    } else {
      toast(data.error || 'Could not delete order', 'error');
    }
  }

  async function deleteSelectedOrders() {
    const ids = [...selectedOrderIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected order(s) permanently? This cannot be undone.`)) return;
    const data = await api('/orders/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      toast(`${data.deleted || ids.length} order(s) deleted`);
      if (currentOrderId && selectedOrderIds.has(Number(currentOrderId))) {
        document.getElementById('order-modal')?.classList.remove('open');
        currentOrderId = null;
      }
      selectedOrderIds.clear();
      updateOrdersSelectionUi();
      loadOrders();
      loadDashboard();
    } else {
      toast(data.error || 'Could not delete selected orders', 'error');
    }
  }

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
    document.getElementById('orders-tbody').innerHTML = data.orders.length
      ? data.orders
          .map((o) => {
            const checked = selectedOrderIds.has(Number(o.id)) ? ' checked' : '';
            const rowClass = checked ? ' class="row-selected"' : '';
            return `<tr${rowClass}>
        <td class="tbl-check-col"><input type="checkbox" class="order-row-check" data-order-id="${o.id}" aria-label="Select order ${escHtml(o.orderNumber)}"${checked}></td>
        <td><b>${escHtml(o.orderNumber)}</b></td><td>${escHtml(o.customerName)}<br><small style="color:#94a3b8">${escHtml(o.customerPhone)}</small></td>
        <td>${escHtml(o.itemsPreview)}</td><td>${escHtml(o.paymentMethod)}</td><td>${fmtDate(o.createdAt)}</td>
        <td>${escHtml(o.totalFormatted)}</td><td>${statusBadgeHtml(o.status)}</td>
        <td class="tbl-actions">
          <button type="button" class="btn btn-outline btn-xs" data-order-details="${o.id}">Details</button>
          <button type="button" class="btn btn-danger btn-xs" data-del-order="${o.id}" title="Delete order"><i class="ti ti-trash"></i> Delete</button>
        </td></tr>`;
          })
          .join('')
      : '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px;">No orders found</td></tr>';
    updateOrdersSelectionUi();

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

  document.getElementById('orders-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#orders-tbody .order-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.orderId);
      if (checked) selectedOrderIds.add(id);
      else selectedOrderIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateOrdersSelectionUi();
  });

  document.getElementById('orders-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedOrders();
  });

  document.getElementById('orders-clear-selection-btn')?.addEventListener('click', () => {
    selectedOrderIds.clear();
    document.querySelectorAll('#orders-tbody .order-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateOrdersSelectionUi();
  });

  const ordersTbody = document.getElementById('orders-tbody');
  if (ordersTbody && !ordersTbody._rakuOrderActionsBound) {
    ordersTbody._rakuOrderActionsBound = true;
    ordersTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.order-row-check');
      if (check) {
        const id = Number(check.dataset.orderId);
        if (check.checked) selectedOrderIds.add(id);
        else selectedOrderIds.delete(id);
        check.closest('tr')?.classList.toggle('row-selected', check.checked);
        updateOrdersSelectionUi();
        return;
      }
      const delBtn = e.target.closest('[data-del-order]');
      if (delBtn) {
        e.preventDefault();
        void deleteOrder(delBtn.dataset.delOrder);
        return;
      }
      const detailsBtn = e.target.closest('[data-order-details]');
      if (detailsBtn) openOrderModal(detailsBtn.dataset.orderDetails);
    });
  }

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

    if (!data.appointments?.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">No appointments yet.</td></tr>';
      updateAppointmentsSelectionUi();
    } else {
      tbody.innerHTML = (data.appointments || [])
        .map(
          (a) => {
            const notesRaw = String(a.notes || '').trim();
            const notesHtml = notesRaw
              ? `<span title="${escHtml(notesRaw)}">${escHtml(notesRaw.length > 100 ? notesRaw.slice(0, 100) + '…' : notesRaw)}</span>`
              : '<span style="color:#94a3b8">—</span>';
            const checked = selectedAppointmentIds.has(Number(a.id)) ? ' checked' : '';
            const rowClass = checked ? ' class="row-selected"' : '';
            return `<tr${rowClass}>
        <td class="tbl-check-col"><input type="checkbox" class="appointment-row-check" data-appointment-id="${a.id}" aria-label="Select appointment ${escHtml(a.referenceNumber)}"${checked}></td>
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
          <button type="button" class="btn btn-danger btn-xs" data-del-appointment="${a.id}" style="margin-top:6px;"><i class="ti ti-trash"></i> Delete</button>
        </td></tr>`;
          }
        )
        .join('');
      updateAppointmentsSelectionUi();
    }

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

    tbody.querySelectorAll('[data-del-appointment]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this appointment?')) return;
        const id = Number(btn.dataset.delAppointment);
        const res = await api('/appointments/' + id, { method: 'DELETE' });
        if (res.ok) {
          toast('Appointment deleted');
          selectedAppointmentIds.delete(id);
          updateAppointmentsSelectionUi();
          loadAppointments();
        } else toast(res.error || 'Delete failed', 'error');
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

  function updateAppointmentsSelectionUi() {
    const count = selectedAppointmentIds.size;
    const bulkBtn = document.getElementById('appointments-bulk-delete-btn');
    const clearBtn = document.getElementById('appointments-clear-selection-btn');
    const countEl = document.getElementById('appointments-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncAppointmentsSelectAllCheckbox();
  }

  function syncAppointmentsSelectAllCheckbox() {
    const selectAll = document.getElementById('appointments-select-all');
    const checks = [...document.querySelectorAll('#appointments-tbody .appointment-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteSelectedAppointments() {
    const ids = [...selectedAppointmentIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected appointment(s) permanently? This cannot be undone.`)) return;
    const data = await api('/appointments/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      toast(`${data.deleted || ids.length} appointment(s) deleted`);
      selectedAppointmentIds.clear();
      updateAppointmentsSelectionUi();
      loadAppointments();
    } else {
      toast(data.error || 'Could not delete selected appointments', 'error');
    }
  }

  document.getElementById('appointments-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#appointments-tbody .appointment-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.appointmentId);
      if (checked) selectedAppointmentIds.add(id);
      else selectedAppointmentIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateAppointmentsSelectionUi();
  });

  document.getElementById('appointments-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedAppointments();
  });

  document.getElementById('appointments-clear-selection-btn')?.addEventListener('click', () => {
    selectedAppointmentIds.clear();
    document.querySelectorAll('#appointments-tbody .appointment-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateAppointmentsSelectionUi();
  });

  const appointmentsTbody = document.getElementById('appointments-tbody');
  if (appointmentsTbody && !appointmentsTbody._rakuAppointmentActionsBound) {
    appointmentsTbody._rakuAppointmentActionsBound = true;
    appointmentsTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.appointment-row-check');
      if (!check) return;
      const id = Number(check.dataset.appointmentId);
      if (check.checked) selectedAppointmentIds.add(id);
      else selectedAppointmentIds.delete(id);
      check.closest('tr')?.classList.toggle('row-selected', check.checked);
      updateAppointmentsSelectionUi();
    });
  }

  document.getElementById('appointments-status-filter')?.addEventListener('change', () => loadAppointments(1));
  document.getElementById('appointments-search')?.addEventListener('input', debounce(() => loadAppointments(1), 400));

  function updateContactsSelectionUi() {
    const count = selectedContactIds.size;
    const bulkBtn = document.getElementById('contacts-bulk-delete-btn');
    const clearBtn = document.getElementById('contacts-clear-selection-btn');
    const countEl = document.getElementById('contacts-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncContactsSelectAllCheckbox();
  }

  function syncContactsSelectAllCheckbox() {
    const selectAll = document.getElementById('contacts-select-all');
    const checks = [...document.querySelectorAll('#contacts-tbody .contact-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteContactMessage(id) {
    if (!confirm('Delete this message permanently?')) return;
    const data = await api('/contact-messages/' + id, { method: 'DELETE' });
    if (data.ok) {
      toast('Message deleted');
      selectedContactIds.delete(Number(id));
      updateContactsSelectionUi();
      loadContactMessages();
    } else {
      toast(data.error || 'Could not delete message', 'error');
    }
  }

  async function deleteSelectedContactMessages() {
    const ids = [...selectedContactIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected message(s) permanently? This cannot be undone.`)) return;
    const data = await api('/contact-messages/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      toast(`${data.deleted || ids.length} message(s) deleted`);
      selectedContactIds.clear();
      updateContactsSelectionUi();
      loadContactMessages();
    } else {
      toast(data.error || 'Could not delete selected messages', 'error');
    }
  }

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
        '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">No contact messages yet.</td></tr>';
    } else {
      tbody.innerHTML = data.messages
        .map((m) => {
          const preview = escHtml(String(m.message || '').slice(0, 120));
          const full = escHtml(m.message || '');
          const emailLine = m.customerEmail
            ? `<br><small style="color:#94a3b8">${escHtml(m.customerEmail)}</small>`
            : '';
          const checked = selectedContactIds.has(Number(m.id)) ? ' checked' : '';
          const rowClass = checked ? ' class="row-selected"' : '';
          return `<tr${rowClass}>
        <td class="tbl-check-col"><input type="checkbox" class="contact-row-check" data-contact-id="${m.id}" aria-label="Select message from ${escHtml(m.customerName)}"${checked}></td>
        <td><b>${escHtml(m.customerName)}</b><br><small style="color:#94a3b8">${escHtml(m.customerPhone)}</small>${emailLine}</td>
        <td>${escHtml(m.subjectLabel || m.subject)}</td>
        <td><span title="${full}">${preview}${String(m.message || '').length > 120 ? '…' : ''}</span></td>
        <td>${fmtDate(m.createdAt)}</td>
        <td>${contactStatusBadge(m.status)}</td>
        <td class="tbl-actions">
          <button type="button" class="btn btn-danger btn-xs" data-del-contact="${m.id}" title="Delete message"><i class="ti ti-trash"></i> Delete</button>
        </td></tr>`;
        })
        .join('');
    }
    updateContactsSelectionUi();

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

  document.getElementById('contacts-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#contacts-tbody .contact-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.contactId);
      if (checked) selectedContactIds.add(id);
      else selectedContactIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateContactsSelectionUi();
  });

  document.getElementById('contacts-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedContactMessages();
  });

  document.getElementById('contacts-clear-selection-btn')?.addEventListener('click', () => {
    selectedContactIds.clear();
    document.querySelectorAll('#contacts-tbody .contact-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateContactsSelectionUi();
  });

  const contactsTbody = document.getElementById('contacts-tbody');
  if (contactsTbody && !contactsTbody._rakuContactActionsBound) {
    contactsTbody._rakuContactActionsBound = true;
    contactsTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.contact-row-check');
      if (check) {
        const id = Number(check.dataset.contactId);
        if (check.checked) selectedContactIds.add(id);
        else selectedContactIds.delete(id);
        check.closest('tr')?.classList.toggle('row-selected', check.checked);
        updateContactsSelectionUi();
        return;
      }
      const delBtn = e.target.closest('[data-del-contact]');
      if (delBtn) {
        e.preventDefault();
        void deleteContactMessage(delBtn.dataset.delContact);
      }
    });
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

  let heroSliderSlides = [];

  function parseHeroSliderSlides(raw) {
    try {
      if (typeof raw === 'string' && raw.trim()) return JSON.parse(raw);
      if (Array.isArray(raw)) return raw;
    } catch (_) {}
    return [];
  }

  function readHeroSliderSlidesFromDom() {
    return heroSliderSlides.map((slide, i) => {
      const imageEl = document.querySelector(`.hero-slider-image[data-index="${i}"]`);
      const linkEl = document.querySelector(`.hero-slider-link[data-index="${i}"]`);
      const altEl = document.querySelector(`.hero-slider-alt[data-index="${i}"]`);
      return {
        image: imageEl?.value.trim() || slide.image || '',
        link: linkEl?.value.trim() || slide.link || '',
        alt: altEl?.value.trim() || slide.alt || '',
        pendingFile: slide.pendingFile || null,
      };
    });
  }

  function renderHeroSliderSlides() {
    const root = document.getElementById('hero-slider-slides');
    if (!root) return;
    root.innerHTML = heroSliderSlides
      .map(
        (slide, i) => `
      <div class="card hero-slider-admin-row" data-index="${i}" style="margin-top:12px;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong>Slide ${i + 1}</strong>
          <button type="button" class="btn btn-outline btn-sm hero-slider-remove" data-index="${i}"><i class="ti ti-trash"></i> Remove</button>
        </div>
        <div class="form-group">
          <label class="form-label">Image</label>
          <input class="form-input hero-slider-image" data-index="${i}" value="${escHtml(slide.image || '')}" placeholder="/uploads/... or https://...">
          <input class="form-input hero-slider-file" data-index="${i}" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style="margin-top:8px;">
          ${
            slide.image
              ? `<img class="hero-slider-preview" data-index="${i}" src="${escHtml(slide.image)}" alt="" style="max-width:100%;max-height:140px;margin-top:8px;border-radius:8px;border:1px solid var(--border);object-fit:cover;">`
              : `<img class="hero-slider-preview" data-index="${i}" alt="" hidden style="max-width:100%;max-height:140px;margin-top:8px;border-radius:8px;border:1px solid var(--border);object-fit:cover;">`
          }
        </div>
        <div class="form-2col">
          <div class="form-group"><label class="form-label">Link (optional)</label><input class="form-input hero-slider-link" data-index="${i}" value="${escHtml(slide.link || '')}" placeholder="/category/skincare or #products"></div>
          <div class="form-group"><label class="form-label">Alt text</label><input class="form-input hero-slider-alt" data-index="${i}" value="${escHtml(slide.alt || '')}" placeholder="Promo image description"></div>
        </div>
      </div>`
      )
      .join('');
  }

  function loadHeroSliderFromSettings(s) {
    const en = document.getElementById('hero-slider-enabled');
    if (en) en.checked = s.hero_side_slider_enabled !== '0';
    const intervalEl = document.getElementById('hero-slider-interval');
    if (intervalEl) intervalEl.value = (Number(s.hero_side_slider_interval) || 4500) / 1000;
    heroSliderSlides = parseHeroSliderSlides(s.hero_side_slides).map((slide) => ({
      image: slide.image || slide.imageUrl || '',
      link: slide.link || slide.linkUrl || '',
      alt: slide.alt || slide.title || '',
      pendingFile: null,
    }));
    if (!heroSliderSlides.length) {
      heroSliderSlides.push({ image: '', link: '', alt: '', pendingFile: null });
    }
    renderHeroSliderSlides();
  }

  function collectHeroSliderSettings() {
    const slides = readHeroSliderSlidesFromDom();
    const intervalSec = Number(document.getElementById('hero-slider-interval')?.value) || 4.5;
    return {
      enabled: document.getElementById('hero-slider-enabled')?.checked ? '1' : '0',
      intervalMs: Math.round(Math.max(3, Math.min(12, intervalSec)) * 1000),
      slides: slides.map(({ image, link, alt }) => ({ image, link, alt })),
      pendingFiles: slides.map((s) => s.pendingFile),
    };
  }

  function parseTodayDealsProductIds(raw) {
    try {
      if (typeof raw === 'string' && raw.trim()) return JSON.parse(raw);
      if (Array.isArray(raw)) return raw;
    } catch (_) {}
    return [];
  }

  function toDatetimeLocalValue(iso) {
    const raw = String(iso || '').trim();
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimeZoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function renderTodayDealsProductChecks(products, selectedIds) {
    const root = document.getElementById('today-deals-products');
    if (!root) return;
    const selected = new Set((selectedIds || []).map(Number));
    if (!products.length) {
      root.innerHTML = '<p class="form-hint">No products found.</p>';
      return;
    }
    root.innerHTML = products
      .map((p) => {
        const checked = selected.has(Number(p.id)) ? ' checked' : '';
        return `<label class="form-label" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
          <input type="checkbox" class="td-product-check" value="${p.id}"${checked}>
          <span>${escHtml(p.name_bn)}${p.sku ? ` <small style="color:var(--text-muted);">(${escHtml(p.sku)})</small>` : ''}</span>
        </label>`;
      })
      .join('');
  }

  async function loadTodayDealsFromSettings(s) {
    const en = document.getElementById('td-enabled');
    if (en) en.checked = s.today_deals_enabled !== '0';
    const titleEl = document.getElementById('td-title');
    if (titleEl) titleEl.value = s.today_deals_title || 'Today Deals';
    const endsEl = document.getElementById('td-ends-at');
    if (endsEl) endsEl.value = toDatetimeLocalValue(s.today_deals_ends_at);
    const selectedIds = parseTodayDealsProductIds(s.today_deals_product_ids);
    const prodData = await api('/products?limit=200&page=1');
    renderTodayDealsProductChecks(prodData.ok ? prodData.products || [] : [], selectedIds);
  }

  function collectTodayDealsSettings() {
    const ids = [...document.querySelectorAll('.td-product-check:checked')]
      .map((el) => Number(el.value))
      .filter(Boolean)
      .slice(0, 12);
    const dt = document.getElementById('td-ends-at')?.value || '';
    let endsAt = '';
    if (dt) {
      const parsed = new Date(dt);
      if (!Number.isNaN(parsed.getTime())) endsAt = parsed.toISOString();
    }
    return {
      enabled: document.getElementById('td-enabled')?.checked ? '1' : '0',
      title: document.getElementById('td-title')?.value.trim() || 'Today Deals',
      endsAt,
      productIds: ids,
    };
  }

  function collectMarketingSettings() {
    return {
      marketing_enabled: document.getElementById('mkt-enabled')?.checked ? '1' : '0',
      marketing_card1_title: document.getElementById('mkt1-title')?.value.trim() || '',
      marketing_card1_desc: document.getElementById('mkt1-desc')?.value.trim() || '',
      marketing_card1_btn: document.getElementById('mkt1-btn')?.value.trim() || '',
      marketing_card1_link: document.getElementById('mkt1-link')?.value.trim() || '#products',
      marketing_card1_image: document.getElementById('mkt1-image')?.value.trim() || '',
      marketing_card1_bg: document.getElementById('mkt1-bg')?.value.trim() || '#FDE8EF',
      marketing_card2_title: document.getElementById('mkt2-title')?.value.trim() || '',
      marketing_card2_desc: document.getElementById('mkt2-desc')?.value.trim() || '',
      marketing_card2_btn: document.getElementById('mkt2-btn')?.value.trim() || 'Submit',
      marketing_card2_image: document.getElementById('mkt2-image')?.value.trim() || '',
      marketing_card2_bg: document.getElementById('mkt2-bg')?.value.trim() || '#E8F3EA',
    };
  }

  const POPUP_DEFAULT_TEMPLATES = [
    {
      id: 'gift',
      enabled: true,
      kicker: 'Exclusive offer',
      badge: 'Surprise gift',
      icon: 'ti-gift',
      title: 'Get Surprise gift',
      desc: 'Subscribe with your phone number to get new gifts and updates about our new products and offers',
      button: 'Submit',
      image: '/uploads/1780840201433-surprise-banner.webp',
      mode: 'subscribe',
      link: '',
    },
    {
      id: 'points',
      enabled: true,
      kicker: 'Reward points',
      badge: 'Earn points',
      icon: 'ti-award',
      title: 'Reward Points is live',
      desc: 'Earn points on signup, first order, and approved reviews. Use your points to save on future orders.',
      button: 'Sign up now',
      image: '',
      mode: 'link',
      link: '/account?signup=1',
    },
    {
      id: 'delivery',
      enabled: true,
      kicker: 'Delivery update',
      badge: 'Fast delivery',
      icon: 'ti-truck-delivery',
      title: 'We deliver all over Bangladesh',
      desc: 'Track your order any time and get support on WhatsApp.',
      button: 'Track order',
      image: '',
      mode: 'link',
      link: '/track',
    },
    {
      id: 'new',
      enabled: false,
      kicker: 'New arrivals',
      badge: 'Just dropped',
      icon: 'ti-sparkles',
      title: 'New products every week',
      desc: 'Check our latest arrivals and limited deals on the homepage.',
      button: 'Browse',
      image: '',
      mode: 'link',
      link: '/#products',
    },
    {
      id: 'support',
      enabled: false,
      kicker: 'Need help?',
      badge: 'Customer care',
      icon: 'ti-message-circle-2',
      title: 'Ask anything before you buy',
      desc: 'We reply fast on Messenger and WhatsApp for product questions.',
      button: 'Contact us',
      image: '',
      mode: 'link',
      link: '/contact',
    },
  ];

  const POPUP_TEMPLATE_COUNT = POPUP_DEFAULT_TEMPLATES.length;

  function parsePopupTemplates(raw) {
    try {
      if (typeof raw === 'string' && raw.trim()) return JSON.parse(raw);
      if (Array.isArray(raw)) return raw;
    } catch (_) {}
    return [];
  }

  function popupTemplateIsLinkMode(tpl) {
    if (!tpl) return false;
    if (String(tpl.id) === 'points') return true;
    return String(tpl.mode) === 'link';
  }

  function normalizePopupTemplates(raw) {
    const saved = parsePopupTemplates(raw);
    return POPUP_DEFAULT_TEMPLATES.map((def, i) => {
      const found = saved.find((t) => t && t.id === def.id) || saved[i];
      if (!found || typeof found !== 'object') return { ...def };
      const merged = { ...def, ...found, id: def.id };
      if (merged.id === 'points') {
        merged.mode = 'link';
        merged.link = String(merged.link || def.link || '/account?signup=1').trim() || '/account?signup=1';
        merged.button = String(merged.button || def.button || 'Sign up now').trim() || 'Sign up now';
      }
      return merged;
    });
  }

  function syncPopupTemplateModeFields() {
    for (let i = 0; i < POPUP_TEMPLATE_COUNT; i++) {
      const mode = document.getElementById(`popup-tpl-${i}-mode`)?.value || 'subscribe';
      const linkWrap = document.getElementById(`popup-tpl-${i}-link-wrap`);
      if (linkWrap) linkWrap.hidden = mode !== 'link';
    }
  }

  function fillPopupTemplateForm(i, t) {
    const tpl = t || POPUP_DEFAULT_TEMPLATES[i];
    const en = document.getElementById(`popup-tpl-${i}-enabled`);
    if (en) en.checked = tpl.enabled !== false;
    const set = (suffix, val) => {
      const el = document.getElementById(`popup-tpl-${i}-${suffix}`);
      if (el) el.value = String(val ?? '');
    };
    set('kicker', tpl.kicker);
    set('badge', tpl.badge);
    set('title', tpl.title);
    set('desc', tpl.desc);
    set('button', tpl.button);
    set('image', tpl.image);
    set('link', tpl.link);
    const modeEl = document.getElementById(`popup-tpl-${i}-mode`);
    if (modeEl) {
      const linkMode = tpl.id === 'points' || tpl.mode === 'link';
      modeEl.value = linkMode ? 'link' : 'subscribe';
      if (tpl.id === 'points') modeEl.disabled = true;
      else modeEl.disabled = false;
    }
    const iconEl = document.getElementById(`popup-tpl-${i}-icon`);
    if (iconEl) iconEl.value = tpl.icon || POPUP_DEFAULT_TEMPLATES[i].icon;
    setMktImagePreview(`popup-tpl-${i}-preview-wrap`, `popup-tpl-${i}-preview`, tpl.image);
    const fileEl = document.getElementById(`popup-tpl-${i}-file`);
    if (fileEl) fileEl.value = '';
  }

  function popupDefaultsFromSettings(s) {
    return {
      popup_enabled: s?.popup_enabled ?? '1',
      popup_interval_hours: s?.popup_interval_hours ?? '24',
      popup_active_template: s?.popup_active_template ?? 'gift',
      popup_templates: s?.popup_templates ?? '[]',
    };
  }

  function fillPopupSettings(s) {
    const d = popupDefaultsFromSettings(s);
    const en = document.getElementById('popup-enabled');
    if (en) en.checked = String(d.popup_enabled ?? '1') !== '0';
    const interval = document.getElementById('popup-interval-hours');
    if (interval) interval.value = String(Number(d.popup_interval_hours || 24) || 24);
    livePopupTemplateId = String(d.popup_active_template || 'gift').trim() || 'gift';
    const templates = normalizePopupTemplates(d.popup_templates);
    templates.forEach((t, i) => fillPopupTemplateForm(i, t));
    const liveIdx = POPUP_DEFAULT_TEMPLATES.findIndex((t) => t.id === livePopupTemplateId);
    switchPopupTab(liveIdx >= 0 ? liveIdx : 0);
  }

  function collectPopupTemplateFromForm(i) {
    const def = POPUP_DEFAULT_TEMPLATES[i];
    let mode = document.getElementById(`popup-tpl-${i}-mode`)?.value === 'link' ? 'link' : 'subscribe';
    if (def.id === 'points') mode = 'link';
    const tpl = {
      id: def.id,
      enabled: document.getElementById(`popup-tpl-${i}-enabled`)?.checked !== false,
      kicker: document.getElementById(`popup-tpl-${i}-kicker`)?.value.trim() || def.kicker,
      badge: document.getElementById(`popup-tpl-${i}-badge`)?.value.trim() || def.badge,
      icon: document.getElementById(`popup-tpl-${i}-icon`)?.value.trim() || def.icon,
      title: document.getElementById(`popup-tpl-${i}-title`)?.value.trim() || def.title,
      desc: document.getElementById(`popup-tpl-${i}-desc`)?.value.trim() || def.desc,
      button: document.getElementById(`popup-tpl-${i}-button`)?.value.trim() || def.button,
      image: document.getElementById(`popup-tpl-${i}-image`)?.value.trim() || '',
      mode,
    };
    if (mode === 'link') {
      tpl.link = document.getElementById(`popup-tpl-${i}-link`)?.value.trim() || def.link || '/';
    }
    return tpl;
  }

  function collectPopupSettings() {
    const templates = [];
    for (let i = 0; i < POPUP_TEMPLATE_COUNT; i++) {
      templates.push(collectPopupTemplateFromForm(i));
    }
    const activeId = POPUP_DEFAULT_TEMPLATES[activePopupTabIdx]?.id || 'gift';
    templates[activePopupTabIdx].enabled = true;
    const activeToggle = document.getElementById(`popup-tpl-${activePopupTabIdx}-enabled`);
    if (activeToggle) activeToggle.checked = true;
    return {
      popup_enabled: document.getElementById('popup-enabled')?.checked ? '1' : '0',
      popup_interval_hours: String(Number(document.getElementById('popup-interval-hours')?.value || 24) || 24),
      popup_active_template: activeId,
      popup_templates: JSON.stringify(templates),
    };
  }

  let activePopupTabIdx = 0;
  let livePopupTemplateId = 'gift';

  function switchPopupTab(idx) {
    const safeIdx = Math.max(0, Math.min(POPUP_TEMPLATE_COUNT - 1, Number(idx) || 0));
    activePopupTabIdx = safeIdx;
    document.querySelectorAll('.popup-template-tab').forEach((el) => {
      const on = Number(el.dataset.popupTab) === safeIdx;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.popup-template-panel').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.popupPanel) === safeIdx);
    });
    syncPopupTemplateModeFields();
    updatePopupLivePreview();
    updatePopupLiveTabBadges();
  }

  function updatePopupLiveTabBadges() {
    document.querySelectorAll('.popup-template-tab').forEach((el) => {
      const i = Number(el.dataset.popupTab);
      const id = POPUP_DEFAULT_TEMPLATES[i]?.id;
      let badge = el.querySelector('.popup-tab-live-badge');
      if (id === livePopupTemplateId) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'popup-tab-live-badge';
          badge.textContent = 'Live';
          el.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function popupIconClass(icon) {
    const raw = String(icon || 'ti-gift').trim();
    return raw.startsWith('ti ') ? raw : `ti ${raw}`;
  }

  function applyPopupPreviewTheme(tpl) {
    const themeId = String(tpl?.id || 'gift').trim() || 'gift';
    const card = document.getElementById('popup-prev-card');
    const stage = document.getElementById('popup-live-preview-stage');
    if (card) card.dataset.popupTheme = themeId;
    if (stage) stage.dataset.popupTheme = themeId;

    const iconClass = popupIconClass(tpl?.icon);
    const src = String(tpl?.image || '').trim();
    const showHero = themeId === 'points' || themeId === 'support';
    const themeIcon = document.getElementById('popup-prev-theme-icon');
    if (themeIcon) {
      themeIcon.hidden = !showHero;
      if (showHero) themeIcon.innerHTML = `<i class="${iconClass}"></i>`;
    }

    const img = document.getElementById('popup-prev-img');
    if (img && !src && (themeId === 'delivery' || themeId === 'new')) {
      img.innerHTML = `<i class="${iconClass}"></i>`;
    }
  }

  function paintPopupLivePreview(tpl) {
    const kicker = document.getElementById('popup-prev-kicker');
    const badge = document.getElementById('popup-prev-badge');
    const badgeIcon = document.getElementById('popup-prev-badge-icon');
    const title = document.getElementById('popup-prev-title');
    const desc = document.getElementById('popup-prev-desc');
    const button = document.getElementById('popup-prev-button');
    const img = document.getElementById('popup-prev-img');
    const form = document.getElementById('popup-prev-form');
    const phoneField = form?.querySelector('.popup-prev-field');

    if (kicker) kicker.textContent = tpl.kicker || '';
    if (badge) badge.textContent = tpl.badge || '';
    if (badgeIcon) {
      const icon = String(tpl.icon || 'ti-gift').trim();
      badgeIcon.className = icon.startsWith('ti ') ? icon : `ti ${icon}`;
    }
    if (title) title.textContent = tpl.title || '';
    if (desc) desc.textContent = tpl.desc || '';
    if (button) button.textContent = tpl.button || 'Submit';

    const src = String(tpl.image || '').trim();
    if (img) {
      if (src) img.innerHTML = `<img src="${src.replace(/"/g, '&quot;')}" alt="">`;
      else img.innerHTML = '<i class="ti ti-photo"></i>';
    }

    const isSubscribe = !popupTemplateIsLinkMode(tpl);
    if (phoneField) {
      phoneField.hidden = !isSubscribe;
      phoneField.style.display = isSubscribe ? '' : 'none';
      phoneField.classList.toggle('popup-prev-field--hidden', !isSubscribe);
    }
    if (form) form.style.display = '';
    const note = document.getElementById('popup-prev-note');
    if (note) {
      note.hidden = !isSubscribe;
      note.style.display = isSubscribe ? '' : 'none';
    }
    applyPopupPreviewTheme(tpl);
  }

  function updatePopupLivePreview() {
    const tpl = collectPopupTemplateFromForm(activePopupTabIdx);
    const fileEl = document.getElementById(`popup-tpl-${activePopupTabIdx}-file`);
    const pending = fileEl?.files?.[0];
    if (pending && !tpl.image) tpl.image = URL.createObjectURL(pending);
    paintPopupLivePreview(tpl);
  }

  function openPopupFullscreenPreview() {
    updatePopupLivePreview();
    const modal = document.getElementById('popup-preview-modal');
    const modalStage = document.getElementById('popup-preview-modal-stage');
    const stage = document.getElementById('popup-live-preview-stage');
    if (modalStage && stage) modalStage.innerHTML = stage.innerHTML;
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('popup-preview-modal-open');
  }

  function closePopupFullscreenPreview() {
    const modal = document.getElementById('popup-preview-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('popup-preview-modal-open');
  }

  function openPopupSitePreview() {
    updatePopupLivePreview();
    const tpl = collectPopupTemplateFromForm(activePopupTabIdx);
    const fileEl = document.getElementById(`popup-tpl-${activePopupTabIdx}-file`);
    const pending = fileEl?.files?.[0];
    if (pending && !tpl.image) tpl.image = URL.createObjectURL(pending);
    const id = tpl.id || POPUP_DEFAULT_TEMPLATES[activePopupTabIdx]?.id || 'gift';
    try {
      sessionStorage.setItem(
        'raku_popup_preview_draft',
        JSON.stringify({ id, template: tpl, ts: Date.now() })
      );
    } catch (_) {}
    window.open(`/?popup_preview=1&popup_template=${encodeURIComponent(id)}`, '_blank', 'noopener');
  }

  const POPUP_PREVIEW_FIELD_SUFFIXES = ['kicker', 'badge', 'title', 'desc', 'button', 'image', 'link', 'icon'];

  function initPopupTemplateEditor() {
    document.getElementById('popup-template-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.popup-template-tab');
      if (!tab) return;
      switchPopupTab(Number(tab.dataset.popupTab) || 0);
    });

    for (let i = 0; i < POPUP_TEMPLATE_COUNT; i++) {
      const onFieldChange = () => {
        if (activePopupTabIdx === i) updatePopupLivePreview();
      };
      document.getElementById(`popup-tpl-${i}-mode`)?.addEventListener('change', () => {
        syncPopupTemplateModeFields();
        onFieldChange();
      });
      document.getElementById(`popup-tpl-${i}-enabled`)?.addEventListener('change', onFieldChange);
      POPUP_PREVIEW_FIELD_SUFFIXES.forEach((suffix) => {
        document.getElementById(`popup-tpl-${i}-${suffix}`)?.addEventListener('input', onFieldChange);
        document.getElementById(`popup-tpl-${i}-${suffix}`)?.addEventListener('change', onFieldChange);
      });
      document.getElementById(`popup-tpl-${i}-image`)?.addEventListener('input', (e) => {
        setMktImagePreview(`popup-tpl-${i}-preview-wrap`, `popup-tpl-${i}-preview`, e.target.value);
        onFieldChange();
      });
      document.getElementById(`popup-tpl-${i}-file`)?.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setMktImagePreview(`popup-tpl-${i}-preview-wrap`, `popup-tpl-${i}-preview`, URL.createObjectURL(f));
        onFieldChange();
      });
    }

    document.getElementById('popup-fullscreen-preview-btn')?.addEventListener('click', openPopupFullscreenPreview);
    document.getElementById('popup-site-preview-btn')?.addEventListener('click', openPopupSitePreview);
    document.querySelectorAll('[data-close-popup-preview]').forEach((el) => {
      el.addEventListener('click', closePopupFullscreenPreview);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePopupFullscreenPreview();
    });
  }

  initPopupTemplateEditor();

  async function loadMarketing() {
    const data = await api('/settings');
    if (data.ok && data.settings) {
      const s = data.settings;
      window._lastSettingsCache = { ...(window._lastSettingsCache || {}), ...s };
      loadHeroSliderFromSettings(s);
      await loadTodayDealsFromSettings(s);
      const en = document.getElementById('mkt-enabled');
      if (en) en.checked = s.marketing_enabled !== '0';
      document.getElementById('mkt1-title').value = s.marketing_card1_title || '';
      document.getElementById('mkt1-desc').value = s.marketing_card1_desc || '';
      document.getElementById('mkt1-btn').value = s.marketing_card1_btn || '';
      document.getElementById('mkt1-link').value = s.marketing_card1_link || '';
      document.getElementById('mkt1-image').value = s.marketing_card1_image || '';
      document.getElementById('mkt1-bg').value = s.marketing_card1_bg || '#FDE8EF';
      setMktImagePreview('mkt1-preview-wrap', 'mkt1-preview', s.marketing_card1_image);
      const mkt1File = document.getElementById('mkt1-file');
      if (mkt1File) mkt1File.value = '';
      document.getElementById('mkt2-title').value = s.marketing_card2_title || '';
      document.getElementById('mkt2-desc').value = s.marketing_card2_desc || '';
      document.getElementById('mkt2-btn').value = s.marketing_card2_btn || 'Submit';
      document.getElementById('mkt2-image').value = s.marketing_card2_image || '';
      document.getElementById('mkt2-bg').value = s.marketing_card2_bg || '#E8F3EA';
      setMktImagePreview('mkt2-preview-wrap', 'mkt2-preview', s.marketing_card2_image);
      const mkt2File = document.getElementById('mkt2-file');
      if (mkt2File) mkt2File.value = '';
      fillPopupSettings(s);
    } else {
      loadHeroSliderFromSettings({});
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

  document.getElementById('hero-slider-slides')?.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.classList.contains('hero-slider-image')) return;
    const i = Number(t.dataset.index);
    const preview = document.querySelector(`.hero-slider-preview[data-index="${i}"]`);
    const src = t.value.trim();
    if (preview) {
      if (src) {
        preview.src = src;
        preview.hidden = false;
      } else {
        preview.removeAttribute('src');
        preview.hidden = true;
      }
    }
  });

  document.getElementById('hero-slider-slides')?.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.classList.contains('hero-slider-file')) return;
    const i = Number(t.dataset.index);
    const file = t.files?.[0];
    if (!file || !heroSliderSlides[i]) return;
    heroSliderSlides[i].pendingFile = file;
    const preview = document.querySelector(`.hero-slider-preview[data-index="${i}"]`);
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    }
  });

  document.getElementById('hero-slider-slides')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.hero-slider-remove');
    if (!btn) return;
    const i = Number(btn.dataset.index);
    heroSliderSlides = readHeroSliderSlidesFromDom();
    heroSliderSlides.splice(i, 1);
    if (!heroSliderSlides.length) {
      heroSliderSlides.push({ image: '', link: '', alt: '', pendingFile: null });
    }
    renderHeroSliderSlides();
  });

  document.getElementById('hero-slider-add-btn')?.addEventListener('click', () => {
    heroSliderSlides = readHeroSliderSlidesFromDom();
    heroSliderSlides.push({ image: '', link: '', alt: '', pendingFile: null });
    renderHeroSliderSlides();
  });

  document.getElementById('hero-slider-save-btn')?.addEventListener('click', async () => {
    heroSliderSlides = readHeroSliderSlidesFromDom();
    for (let i = 0; i < heroSliderSlides.length; i++) {
      const file = heroSliderSlides[i].pendingFile;
      if (!file) continue;
      const up = await uploadProductImage(file);
      if (!up.ok) {
        toast(up.error || `Slide ${i + 1} upload failed`, 'error');
        return;
      }
      heroSliderSlides[i].image = up.url;
      heroSliderSlides[i].pendingFile = null;
    }

    const payload = collectHeroSliderSettings();
    payload.slides = heroSliderSlides.map(({ image, link, alt }) => ({ image, link, alt }));
    const data = await api('/hero-side-slider', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (data.ok) {
      toast('Hero slider saved');
      renderHeroSliderSlides();
    } else toast(data.error || 'Save failed', 'error');
  });

  document.getElementById('today-deals-save-btn')?.addEventListener('click', async () => {
    const payload = collectTodayDealsSettings();
    const data = await api('/today-deals', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (data.ok) toast('Today Deals saved');
    else toast(data.error || 'Save failed', 'error');
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

  document.getElementById('popup-save-btn')?.addEventListener('click', async () => {
    try {
      for (let i = 0; i < POPUP_TEMPLATE_COUNT; i++) {
        const f = document.getElementById(`popup-tpl-${i}-file`)?.files?.[0];
        if (!f) continue;
        const up = await uploadProductImage(f);
        if (!up.ok) {
          toast(up.error || `Template ${i + 1} image upload failed`, 'error');
          return;
        }
        const imgInput = document.getElementById(`popup-tpl-${i}-image`);
        if (imgInput) imgInput.value = up.url;
        document.getElementById(`popup-tpl-${i}-file`).value = '';
        setMktImagePreview(`popup-tpl-${i}-preview-wrap`, `popup-tpl-${i}-preview`, up.url);
      }

      const settings = collectPopupSettings();
      const data = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
      if (data.ok) {
        livePopupTemplateId = settings.popup_active_template || livePopupTemplateId;
        window._lastSettingsCache = { ...(window._lastSettingsCache || {}), ...settings, ...(data.settings || {}) };
        updatePopupLiveTabBadges();
        toast('Popups saved — this template is now live on the homepage');
      } else toast(data.error || 'Save failed', 'error');
    } catch (err) {
      toast(err.message || 'Could not save popups', 'error');
    }
  });

  document.getElementById('popup-reset-btn')?.addEventListener('click', () => {
    POPUP_DEFAULT_TEMPLATES.forEach((t, i) => fillPopupTemplateForm(i, t));
    syncPopupTemplateModeFields();
    updatePopupLivePreview();
    toast('Defaults restored — click Save to apply');
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
    window.RakuRichEditor?.setContent('faq-answer', '');
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
        window.RakuRichEditor?.setContent('faq-answer', f.answer || '');
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
    window.RakuRichEditor?.sync('faq-answer');
    const id = document.getElementById('faq-id').value;
    const answer = document.getElementById('faq-answer').value.trim();
    if (!answer || answer === '<p><br></p>') {
      toast('Please enter an FAQ answer', 'error');
      return;
    }
    const body = {
      question: document.getElementById('faq-question').value.trim(),
      answer,
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

  const BLOG_PUBLIC_BASE = '/blog/';

  function blogSlugPreview(slug) {
    const s = String(slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    return s || 'your-slug';
  }

  function updateBlogUrlPreview() {
    const el = document.getElementById('blog-url-preview');
    if (!el) return;
    const slug = document.getElementById('blog-slug')?.value.trim() || blogSlugPreview(document.getElementById('blog-title')?.value);
    el.textContent = BLOG_PUBLIC_BASE + blogSlugPreview(slug);
  }

  function setBlogFeaturedUploadStatus(message, isError) {
    const el = document.getElementById('blog-featured-upload-status');
    const zone = document.getElementById('blog-featured-dropzone');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-error');
      zone?.classList.remove('is-uploading');
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('is-error', Boolean(isError));
    zone?.classList.toggle('is-uploading', message === 'Uploading…');
  }

  function updateBlogFeaturedPreview() {
    const url = document.getElementById('blog-featured-image')?.value.trim();
    const empty = document.getElementById('blog-featured-dropzone-empty');
    const preview = document.getElementById('blog-featured-dropzone-preview');
    const img = document.getElementById('blog-featured-preview');
    if (!empty || !preview || !img) return;
    if (url) {
      img.src = url;
      empty.hidden = true;
      preview.hidden = false;
    } else {
      empty.hidden = false;
      preview.hidden = true;
      img.removeAttribute('src');
    }
  }

  async function uploadBlogFeaturedFile(file) {
    if (!file?.type?.startsWith('image/')) {
      toast('Please choose an image file', 'error');
      return;
    }
    setBlogFeaturedUploadStatus('Uploading…');
    try {
      const up = await uploadProductImage(file);
      if (up.ok && up.url) {
        document.getElementById('blog-featured-image').value = up.url;
        updateBlogFeaturedPreview();
        setBlogFeaturedUploadStatus('');
        toast('Image uploaded');
      } else {
        setBlogFeaturedUploadStatus(up.error || 'Upload failed', true);
        toast(up.error || 'Upload failed', 'error');
      }
    } catch (_) {
      setBlogFeaturedUploadStatus('Upload failed', true);
      toast('Upload failed', 'error');
    }
  }

  function initBlogFeaturedDropzone() {
    const zone = document.getElementById('blog-featured-dropzone');
    const fileInput = document.getElementById('blog-featured-file');
    if (!zone || !fileInput || zone.dataset.dropReady) return;
    zone.dataset.dropReady = '1';

    zone.addEventListener('click', (e) => {
      if (e.target.closest('#blog-featured-clear')) return;
      fileInput.click();
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) await uploadBlogFeaturedFile(file);
    });

    ['dragenter', 'dragover'].forEach((type) => {
      zone.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('is-dragover');
      });
    });
    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (zone.contains(e.relatedTarget)) return;
      zone.classList.remove('is-dragover');
    });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-dragover');
      const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
      if (file) await uploadBlogFeaturedFile(file);
    });

    document.getElementById('blog-featured-clear')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('blog-featured-image').value = '';
      updateBlogFeaturedPreview();
      setBlogFeaturedUploadStatus('');
    });
  }
  initBlogFeaturedDropzone();

  function setBlogFormTitle(label) {
    const h2 = document.getElementById('blog-form-title');
    const top = document.getElementById('page-title');
    const bc = document.getElementById('breadcrumb-current');
    if (h2) h2.textContent = label;
    if (top) top.textContent = label;
    if (bc) bc.textContent = label;
    pageTitles['blog-form'] = label;
  }

  function fillBlogForm(post) {
    document.getElementById('blog-id').value = post.id;
    document.getElementById('blog-title').value = post.title || '';
    document.getElementById('blog-slug').value = post.slug || '';
    document.getElementById('blog-excerpt').value = post.excerpt || '';
    document.getElementById('blog-featured-image').value = post.featuredImageUrl || '';
    document.getElementById('blog-status').value = post.status === 'published' ? 'published' : 'draft';
    document.getElementById('blog-seo-title').value = post.seoTitle || '';
    document.getElementById('blog-seo-desc').value = post.seoDescription || '';
    document.getElementById('blog-seo-keywords').value = post.seoKeywords || '';
    document.getElementById('blog-image-alt').value = post.imageAlt || '';
    document.getElementById('blog-og-image').value = post.ogImage || '';
    document.getElementById('blog-content').value = post.content || '';
    updateBlogUrlPreview();
    updateBlogFeaturedPreview();
  }

  function openBlogForm(post) {
    if (post) {
      setBlogFormTitle('Edit Blog Post');
      fillBlogForm(post);
    } else {
      resetBlogForm();
      setBlogFormTitle('New Blog Post');
    }
    switchPage('blog-form');
    setTimeout(() => {
      window.RakuRichEditor?.destroy('blog-content');
      window.RakuRichEditor?.initBlogEditor();
      window.RakuRichEditor?.setContent('blog-content', document.getElementById('blog-content')?.value || '');
      document.getElementById('blog-title')?.focus();
    }, 50);
  }

  function closeBlogForm() {
    window.RakuRichEditor?.destroy('blog-content');
    switchPage('blog');
    loadBlogPosts();
  }

  document.getElementById('blog-form-back')?.addEventListener('click', closeBlogForm);
  document.getElementById('blog-form-cancel')?.addEventListener('click', closeBlogForm);

  function resetBlogForm() {
    setBlogFormTitle('New Blog Post');
    document.getElementById('blog-id').value = '';
    document.getElementById('blog-title').value = '';
    document.getElementById('blog-slug').value = '';
    document.getElementById('blog-excerpt').value = '';
    document.getElementById('blog-featured-image').value = '';
    document.getElementById('blog-status').value = 'draft';
    document.getElementById('blog-seo-title').value = '';
    document.getElementById('blog-seo-desc').value = '';
    document.getElementById('blog-seo-keywords').value = '';
    document.getElementById('blog-image-alt').value = '';
    document.getElementById('blog-og-image').value = '';
    document.getElementById('blog-content').value = '';
    updateBlogUrlPreview();
    updateBlogFeaturedPreview();
  }

  async function loadBlogPosts(page) {
    if (page) blogPage = page;
    const status = document.getElementById('blog-status-filter')?.value || 'all';
    const search = document.getElementById('blog-search')?.value.trim() || '';
    const qs = new URLSearchParams({ page: String(blogPage), limit: '20' });
    if (status !== 'all') qs.set('status', status);
    if (search) qs.set('search', search);
    const data = await api('/blog/posts?' + qs.toString());
    if (!data.ok) return;
    blogPosts = data.posts || [];
    const tbody = document.getElementById('blog-tbody');
    if (!tbody) return;
    if (!blogPosts.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;">No blog posts yet. Click “New Post” to publish your first article.</td></tr>';
    } else {
      tbody.innerHTML = blogPosts
        .map((p) => {
          const pub = p.publishedAt ? fmtDate(p.publishedAt) : '—';
          const badge = p.status === 'published' ? 'green' : 'gray';
          const view =
            p.status === 'published' && p.url
              ? `<a href="${escHtml(p.url)}" class="btn btn-outline btn-xs" target="_blank" rel="noopener noreferrer">View</a>`
              : '';
          return `<tr>
          <td><b>${escHtml(p.title)}</b><div style="font-size:12px;color:#94a3b8;">/${escHtml(p.slug || '')}</div></td>
          <td><span class="badge badge-${badge}">${p.status === 'published' ? 'Published' : 'Draft'}</span></td>
          <td>${escHtml(pub)}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap;">
            ${view}
            <button type="button" class="btn btn-outline btn-xs" data-edit-blog="${p.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-blog="${p.id}">Delete</button>
          </td></tr>`;
        })
        .join('');

      tbody.querySelectorAll('[data-edit-blog]').forEach((btn) => {
        btn.onclick = () => {
          const p = blogPosts.find((x) => x.id === Number(btn.dataset.editBlog));
          if (!p) return;
          openBlogForm(p);
        };
      });

      tbody.querySelectorAll('[data-del-blog]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this blog post?')) return;
          const res = await api('/blog/posts/' + btn.dataset.delBlog, { method: 'DELETE' });
          if (res.ok) {
            toast('Blog post deleted');
            loadBlogPosts();
          } else toast(res.error || 'Delete failed', 'error');
        };
      });
    }

    const pag = data.pagination;
    const pagEl = document.getElementById('blog-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} posts)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-bp="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-bp="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-bp]').forEach((b) => {
        b.onclick = () => loadBlogPosts(blogPage + Number(b.dataset.bp));
      });
    }
  }

  document.getElementById('add-blog-btn')?.addEventListener('click', () => openBlogForm());
  document.getElementById('blog-reset')?.addEventListener('click', resetBlogForm);
  document.getElementById('blog-title')?.addEventListener('input', updateBlogUrlPreview);
  document.getElementById('blog-slug')?.addEventListener('input', updateBlogUrlPreview);
  document.getElementById('blog-featured-image')?.addEventListener('input', updateBlogFeaturedPreview);
  document.getElementById('blog-status-filter')?.addEventListener('change', () => loadBlogPosts(1));
  document.getElementById('blog-search')?.addEventListener('input', debounce(() => loadBlogPosts(1), 400));

  document.getElementById('blog-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    window.RakuRichEditor?.sync('blog-content');
    const id = document.getElementById('blog-id').value;
    const content = document.getElementById('blog-content').value.trim();
    if (!content || content === '<p><br></p>') {
      toast('Please enter blog content', 'error');
      return;
    }
    const body = {
      title: document.getElementById('blog-title').value.trim(),
      slug: document.getElementById('blog-slug').value.trim(),
      excerpt: document.getElementById('blog-excerpt').value.trim(),
      content,
      featuredImageUrl: document.getElementById('blog-featured-image').value.trim(),
      status: document.getElementById('blog-status').value,
      seoTitle: document.getElementById('blog-seo-title').value.trim() || null,
      seoDescription: document.getElementById('blog-seo-desc').value.trim() || null,
      seoKeywords: document.getElementById('blog-seo-keywords').value.trim() || null,
      imageAlt: document.getElementById('blog-image-alt').value.trim() || null,
      ogImage: document.getElementById('blog-og-image').value.trim() || null,
    };
    const res = id
      ? await api('/blog/posts/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/blog/posts', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      toast(id ? 'Blog post updated' : 'Blog post created');
      closeBlogForm();
      if (body.status === 'published' && res.url) {
        toast('Live at ' + res.url);
      }
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

  document.getElementById('order-delete-btn').onclick = () => {
    if (currentOrderId) void deleteOrder(currentOrderId);
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
    const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', headers: adminUploadHeaders(), body: fd });
    return up.json();
  }
  window._rakuAdminUploadImage = uploadProductImage;

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
    const color = p.icon_color || '#2D6B32';
    if (p.image_url) {
      const alt = String(p.name_bn || 'Product').replace(/"/g, '&quot;');
      const src = String(p.image_url).replace(/"/g, '&quot;');
      return `<div class="prod-thumb prod-thumb--img" style="background:${bg};"><img src="${src}" alt="${alt}" width="42" height="42" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><i class="${icon}" style="color:${color};" hidden></i></div>`;
    }
    return `<div class="prod-thumb" style="background:${bg};"><i class="${icon}" style="color:${color};"></i></div>`;
  }

  function syncCategoryFilterSelects(list) {
    const html = buildCategoryFilterOptions(list);
    const productsSel = document.getElementById('products-cat-filter');
    const gallerySel = document.getElementById('gallery-cat-filter');
    const productsVal = productsSel?.value || 'all';
    const galleryVal = gallerySel?.value || 'all';
    if (productsSel) {
      productsSel.innerHTML = html;
      if ([...productsSel.options].some((o) => o.value === productsVal)) productsSel.value = productsVal;
    }
    if (gallerySel) {
      gallerySel.innerHTML = html;
      if ([...gallerySel.options].some((o) => o.value === galleryVal)) gallerySel.value = galleryVal;
    }
  }

  async function loadCategoriesList() {
    const data = await api('/categories');
    if (!data.ok) {
      toast(data.error || 'Could not load categories', 'error');
      return;
    }
    categories = data.categories || [];
    populateMainCategorySelect(categories);
    const mainVal = document.getElementById('pf-main-cat')?.value || '';
    const subVal = document.getElementById('pf-sub-cat')?.value || '';
    updateSubCategorySelect(categories, mainVal, subVal);
    syncPfCategoryHidden();
    syncCategoryFilterSelects(categories);
  }

  function populateMainCategorySelect(list) {
    const sel = document.getElementById('pf-main-cat');
    if (!sel) return;
    const tops = list.filter((c) => catParentId(c) == null);
    sel.innerHTML =
      '<option value="">Select main category</option>' +
      tops
        .map((c) => {
          const subCount = list.filter((x) => catParentId(x) === catId(c)).length;
          const suffix = subCount ? ` (${subCount} sub)` : '';
          return `<option value="${c.id}">${escHtml(c.name_bn)}${suffix}</option>`;
        })
        .join('');
  }

  function updateSubCategorySelect(list, mainId, selectedSubId) {
    const wrap = document.getElementById('pf-sub-cat-wrap');
    const subSel = document.getElementById('pf-sub-cat');
    const hint = document.getElementById('pf-sub-cat-hint');
    if (!wrap || !subSel) return;
    const mid = Number(mainId);
    if (!mid) {
      wrap.hidden = true;
      subSel.innerHTML = '<option value="">Use main category only (no subcategory)</option>';
      return;
    }
    const main = list.find((c) => catId(c) === mid);
    if (hint && main) {
      hint.textContent = `Choose a subcategory under "${main.name_bn}", or leave as main category only.`;
    }
    const subs = list.filter((c) => catParentId(c) === mid);
    if (!subs.length) {
      wrap.hidden = true;
      subSel.innerHTML = '<option value="">Use main category only (no subcategory)</option>';
      return;
    }
    wrap.hidden = false;
    subSel.innerHTML =
      '<option value="">Use main category only (no subcategory)</option>' +
      subs.map((s) => `<option value="${s.id}">${escHtml(s.name_bn)}</option>`).join('');
    subSel.value = selectedSubId ? String(selectedSubId) : '';
  }

  function getProductCategoryId() {
    const mainId = Number(document.getElementById('pf-main-cat')?.value);
    if (!mainId) return null;
    const wrap = document.getElementById('pf-sub-cat-wrap');
    const subVal = document.getElementById('pf-sub-cat')?.value;
    if (wrap && !wrap.hidden && subVal) return Number(subVal);
    return mainId;
  }

  function syncPfCategoryHidden() {
    const id = getProductCategoryId();
    const hidden = document.getElementById('pf-category');
    if (hidden) hidden.value = id ? String(id) : '';
    const box = document.getElementById('pf-cat-selected');
    const pathFlow = document.getElementById('pf-cat-path-flow');
    if (!box || !pathFlow) return;
    if (!id) {
      box.hidden = true;
      pathFlow.innerHTML = '';
      return;
    }
    const mainId = Number(document.getElementById('pf-main-cat')?.value);
    const main = categories.find((c) => catId(c) === mainId);
    const cat = categories.find((c) => catId(c) === id);
    const subVal = document.getElementById('pf-sub-cat')?.value;
    const subWrap = document.getElementById('pf-sub-cat-wrap');
    const usingSub = subWrap && !subWrap.hidden && subVal && cat && catParentId(cat) === mainId;

    box.hidden = false;
    if (usingSub && main && cat) {
      pathFlow.innerHTML = `<span class="path-box path-box--main"><i class="ti ti-folder"></i> ${escHtml(main.name_bn)}</span><i class="ti ti-arrow-right path-arrow"></i><span class="path-box path-box--sub"><i class="ti ti-subtask"></i> ${escHtml(cat.name_bn)}</span>`;
    } else if (main) {
      pathFlow.innerHTML = `<span class="path-box path-box--main"><i class="ti ti-folder"></i> ${escHtml(main.name_bn)}</span>`;
    } else if (cat) {
      pathFlow.innerHTML = `<span class="path-box path-box--main"><i class="ti ti-folder"></i> ${escHtml(cat.name_bn)}</span>`;
    }
  }

  function setProductCategoryPickers(list, categoryId) {
    populateMainCategorySelect(list);
    const cid = Number(categoryId);
    const mainSel = document.getElementById('pf-main-cat');
    if (!mainSel) return;
    if (!cid) {
      mainSel.value = '';
      updateSubCategorySelect(list, '', '');
      syncPfCategoryHidden();
      return;
    }
    const cat = list.find((c) => catId(c) === cid);
    if (!cat) {
      syncPfCategoryHidden();
      return;
    }
    const pid = catParentId(cat);
    if (pid) {
      mainSel.value = String(pid);
      updateSubCategorySelect(list, pid, cid);
    } else {
      mainSel.value = String(cid);
      updateSubCategorySelect(list, cid, '');
    }
    syncPfCategoryHidden();
  }

  document.getElementById('pf-main-cat')?.addEventListener('change', () => {
    updateSubCategorySelect(categories, document.getElementById('pf-main-cat').value, '');
    syncPfCategoryHidden();
  });
  document.getElementById('pf-sub-cat')?.addEventListener('change', syncPfCategoryHidden);

  function catParentId(c) {
    const p = c?.parent_id ?? c?.parentId;
    return p == null || p === '' ? null : Number(p);
  }

  function catId(c) {
    return Number(c?.id);
  }

  function buildCategoryFilterOptions(list) {
    const tops = list.filter((c) => catParentId(c) == null);
    let html = '<option value="all">All categories</option>';
    tops.forEach((parent) => {
      const subs = list.filter((c) => catParentId(c) === catId(parent));
      html += `<option value="${parent.slug}">${parent.name_bn}${subs.length ? ' (all)' : ''}</option>`;
      subs.forEach((sub) => {
        html += `<option value="${sub.slug}">↳ ${sub.name_bn}</option>`;
      });
    });
    return html;
  }

  function formatProductCategoryLabel(p) {
    if (p.parent_category_name) {
      return `${p.parent_category_name} → ${p.category_name}`;
    }
    return p.category_name || '—';
  }

  function hideCategorySubContext() {
    cfSubParentId = null;
    const box = document.getElementById('cf-sub-context');
    const locked = document.getElementById('cf-locked-parent-id');
    const picker = document.getElementById('cat-type-picker');
    const parentSel = document.getElementById('cf-parent');
    if (locked) locked.value = '';
    if (box) box.hidden = true;
    if (picker) picker.hidden = false;
    if (parentSel) parentSel.disabled = false;
  }

  function showCategorySubContext(parent) {
    const box = document.getElementById('cf-sub-context');
    const nameEl = document.getElementById('cf-sub-context-name');
    const locked = document.getElementById('cf-locked-parent-id');
    const picker = document.getElementById('cat-type-picker');
    const parentWrap = document.getElementById('cf-parent-wrap');
    if (!box || !nameEl || !parent) return;
    cfSubParentId = catId(parent);
    if (locked) locked.value = String(cfSubParentId);
    nameEl.textContent = parent.name_bn;
    box.hidden = false;
    if (picker) picker.hidden = true;
    if (parentWrap) parentWrap.hidden = true;
  }

  function getCategoryFormType() {
    return document.querySelector('.cat-type-btn.active')?.dataset.cfType === 'sub' ? 'sub' : 'main';
  }

  function getCategorySubmitParentId() {
    if (cfSubParentId) return cfSubParentId;
    const locked = document.getElementById('cf-locked-parent-id')?.value;
    if (locked) return Number(locked);
    if (getCategoryFormType() === 'sub') {
      const parentVal = document.getElementById('cf-parent')?.value;
      return parentVal ? Number(parentVal) : null;
    }
    return null;
  }

  function populateCategoryParentSelect(list, { excludeId, selectedId, lockParent } = {}) {
    const sel = document.getElementById('cf-parent');
    if (!sel) return;
    if (lockParent && selectedId) {
      const parent = list.find((c) => catId(c) === Number(selectedId));
      sel.disabled = true;
      sel.innerHTML = `<option value="${selectedId}">${escHtml(parent?.name_bn || 'Main category')}</option>`;
      sel.value = String(selectedId);
      return;
    }
    sel.disabled = false;
    const tops = list.filter((c) => catParentId(c) == null && catId(c) !== Number(excludeId));
    sel.innerHTML =
      '<option value="">Select main category</option>' +
      tops.map((c) => `<option value="${c.id}">${escHtml(c.name_bn)}</option>`).join('');
    sel.value = selectedId ? String(selectedId) : '';
    updateCategoryParentPreview();
  }

  function setCategoryFormType(type) {
    if (document.getElementById('cf-locked-parent-id')?.value) return;
    document.querySelectorAll('.cat-type-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cfType === type);
    });
    const wrap = document.getElementById('cf-parent-wrap');
    const parentSel = document.getElementById('cf-parent');
    if (wrap) wrap.hidden = type !== 'sub';
    if (type === 'main' && parentSel && !parentSel.disabled) {
      parentSel.value = '';
      updateCategoryParentPreview();
    }
  }

  document.querySelectorAll('.cat-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCategoryFormType(btn.dataset.cfType || 'main');
    });
  });

  async function loadProducts(page) {
    if (page) productsPage = page;
    if (!categories.length) await loadCategoriesList();
    const cat = document.getElementById('products-cat-filter').value;
    const search = document.getElementById('products-search').value.trim();
    const q = new URLSearchParams({ page: productsPage, limit: 6 });
    if (cat !== 'all') q.set('category', cat);
    if (search) q.set('search', search);
    const data = await api('/products?' + q.toString());
    if (!data.ok) return;

    const tbody = document.getElementById('products-tbody');
    if (!data.products?.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">No products found.</td></tr>';
      updateProductsSelectionUi();
    } else {
      const allowDelete = canDeleteProducts();
      tbody.innerHTML = data.products
        .map((p) => {
          const stockCls = p.stock <= 0 ? 'badge-red' : p.stock <= 5 ? 'badge-amber' : 'badge-green';
          const stockLbl = p.stock <= 0 ? 'Out of stock' : p.stock <= 5 ? 'Low' : 'Active';
          const checked = selectedProductIds.has(Number(p.id)) ? ' checked' : '';
          const rowClass = checked ? ' class="row-selected"' : '';
          const deleteBtn = allowDelete
            ? `<button type="button" class="btn btn-danger btn-xs" data-del-product="${p.id}">Delete</button>`
            : '';
          return `<tr${rowClass}>
          ${allowDelete ? `<td class="tbl-check-col"><input type="checkbox" class="product-row-check" data-product-id="${p.id}" aria-label="Select ${escHtml(p.name_bn)}"${checked}></td>` : ''}
          <td><div style="display:flex;align-items:center;gap:10px;">
            ${productThumbHtml(p)}
            <div><div style="font-weight:600;">${escHtml(p.name_bn)}</div><small style="color:#94a3b8">${escHtml(p.slug)}</small></div></div></td>
          <td>${formatProductCategoryLabel(p)}</td><td>৳${Number(p.price).toLocaleString()}</td>
          <td>${p.buy_price != null && p.buy_price !== '' ? '৳' + Number(p.buy_price).toLocaleString() : '<span style="color:#94a3b8">—</span>'}</td>
          <td>${p.stock}</td>
          <td><span class="badge ${stockCls}">${stockLbl}</span></td>
          <td class="tbl-actions">
            <a href="/product/${encodeURIComponent(p.slug || p.id)}" target="_blank" rel="noopener" class="btn btn-outline btn-xs">View</a>
            <button type="button" class="btn btn-outline btn-xs" data-edit-product="${p.id}">Edit</button>
            ${deleteBtn}
          </td></tr>`;
        })
        .join('');
      updateProductsSelectionUi();
    }

    document.querySelectorAll('[data-edit-product]').forEach((btn) => {
      btn.onclick = () => {
        const p = data.products.find((x) => x.id === Number(btn.dataset.editProduct));
        if (!p) return;
        openProductForm(p);
      };
    });

    if (canDeleteProducts()) {
      document.querySelectorAll('[data-del-product]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Delete this product?')) return;
          const r = await api('/products/' + btn.dataset.delProduct, { method: 'DELETE' });
          if (r.ok) {
            toast('Product deleted');
            selectedProductIds.delete(Number(btn.dataset.delProduct));
            updateProductsSelectionUi();
            loadProducts();
          } else toast(r.error || 'Failed', 'error');
        };
      });
    }

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

  let galleryLightboxItem = null;

  function closeGalleryLightbox() {
    const lb = document.getElementById('gallery-lightbox');
    if (!lb) return;
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    galleryLightboxItem = null;
  }

  function openGalleryLightbox(item) {
    galleryLightboxItem = item;
    const lb = document.getElementById('gallery-lightbox');
    const img = document.getElementById('gallery-lightbox-img');
    const title = document.getElementById('gallery-lightbox-title');
    const sub = document.getElementById('gallery-lightbox-sub');
    const view = document.getElementById('gallery-lightbox-view');
    if (!lb || !img || !title || !sub) return;
    img.src = item.imageUrl;
    img.alt = item.productName || 'Product image';
    title.textContent = item.productName || 'Product';
    const bits = [item.categoryName || ''];
    if (item.isMain) bits.push('Main image');
    else bits.push(`Gallery #${(item.sortOrder || 0) + 1}`);
    sub.textContent = bits.filter(Boolean).join(' · ');
    if (view) {
      const slug = item.productSlug || item.productId;
      view.href = `/product/${encodeURIComponent(slug)}`;
    }
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
  }

  async function loadImageGallery(page = galleryPage) {
    galleryPage = page;
    const grid = document.getElementById('gallery-grid');
    const statsEl = document.getElementById('gallery-stats');
    if (!grid) return;

    if (!categories.length) await loadCategoriesList();

    const catEl = document.getElementById('gallery-cat-filter');
    const searchEl = document.getElementById('gallery-search');
    const cat = catEl?.value || 'all';
    const search = searchEl?.value.trim() || '';

    grid.innerHTML = '<div class="gallery-loading"><i class="ti ti-loader"></i> Loading images...</div>';
    if (statsEl) statsEl.textContent = '';

    const q = new URLSearchParams({ page: String(page), limit: '48' });
    if (cat && cat !== 'all') q.set('category', cat);
    if (search) q.set('search', search);

    const data = await api('/product-images?' + q.toString());
    if (!data.ok) {
      grid.innerHTML = `<div class="gallery-empty">${escHtml(data.error || 'Could not load images')}</div>`;
      return;
    }

    const images = data.images || [];
    if (statsEl && data.stats) {
      statsEl.textContent = `${data.stats.totalImages} image${data.stats.totalImages === 1 ? '' : 's'} total`;
    }

    if (!images.length) {
      grid.innerHTML = '<div class="gallery-empty">No product images found.</div>';
      const pagEl = document.getElementById('gallery-pagination');
      if (pagEl) pagEl.innerHTML = '';
      return;
    }

    grid.innerHTML = images
      .map((img, idx) => {
        const url = escHtml(img.imageUrl);
        const name = escHtml(img.productName || 'Product');
        const catLabel = escHtml(img.categoryName || '');
        const mainBadge = img.isMain ? '<span class="gallery-card-badge">Main</span>' : '';
        return `<button type="button" class="gallery-card" data-gallery-idx="${idx}" title="${name}">
          <span class="gallery-card-img-wrap">
            <img src="${url}" alt="${name}" loading="lazy" decoding="async" onerror="this.closest('.gallery-card').classList.add('gallery-card--broken')">
            ${mainBadge}
          </span>
          <span class="gallery-card-meta">
            <span class="gallery-card-name">${name}</span>
            ${catLabel ? `<span class="gallery-card-cat">${catLabel}</span>` : ''}
          </span>
        </button>`;
      })
      .join('');

    grid.querySelectorAll('[data-gallery-idx]').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.galleryIdx);
        const item = images[idx];
        if (item) openGalleryLightbox(item);
      };
    });

    const pag = data.pagination;
    const pagEl = document.getElementById('gallery-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} images)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-gp="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-gp="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-gp]').forEach((b) => {
        b.onclick = () => loadImageGallery(galleryPage + Number(b.dataset.gp));
      });
    }
  }

  function updateProductsSelectionUi() {
    const count = selectedProductIds.size;
    const bulkBtn = document.getElementById('products-bulk-delete-btn');
    const clearBtn = document.getElementById('products-clear-selection-btn');
    const countEl = document.getElementById('products-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncProductsSelectAllCheckbox();
  }

  function syncProductsSelectAllCheckbox() {
    const selectAll = document.getElementById('products-select-all');
    const checks = [...document.querySelectorAll('#products-tbody .product-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteSelectedProducts() {
    const ids = [...selectedProductIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected product(s)? Products with existing orders will be skipped.`)) return;
    const data = await api('/products/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      let msg = `${data.deleted || ids.length} product(s) deleted`;
      if (data.skipped) msg += ` — ${data.skipped} skipped (have orders)`;
      toast(msg);
      if (data.skippedIds?.length) {
        data.skippedIds.forEach((id) => selectedProductIds.delete(Number(id)));
      }
      selectedProductIds.clear();
      updateProductsSelectionUi();
      loadProducts();
    } else {
      toast(data.error || 'Could not delete selected products', 'error');
    }
  }

  document.getElementById('products-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#products-tbody .product-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.productId);
      if (checked) selectedProductIds.add(id);
      else selectedProductIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateProductsSelectionUi();
  });

  document.getElementById('products-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedProducts();
  });

  document.getElementById('products-clear-selection-btn')?.addEventListener('click', () => {
    selectedProductIds.clear();
    document.querySelectorAll('#products-tbody .product-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateProductsSelectionUi();
  });

  const productsTbody = document.getElementById('products-tbody');
  if (productsTbody && !productsTbody._rakuProductActionsBound) {
    productsTbody._rakuProductActionsBound = true;
    productsTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.product-row-check');
      if (!check) return;
      const id = Number(check.dataset.productId);
      if (check.checked) selectedProductIds.add(id);
      else selectedProductIds.delete(id);
      check.closest('tr')?.classList.toggle('row-selected', check.checked);
      updateProductsSelectionUi();
    });
  }

  document.getElementById('products-cat-filter').onchange = () => loadProducts(1);
  document.getElementById('products-search').oninput = debounce(() => loadProducts(1), 400);

  const galleryCatFilter = document.getElementById('gallery-cat-filter');
  const gallerySearch = document.getElementById('gallery-search');
  if (galleryCatFilter) galleryCatFilter.onchange = () => loadImageGallery(1);
  if (gallerySearch) gallerySearch.oninput = debounce(() => loadImageGallery(1), 400);

  document.getElementById('gallery-lightbox-close')?.addEventListener('click', closeGalleryLightbox);
  document.getElementById('gallery-lightbox')?.addEventListener('click', (e) => {
    if (e.target.id === 'gallery-lightbox') closeGalleryLightbox();
  });
  document.getElementById('gallery-lightbox-copy')?.addEventListener('click', async () => {
    if (!galleryLightboxItem?.imageUrl) return;
    try {
      await navigator.clipboard.writeText(galleryLightboxItem.imageUrl);
      toast('Image URL copied');
    } catch (_) {
      toast('Could not copy URL', 'error');
    }
  });
  document.getElementById('gallery-lightbox-edit')?.addEventListener('click', async () => {
    if (!galleryLightboxItem?.productId) return;
    closeGalleryLightbox();
    await openProductForm({ id: galleryLightboxItem.productId });
  });

  document.getElementById('pf-reset').onclick = resetProductForm;
  function resetProductForm() {
    document.getElementById('product-form-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-icon').value = 'ti-package';
    document.getElementById('pf-icon-color').value = '#2D6B32';
    document.getElementById('pf-bg').value = '#E8F3EA';
    document.getElementById('pf-stock').value = 100;
    document.getElementById('pf-featured').checked = true;
    ['pf-seo-title', 'pf-seo-desc', 'pf-seo-keywords', 'pf-image-alt', 'pf-og-image', 'pf-discount-percent', 'pf-buy-price'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const pfDesc = document.getElementById('pf-desc');
    const pfShort = document.getElementById('pf-short-desc');
    if (pfDesc) pfDesc.value = '';
    if (pfShort) pfShort.value = '';
    const oldEl = document.getElementById('pf-old-price');
    if (oldEl) delete oldEl.dataset.userEdited;
    const priceEl = document.getElementById('pf-price');
    if (priceEl) delete priceEl.dataset.userEdited;
    resetPfGallery([]);
    populateMainCategorySelect(categories || []);
    updateSubCategorySelect(categories || [], '', '');
    syncPfCategoryHidden();
  }

  function roundPrice(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function syncProductPricing(source) {
    const priceEl = document.getElementById('pf-price');
    const oldEl = document.getElementById('pf-old-price');
    const pctEl = document.getElementById('pf-discount-percent');
    if (!priceEl || !oldEl || !pctEl) return;

    const sale = Number(priceEl.value);
    const mrp = Number(oldEl.value);
    const pct = Number(pctEl.value);
    const hasPct = Number.isFinite(pct) && pct > 0 && pct < 100;

    if (!hasPct) {
      if (source === 'discount' || source === 'load') {
        oldEl.value = '';
        delete oldEl.dataset.userEdited;
      }
      return;
    }

    if ((source === 'mrp' || source === 'discount') && mrp > 0 && oldEl.dataset.userEdited === '1') {
      priceEl.value = roundPrice(mrp * (1 - pct / 100));
      delete priceEl.dataset.userEdited;
    } else if ((source === 'sale' || source === 'discount') && sale > 0 && priceEl.dataset.userEdited === '1') {
      if (oldEl.dataset.userEdited !== '1') {
        oldEl.value = roundPrice(sale / (1 - pct / 100));
      }
    } else if (source === 'mrp' && mrp > 0) {
      priceEl.value = roundPrice(mrp * (1 - pct / 100));
      delete priceEl.dataset.userEdited;
    } else if (source === 'sale' && sale > 0 && oldEl.dataset.userEdited !== '1') {
      oldEl.value = roundPrice(sale / (1 - pct / 100));
    }
  }

  document.getElementById('pf-discount-percent')?.addEventListener('input', () => syncProductPricing('discount'));
  document.getElementById('pf-price')?.addEventListener('input', (e) => {
    if (e.target.value) e.target.dataset.userEdited = '1';
    else delete e.target.dataset.userEdited;
    syncProductPricing('sale');
  });
  document.getElementById('pf-old-price')?.addEventListener('input', (e) => {
    if (e.target.value) e.target.dataset.userEdited = '1';
    else delete e.target.dataset.userEdited;
    syncProductPricing('mrp');
  });

  document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    window.RakuRichEditor?.syncProductEditors?.();
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
    const discRaw = document.getElementById('pf-discount-percent')?.value;
    const discParsed = discRaw === '' || discRaw == null ? null : Number(discRaw);
    const categoryId = getProductCategoryId();
    if (!categoryId) {
      toast('Please select a main category', 'error');
      document.getElementById('pf-main-cat')?.focus();
      return;
    }
    const body = {
      name: document.getElementById('pf-name').value.trim(),
      slug: document.getElementById('pf-slug')?.value?.trim() || undefined,
      categoryId,
      price: Number(document.getElementById('pf-price').value),
      buyPrice: document.getElementById('pf-buy-price')?.value?.trim() || null,
      oldPrice: document.getElementById('pf-old-price').value || null,
      discountPercent: discParsed === null ? null : discParsed,
      stock: Number(document.getElementById('pf-stock').value),
      sku: document.getElementById('pf-sku').value.trim(),
      description: (window.RakuRichEditor?.getContent('pf-desc') || document.getElementById('pf-desc').value).trim(),
      shortDescription: (window.RakuRichEditor?.getContent('pf-short-desc') || document.getElementById('pf-short-desc')?.value || '').trim() || null,
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
  function updateCustomersSelectionUi() {
    const count = selectedCustomerIds.size;
    const bulkBtn = document.getElementById('customers-bulk-delete-btn');
    const clearBtn = document.getElementById('customers-clear-selection-btn');
    const countEl = document.getElementById('customers-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncCustomersSelectAllCheckbox();
  }

  function syncCustomersSelectAllCheckbox() {
    const selectAll = document.getElementById('customers-select-all');
    const checks = [...document.querySelectorAll('#customers-tbody .customer-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteSelectedCustomers() {
    const ids = [...selectedCustomerIds];
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} selected customer account(s) permanently? Their orders will stay in the store but will no longer be linked to these accounts. This cannot be undone.`
      )
    ) {
      return;
    }
    const data = await api('/customers/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      let msg = `${data.deleted || ids.length} customer(s) deleted`;
      if (data.notFound) msg += ` — ${data.notFound} not found`;
      toast(msg);
      selectedCustomerIds.clear();
      updateCustomersSelectionUi();
      loadCustomers();
    } else {
      toast(data.error || 'Could not delete selected customers', 'error');
    }
  }

  async function loadCustomers() {
    const statsData = await api('/customers/stats');
    if (statsData.ok) {
      const s = statsData.stats;
      document.getElementById('customer-stats').innerHTML = `
        <div class="stat-card"><div class="stat-icon" style="background:#E8F3EA;"><i class="ti ti-users" style="color:#2D6B32;"></i></div><div><div class="stat-num">${s.total}</div><div class="stat-label">Total customers</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="ti ti-user-plus" style="color:#1D9E75;"></i></div><div><div class="stat-num">${s.monthNew}</div><div class="stat-label">New this month</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="ti ti-chart-line" style="color:#EF9F27;"></i></div><div><div class="stat-num">${s.avgSpentFormatted}</div><div class="stat-label">Avg. spent</div></div></div>`;
    }
    const search = document.getElementById('customers-search').value.trim();
    const q = search ? '?search=' + encodeURIComponent(search) : '';
    const data = await api('/customers' + q);
    if (!data.ok) return;

    const tbody = document.getElementById('customers-tbody');
    if (!data.customers?.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:24px;">No customers found.</td></tr>';
      updateCustomersSelectionUi();
      return;
    }

    tbody.innerHTML = data.customers
      .map((c) => {
        const safeName = escHtml(c.fullName || 'Customer');
        const checked = selectedCustomerIds.has(Number(c.id)) ? ' checked' : '';
        const rowClass = checked ? ' class="row-selected"' : '';
        return `<tr${rowClass}>
        <td class="tbl-check-col"><input type="checkbox" class="customer-row-check" data-customer-id="${c.id}" aria-label="Select ${safeName}"${checked}></td>
        <td>${safeName}</td><td>${escHtml(c.email || '')}</td><td>${escHtml(c.phone || '')}</td>
        <td><button type="button" class="btn btn-outline btn-sm customer-points-btn" data-id="${c.id}" data-points="${c.rewardPoints}" title="Edit points">${c.rewardPoints}</button></td>
        <td>${c.orderCount}</td><td>${c.totalSpentFormatted}</td><td>${fmtDate(c.createdAt)}</td>
        <td><button type="button" class="btn btn-danger btn-xs customer-del-btn" data-id="${c.id}" data-name="${safeName.replace(/"/g, '&quot;')}" data-orders="${c.orderCount}" title="Delete account"><i class="ti ti-trash"></i> Delete</button></td></tr>`;
      })
      .join('');
    updateCustomersSelectionUi();

    document.querySelectorAll('.customer-points-btn').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const current = Number(btn.dataset.points) || 0;
        const raw = window.prompt('Set reward points for this customer:', String(current));
        if (raw == null) return;
        const next = Math.max(0, Math.floor(Number(raw) || 0));
        const res = await api(`/customers/${id}/points`, {
          method: 'PATCH',
          body: JSON.stringify({ points: next }),
        });
        if (res.ok) {
          toast('Points updated');
          loadCustomers();
        } else toast(res.error || 'Failed to update points', 'error');
      };
    });
    document.querySelectorAll('.customer-del-btn').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name || 'this customer';
        const orders = Number(btn.dataset.orders) || 0;
        let msg = `Delete customer account "${name}" permanently?`;
        if (orders > 0) {
          msg += ` They have ${orders} order(s) — orders will stay in the store but will no longer be linked to this account.`;
        }
        msg += ' This cannot be undone.';
        if (!confirm(msg)) return;
        const res = await api(`/customers/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast('Customer deleted');
          selectedCustomerIds.delete(Number(id));
          updateCustomersSelectionUi();
          loadCustomers();
        } else toast(res.error || 'Failed to delete customer', 'error');
      };
    });
  }

  document.getElementById('customers-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#customers-tbody .customer-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.customerId);
      if (checked) selectedCustomerIds.add(id);
      else selectedCustomerIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateCustomersSelectionUi();
  });

  document.getElementById('customers-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedCustomers();
  });

  document.getElementById('customers-clear-selection-btn')?.addEventListener('click', () => {
    selectedCustomerIds.clear();
    document.querySelectorAll('#customers-tbody .customer-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateCustomersSelectionUi();
  });

  const customersTbody = document.getElementById('customers-tbody');
  if (customersTbody && !customersTbody._rakuCustomerActionsBound) {
    customersTbody._rakuCustomerActionsBound = true;
    customersTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.customer-row-check');
      if (!check) return;
      const id = Number(check.dataset.customerId);
      if (check.checked) selectedCustomerIds.add(id);
      else selectedCustomerIds.delete(id);
      check.closest('tr')?.classList.toggle('row-selected', check.checked);
      updateCustomersSelectionUi();
    });
  }

  document.getElementById('customers-search').oninput = debounce(loadCustomers, 400);

  // ——— Categories ———
  function adminCategoryIconMarkup(c) {
    const url = c?.icon_url || c?.iconUrl;
    if (url) {
      const src = String(url).replace(/"/g, '&quot;');
      return `<span class="cat-tree-icon"><img src="${src}" alt=""></span>`;
    }
    return `<i class="ti ${escHtml(c?.icon || 'ti-category')}"></i>`;
  }

  function updateCfIconPreview() {
    const url = document.getElementById('cf-icon-url')?.value.trim() || '';
    const iconClass = document.getElementById('cf-icon')?.value.trim() || 'ti-category';
    const img = document.getElementById('cf-icon-preview-img');
    const fallback = document.getElementById('cf-icon-preview-fallback');
    const removeBtn = document.getElementById('cf-icon-remove-btn');
    if (!img || !fallback) return;
    if (url) {
      img.src = url;
      img.hidden = false;
      fallback.hidden = true;
      if (removeBtn) removeBtn.hidden = false;
      return;
    }
    img.removeAttribute('src');
    img.hidden = true;
    fallback.hidden = false;
    const raw = iconClass.replace(/^ti\s+/, '').replace(/^ti-/, '');
    fallback.className = `ti ti-${raw}`;
    if (removeBtn) removeBtn.hidden = true;
  }

  function resetCfIconUpload() {
    const urlEl = document.getElementById('cf-icon-url');
    const fileEl = document.getElementById('cf-icon-file');
    if (urlEl) urlEl.value = '';
    if (fileEl) fileEl.value = '';
    updateCfIconPreview();
  }

  document.getElementById('cf-icon-upload-btn')?.addEventListener('click', () => {
    document.getElementById('cf-icon-file')?.click();
  });

  document.getElementById('cf-icon-remove-btn')?.addEventListener('click', () => {
    resetCfIconUpload();
  });

  document.getElementById('cf-icon-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Shudhu image file upload kora jabe', 'error');
      e.target.value = '';
      return;
    }
    try {
      const data = await uploadProductImage(file);
      if (!data.ok || !data.url) {
        toast(data.error || 'Upload fail', 'error');
        return;
      }
      document.getElementById('cf-icon-url').value = data.url;
      updateCfIconPreview();
      toast('Icon uploaded');
    } catch (err) {
      toast('Upload fail', 'error');
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('cf-icon')?.addEventListener('input', () => {
    if (!document.getElementById('cf-icon-url')?.value.trim()) updateCfIconPreview();
  });

  function resetCategoryForm() {
    hideCategorySubContext();
    document.getElementById('category-form-title').textContent = 'Add Category';
    const submitBtn = document.getElementById('cf-submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Category';
    document.getElementById('cf-id').value = '';
    document.getElementById('cf-name').value = '';
    document.getElementById('cf-slug').value = '';
    document.getElementById('cf-icon').value = 'ti-category';
    resetCfIconUpload();
    document.getElementById('cf-sort').value = '0';
    setCategoryFormType('main');
    populateCategoryParentSelect(categories || [], {});
    updateCategoryParentPreview();
  }

  function openAddSubcategoryForm(parentId) {
    const pid = Number(parentId);
    const parent = (categories || []).find((c) => catId(c) === pid);
    if (!parent) {
      toast('Main category pawa jay ni — page refresh korun', 'error');
      return;
    }
    document.getElementById('cf-id').value = '';
    document.getElementById('cf-name').value = '';
    document.getElementById('cf-slug').value = '';
    document.getElementById('cf-icon').value = 'ti-category';
    resetCfIconUpload();
    document.getElementById('cf-sort').value = '0';
    cfSubParentId = pid;
    showCategorySubContext(parent);
    populateCategoryParentSelect(categories || [], { selectedId: pid, lockParent: true });
    document.querySelectorAll('.cat-type-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cfType === 'sub');
    });
    document.getElementById('category-form-title').textContent = `"${parent.name_bn}" er under subcategory`;
    const submitBtn = document.getElementById('cf-submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Subcategory';
    openCategoryModal();
    setTimeout(() => document.getElementById('cf-name')?.focus(), 50);
  }

  function resolveCategoryParentCat(c, list) {
    const pid = catParentId(c);
    if (!pid) return null;
    return list.find((p) => catId(p) === pid) || null;
  }

  function renderCategoriesOverview(list) {
    const box = document.getElementById('categories-overview');
    if (!box) return;
    const tops = list.filter((c) => catParentId(c) == null);
    const subs = list.filter((c) => catParentId(c) != null);
    const orphanSubs = subs.filter((c) => !resolveCategoryParentCat(c, list));
    box.hidden = false;
    box.innerHTML = `
      <div class="categories-overview-card"><strong>${tops.length}</strong><span>Main category</span></div>
      <div class="categories-overview-card"><strong>${subs.length}</strong><span>Subcategory</span></div>
      <div class="categories-overview-card"><strong>${orphanSubs.length}</strong><span>Link missing (fix in Edit)</span></div>`;
  }

  function renderCategoriesTree(list) {
    const tops = list.filter((c) => catParentId(c) == null);
    if (!tops.length) {
      return `<div class="cat-tree-empty-sub">Kono category nai. <strong>Add Category</strong> button e click kore prothome main category banan.</div>`;
    }
    return tops
      .map((parent) => {
        const subs = list.filter((c) => catParentId(c) === catId(parent));
        const subsHtml = subs.length
          ? subs
              .map(
                (sub) => `<div class="cat-tree-sub">
            <div class="cat-tree-sub-line" aria-hidden="true"></div>
            <div class="cat-tree-sub-body">
              <span class="cat-badge cat-badge--sub">Sub</span>
              <strong>${escHtml(sub.name_bn)}</strong>
              <span class="cat-tree-sub-tag">${escHtml(parent.name_bn)} er under</span>
              <span class="cat-tree-meta">${sub.product_count} product</span>
              <div class="cat-tree-actions">
                <button type="button" class="btn btn-outline btn-xs" data-edit-cat="${sub.id}">Edit</button>
                <button type="button" class="btn btn-danger btn-xs" data-del-cat="${sub.id}">Delete</button>
              </div>
            </div>
          </div>`
              )
              .join('')
          : `<div class="cat-tree-empty-sub">Ei main category te kono sub nai. <button type="button" class="btn btn-outline btn-xs" data-add-subcat="${parent.id}"><i class="ti ti-plus"></i> Subcategory add korun</button></div>`;
        return `<div class="cat-tree-group">
        <div class="cat-tree-main">
          <span class="cat-badge cat-badge--main">Main</span>
          <div class="cat-tree-main-name">${adminCategoryIconMarkup(parent)} ${escHtml(parent.name_bn)}</div>
          <span class="cat-tree-meta">${subs.length} ta sub · ${parent.product_count} product</span>
          <div class="cat-tree-actions">
            <button type="button" class="btn btn-outline btn-xs" data-add-subcat="${parent.id}"><i class="ti ti-plus"></i> Sub add</button>
            <button type="button" class="btn btn-outline btn-xs" data-edit-cat="${parent.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-cat="${parent.id}">Delete</button>
          </div>
        </div>
        <div class="cat-tree-subs">${subsHtml}</div>
      </div>`;
      })
      .join('');
  }

  function bindCategoryTreeActions() {
    const tree = document.getElementById('categories-tree');
    if (!tree || tree._rakuBound) return;
    tree._rakuBound = true;
    tree.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-subcat]');
      if (addBtn) {
        openAddSubcategoryForm(Number(addBtn.dataset.addSubcat));
        return;
      }
      const editBtn = e.target.closest('[data-edit-cat]');
      if (editBtn) {
        openEditCategoryForm(Number(editBtn.dataset.editCat));
        return;
      }
      const delBtn = e.target.closest('[data-del-cat]');
      if (delBtn) {
        deleteCategory(Number(delBtn.dataset.delCat));
      }
    });
  }

  function openEditCategoryForm(categoryId) {
    const c = categories.find((x) => catId(x) === Number(categoryId));
    if (!c) return;
    hideCategorySubContext();
    document.getElementById('category-form-title').textContent = catParentId(c) ? 'Edit Subcategory' : 'Edit Main Category';
    const submitBtn = document.getElementById('cf-submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Category';
    document.getElementById('cf-id').value = c.id;
    document.getElementById('cf-name').value = c.name_bn;
    document.getElementById('cf-slug').value = c.slug;
    document.getElementById('cf-icon').value = c.icon || 'ti-category';
    document.getElementById('cf-icon-url').value = c.icon_url || c.iconUrl || '';
    updateCfIconPreview();
    document.getElementById('cf-sort').value = c.sort_order ?? 0;
    setCategoryFormType(catParentId(c) ? 'sub' : 'main');
    populateCategoryParentSelect(categories, { excludeId: c.id, selectedId: catParentId(c) || '' });
    updateCategoryParentPreview();
    openCategoryModal();
  }

  async function deleteCategory(catId) {
    if (!confirm('Delete category?')) return;
    const r = await api('/categories/' + catId, { method: 'DELETE' });
    if (r.ok) {
      toast('Deleted');
      loadCategories();
      loadCategoriesList();
    } else toast(r.error || 'Failed', 'error');
  }

  function updateCategoryParentPreview() {
    const preview = document.getElementById('cf-parent-preview');
    const sel = document.getElementById('cf-parent');
    if (!preview || !sel || getCategoryFormType() !== 'sub') {
      if (preview) {
        preview.hidden = true;
        preview.innerHTML = '';
      }
      return;
    }
    const val = sel.value;
    if (!val) {
      preview.hidden = true;
      preview.innerHTML = '';
      return;
    }
    const parent = (categories || []).find((c) => catId(c) === Number(val));
    preview.hidden = false;
    preview.innerHTML = `<i class="ti ti-arrow-down"></i> <span class="path-box path-box--main" style="display:inline-flex;margin:0 6px;"><i class="ti ti-folder"></i> ${escHtml(parent?.name_bn || 'Main')}</span> <i class="ti ti-arrow-right path-arrow"></i> <span class="path-box path-box--sub" style="display:inline-flex;"><i class="ti ti-subtask"></i> Apnar notun sub</span>`;
  }

  document.getElementById('cf-parent')?.addEventListener('change', updateCategoryParentPreview);

  async function loadCategories() {
    const data = await api('/categories');
    if (!data.ok) return;
    categories = data.categories;
    const alertEl = document.getElementById('categories-schema-alert');
    if (alertEl) {
      if (data.subcategoryReady === false) {
        alertEl.hidden = false;
        alertEl.innerHTML =
          '<i class="ti ti-alert-triangle"></i> Subcategory save hobe na — server restart ba deploy korun (database update lagbe).';
      } else {
        alertEl.hidden = true;
        alertEl.innerHTML = '';
      }
    }
    renderCategoriesOverview(categories);
    bindCategoryTreeActions();
    const tree = document.getElementById('categories-tree');
    if (tree) tree.innerHTML = renderCategoriesTree(categories);
    populateCategoryParentSelect(categories);
  }

  document.getElementById('cf-reset')?.addEventListener('click', resetCategoryForm);

  document.getElementById('category-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cf-id').value;
    const name = document.getElementById('cf-name').value.trim();
    if (!name) {
      toast('Name likhun', 'error');
      return;
    }
    const isSub = Boolean(cfSubParentId) || getCategoryFormType() === 'sub';
    const parentId = cfSubParentId || getCategorySubmitParentId();
    if (isSub && !parentId) {
      toast('Subcategory er jonno main category select korun', 'error');
      document.getElementById('cf-parent')?.focus();
      return;
    }
    const body = {
      name,
      slug: document.getElementById('cf-slug').value.trim() || undefined,
      icon: document.getElementById('cf-icon').value.trim() || 'ti-category',
      iconUrl: document.getElementById('cf-icon-url').value.trim() || null,
      sortOrder: Number(document.getElementById('cf-sort').value) || 0,
      parentId: isSub ? parentId : null,
    };
    const data = id
      ? await api('/categories/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/categories', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      const parent =
        isSub && parentId ? categories.find((c) => catId(c) === Number(parentId)) : null;
      if (isSub && parent) {
        toast(`Subcategory "${name}" save hoyeche — ${parent.name_bn} er under`);
      } else {
        toast(id ? 'Category updated' : 'Category added');
      }
      closeCategoryModal();
      resetCategoryForm();
      loadCategories();
      loadCategoriesList();
    } else toast(data.error || 'Failed', 'error');
  };

  // ——— Coupons ———
  function updateCouponsSelectionUi() {
    const count = selectedCouponIds.size;
    const bulkBtn = document.getElementById('coupons-bulk-delete-btn');
    const clearBtn = document.getElementById('coupons-clear-selection-btn');
    const countEl = document.getElementById('coupons-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncCouponsSelectAllCheckbox();
  }

  function syncCouponsSelectAllCheckbox() {
    const selectAll = document.getElementById('coupons-select-all');
    const checks = [...document.querySelectorAll('#coupons-tbody .coupon-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteSelectedCoupons() {
    const ids = [...selectedCouponIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected coupon(s) permanently? This cannot be undone.`)) return;
    const data = await api('/coupons/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      toast(`${data.deleted || ids.length} coupon(s) deleted`);
      selectedCouponIds.clear();
      updateCouponsSelectionUi();
      loadCoupons();
    } else {
      toast(data.error || 'Could not delete selected coupons', 'error');
    }
  }

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
    const tbody = document.getElementById('coupons-tbody');
    if (!coupons?.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">No coupons yet.</td></tr>';
      updateCouponsSelectionUi();
      return;
    }
    tbody.innerHTML = coupons
      .map((c) => {
        const checked = selectedCouponIds.has(Number(c.id)) ? ' checked' : '';
        const rowClass = checked ? ' class="row-selected"' : '';
        return `<tr${rowClass}>
        <td class="tbl-check-col"><input type="checkbox" class="coupon-row-check" data-coupon-id="${c.id}" aria-label="Select coupon ${escHtml(c.code)}"${checked}></td>
        <td><code style="background:#E8F3EA;padding:3px 8px;border-radius:4px;font-weight:700;">${escHtml(c.code)}</code></td>
        <td>${escHtml(c.discount_type)}</td><td>${c.discount_type === 'percent' ? c.discount_value + '%' : '৳' + c.discount_value}</td>
        <td>৳${Number(c.min_order).toLocaleString()}</td>
        <td>${c.used_count}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
        <td>${c.expires_at ? String(c.expires_at).slice(0, 10) : '—'}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-edit-cp="${c.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-xs" data-del-coupon="${c.id}">Delete</button></td></tr>`;
      })
      .join('');
    updateCouponsSelectionUi();
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
          selectedCouponIds.delete(Number(btn.dataset.delCoupon));
          updateCouponsSelectionUi();
          loadCoupons();
        } else toast(r.error || 'Failed', 'error');
      };
    });
  }

  document.getElementById('coupons-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#coupons-tbody .coupon-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.couponId);
      if (checked) selectedCouponIds.add(id);
      else selectedCouponIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateCouponsSelectionUi();
  });

  document.getElementById('coupons-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedCoupons();
  });

  document.getElementById('coupons-clear-selection-btn')?.addEventListener('click', () => {
    selectedCouponIds.clear();
    document.querySelectorAll('#coupons-tbody .coupon-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateCouponsSelectionUi();
  });

  const couponsTbody = document.getElementById('coupons-tbody');
  if (couponsTbody && !couponsTbody._rakuCouponActionsBound) {
    couponsTbody._rakuCouponActionsBound = true;
    couponsTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.coupon-row-check');
      if (!check) return;
      const id = Number(check.dataset.couponId);
      if (check.checked) selectedCouponIds.add(id);
      else selectedCouponIds.delete(id);
      check.closest('tr')?.classList.toggle('row-selected', check.checked);
      updateCouponsSelectionUi();
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

  const FOOTER_PAGE_OPTIONS = [
    { value: 'home', label: 'Home' },
    { value: 'cart', label: 'My Cart' },
    { value: 'account', label: 'My Account' },
    { value: 'appointment', label: 'Book Appointment' },
    { value: 'track', label: 'Track Order' },
    { value: 'faq', label: 'FAQ' },
    { value: 'about', label: 'About Us' },
    { value: 'contact', label: 'Contact Us' },
    { value: 'privacy', label: 'Privacy Policy' },
    { value: 'terms', label: 'Terms & Conditions' },
    { value: 'return', label: 'Return Policy' },
    { value: 'points', label: 'Reward Point Policy' },
  ];

  const FOOTER_HREF_TO_PAGE = {
    '/': 'home',
    '/cart': 'cart',
    '/account': 'account',
    '/appointment': 'appointment',
    '/track': 'track',
    '/faq': 'faq',
    '/about': 'about',
    '/contact': 'contact',
    '/privacy-policy': 'privacy',
    '/terms-and-conditions': 'terms',
    '/return-policy': 'return',
    '/reward-point-policy': 'points',
  };

  function normalizeFooterLinkForEditor(link) {
    const label = String(link?.label || '').trim();
    if (link?.page) {
      return { label, targetType: 'page', page: link.page, href: '' };
    }
    const href = String(link?.href || '#').trim();
    const mappedPage = FOOTER_HREF_TO_PAGE[href];
    if (mappedPage) {
      return { label, targetType: 'page', page: mappedPage, href: '' };
    }
    return { label, targetType: 'url', page: 'home', href: href || '#' };
  }

  function footerPageOptionsHtml(selected) {
    return FOOTER_PAGE_OPTIONS.map(
      (opt) =>
        `<option value="${escHtml(opt.value)}"${opt.value === selected ? ' selected' : ''}>${escHtml(opt.label)}</option>`
    ).join('');
  }

  function footerLinkRowHtml(link) {
    const norm = normalizeFooterLinkForEditor(link);
    return `<div class="footer-link-row">
      <div class="form-group">
        <label class="form-label">Link label</label>
        <input class="form-input" type="text" data-fl-label value="${escHtml(norm.label)}" placeholder="e.g. Home">
      </div>
      <div class="form-group">
        <label class="form-label">Link type</label>
        <select class="form-input form-select" data-fl-type>
          <option value="page"${norm.targetType === 'page' ? ' selected' : ''}>Store page</option>
          <option value="url"${norm.targetType === 'url' ? ' selected' : ''}>Custom URL</option>
        </select>
      </div>
      <div class="footer-link-target">
        <div class="form-group footer-link-target-page" data-fl-page-wrap style="display:${norm.targetType === 'page' ? '' : 'none'};">
          <label class="form-label">Page</label>
          <select class="form-input form-select" data-fl-page>${footerPageOptionsHtml(norm.page)}</select>
        </div>
        <div class="form-group footer-link-target-url" data-fl-href-wrap style="display:${norm.targetType === 'url' ? '' : 'none'};">
          <label class="form-label">URL</label>
          <input class="form-input" type="text" data-fl-href value="${escHtml(norm.href)}" placeholder="/track or https://...">
        </div>
      </div>
      <button type="button" class="btn btn-danger btn-sm footer-link-remove" data-fl-remove title="Remove link"><i class="ti ti-trash"></i></button>
    </div>`;
  }

  function toggleFooterLinkTargetRow(row) {
    if (!row) return;
    const type = row.querySelector('[data-fl-type]')?.value || 'url';
    const pageWrap = row.querySelector('[data-fl-page-wrap]');
    const hrefWrap = row.querySelector('[data-fl-href-wrap]');
    if (pageWrap) pageWrap.style.display = type === 'page' ? '' : 'none';
    if (hrefWrap) hrefWrap.style.display = type === 'url' ? '' : 'none';
  }

  function bindFooterLinksEditor(container) {
    if (!container || container._footerLinksBound) return;
    container._footerLinksBound = true;
    container.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-fl-remove]');
      if (removeBtn) {
        removeBtn.closest('.footer-link-row')?.remove();
      }
    });
    container.addEventListener('change', (e) => {
      if (e.target.matches('[data-fl-type]')) {
        toggleFooterLinkTargetRow(e.target.closest('.footer-link-row'));
      }
    });
  }

  function renderFooterLinksEditor(containerId, links) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const list = Array.isArray(links) && links.length ? links : [];
    el.innerHTML = list.map((link) => footerLinkRowHtml(link)).join('');
    bindFooterLinksEditor(el);
    el.querySelectorAll('.footer-link-row').forEach(toggleFooterLinkTargetRow);
  }

  function addFooterLinkRow(containerId, link) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.insertAdjacentHTML('beforeend', footerLinkRowHtml(link || { label: '', page: 'home' }));
    bindFooterLinksEditor(el);
    const row = el.querySelector('.footer-link-row:last-child');
    toggleFooterLinkTargetRow(row);
    row?.querySelector('[data-fl-label]')?.focus();
  }

  function collectFooterLinksFromEditor(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return JSON.stringify([]);
    const links = [];
    el.querySelectorAll('.footer-link-row').forEach((row) => {
      const label = row.querySelector('[data-fl-label]')?.value?.trim();
      if (!label) return;
      const type = row.querySelector('[data-fl-type]')?.value || 'url';
      if (type === 'page') {
        const page = row.querySelector('[data-fl-page]')?.value || 'home';
        links.push({ label, page });
      } else {
        const href = row.querySelector('[data-fl-href]')?.value?.trim() || '#';
        links.push({ label, href });
      }
    });
    return JSON.stringify(links);
  }

  document.querySelectorAll('.footer-links-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.footerLinksTarget;
      if (target) addFooterLinkRow(target);
    });
  });

  async function loadSettings() {
    const data = await api('/settings');
    if (!data.ok) return;
    const s = data.settings;
    window._lastSettingsCache = s;
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
    if (lu) lu.value = s.site_logo_url || '/images/rakushopbd-logo.png?v=14';
    const sf = document.getElementById('set-social-facebook');
    if (sf) sf.value = s.social_facebook || '';
    const si = document.getElementById('set-social-instagram');
    if (si) si.value = s.social_instagram || '';
    const sy = document.getElementById('set-social-youtube');
    if (sy) sy.value = s.social_youtube || '';
    const sw = document.getElementById('set-social-whatsapp');
    if (sw) sw.value = s.social_whatsapp || '';
    renderFooterLinksEditor('footer-quick-links-editor', parseFooterLinksAdmin(s.footer_quick_links));
    renderFooterLinksEditor('footer-help-links-editor', parseFooterLinksAdmin(s.footer_help_links));
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
    const notifyEmail = document.getElementById('set-notify-email');
    if (notifyEmail) notifyEmail.value = s.notify_email || 'diderjp@gmail.com';
    fillSmtpSettings(s);
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
    const seoTwitter = document.getElementById('set-seo-twitter');
    if (seoTwitter) seoTwitter.value = s.seo_twitter_handle || '';
    const seoHome = document.getElementById('set-seo-home-title');
    if (seoHome) seoHome.value = s.seo_home_title || '';
    const trGsc = document.getElementById('set-tracking-gsc');
    if (trGsc) trGsc.value = s.seo_google_verification || '';
    const trGa4 = document.getElementById('set-tracking-ga4');
    if (trGa4) trGa4.value = s.tracking_ga4_id || '';
    const trGtm = document.getElementById('set-tracking-gtm');
    if (trGtm) trGtm.value = s.tracking_gtm_id || '';
    const trFb = document.getElementById('set-tracking-fb');
    if (trFb) trFb.value = s.tracking_facebook_pixel_id || '';
    const trHead = document.getElementById('set-tracking-head');
    if (trHead) trHead.value = s.tracking_scripts_head || '';
    const trBody = document.getElementById('set-tracking-body');
    if (trBody) trBody.value = s.tracking_scripts_body || '';
    const trFooter = document.getElementById('set-tracking-footer');
    if (trFooter) trFooter.value = s.tracking_scripts_footer || '';
    fillRewardPointSettings(s);
    fillLegalForm(s);
  }

  function fillSmtpSettings(s) {
    if (!s) return;
    const host = document.getElementById('set-smtp-host');
    if (host) host.value = s.smtp_host || 'smtp.gmail.com';
    const port = document.getElementById('set-smtp-port');
    if (port) port.value = s.smtp_port || '587';
    const user = document.getElementById('set-smtp-user');
    if (user) user.value = s.smtp_user || '';
    const pass = document.getElementById('set-smtp-pass');
    const saved = String(s.smtp_pass_set ?? '') === '1';
    if (pass) {
      pass.value = '';
      pass.placeholder = saved
        ? 'Password saved (hidden) — type only to change'
        : '16-character app password';
      pass.classList.toggle('smtp-pass-input--saved', saved);
    }
    const status = document.getElementById('set-smtp-pass-status');
    if (status) status.hidden = !saved;
    const hint = document.getElementById('set-smtp-pass-hint');
    if (hint) {
      hint.textContent = saved
        ? 'Your app password is stored securely. Leave this field empty unless you want to change it.'
        : 'Gmail: create an App Password at myaccount.google.com/apppasswords';
    }
  }

  function applySettingsResponse(settings) {
    if (!settings) return;
    window._lastSettingsCache = { ...(window._lastSettingsCache || {}), ...settings };
    fillSmtpSettings(settings);
  }

  function collectSmtpSettings() {
    const pass = document.getElementById('set-smtp-pass')?.value || '';
    const out = {
      notify_email: document.getElementById('set-notify-email')?.value?.trim() || 'diderjp@gmail.com',
      smtp_host: document.getElementById('set-smtp-host')?.value?.trim() || 'smtp.gmail.com',
      smtp_port: document.getElementById('set-smtp-port')?.value?.trim() || '587',
      smtp_user: document.getElementById('set-smtp-user')?.value?.trim() || '',
      feature_email_notify: document.getElementById('set-email-notify')?.checked ? '1' : '0',
    };
    if (pass.trim()) out.smtp_pass = pass.trim();
    return out;
  }

  function fillRewardPointSettings(s) {
    if (!s) return;
    const en = document.getElementById('set-rp-enabled');
    if (en) en.checked = s.reward_points_enabled !== '0';
    const map = [
      ['set-rp-per-taka', 'reward_points_per_taka', '100'],
      ['set-rp-registration', 'reward_points_registration', '100'],
      ['set-rp-first-order', 'reward_points_first_order', '20'],
      ['set-rp-review', 'reward_points_review', '10'],
      ['set-rp-photo-review', 'reward_points_photo_review', '10'],
      ['set-rp-video-review', 'reward_points_video_review', '100'],
      ['set-rp-referral', 'reward_points_referral', '50'],
      ['set-rp-referral-signup', 'reward_points_referral_signup', '50'],
      ['set-rp-min-redeem', 'reward_points_min_redeem', '100'],
      ['set-rp-max-percent', 'reward_points_max_order_percent', '50'],
    ];
    map.forEach(([id, key, fallback]) => {
      const el = document.getElementById(id);
      if (el) el.value = s[key] != null && s[key] !== '' ? s[key] : fallback;
    });
  }

  function collectRewardPointSettings() {
    return {
      reward_points_enabled: document.getElementById('set-rp-enabled')?.checked ? '1' : '0',
      reward_points_per_taka: document.getElementById('set-rp-per-taka')?.value || '100',
      reward_points_registration: document.getElementById('set-rp-registration')?.value || '0',
      reward_points_first_order: document.getElementById('set-rp-first-order')?.value || '0',
      reward_points_review: document.getElementById('set-rp-review')?.value || '0',
      reward_points_photo_review: document.getElementById('set-rp-photo-review')?.value || '0',
      reward_points_video_review: document.getElementById('set-rp-video-review')?.value || '0',
      reward_points_referral: document.getElementById('set-rp-referral')?.value || '0',
      reward_points_referral_signup: document.getElementById('set-rp-referral-signup')?.value || '0',
      reward_points_min_redeem: document.getElementById('set-rp-min-redeem')?.value || '100',
      reward_points_max_order_percent: document.getElementById('set-rp-max-percent')?.value || '50',
    };
  }

  function loadLegalPages() {
    const data = window._lastSettingsCache;
    if (data) {
      fillLegalForm(data);
      return;
    }
    api('/settings').then((res) => {
      if (res.ok) {
        window._lastSettingsCache = res.settings;
        fillLegalForm(res.settings);
      }
    });
  }

  function fillLegalForm(s) {
    if (!s) return;
    const heading = document.getElementById('set-footer-legal-heading');
    if (heading) heading.value = s.footer_legal_heading || 'Legal';
    const map = [
      ['legal-privacy-title', 'legal_privacy_title'],
      ['legal-privacy-content', 'legal_privacy_content'],
      ['legal-terms-title', 'legal_terms_title'],
      ['legal-terms-content', 'legal_terms_content'],
      ['legal-return-title', 'legal_return_title'],
      ['legal-return-content', 'legal_return_content'],
      ['legal-preorder-title', 'legal_preorder_title'],
      ['legal-preorder-content', 'legal_preorder_content'],
      ['legal-points-title', 'legal_points_title'],
      ['legal-points-content', 'legal_points_content'],
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const value = s[key] || '';
      const plainHtml = window.RakuRichEditor?.isPlainHtmlEditor?.(id);
      if (id.endsWith('-content') && window.RakuRichEditor && !plainHtml) {
        window.RakuRichEditor.setContent(id, value);
      } else {
        el.value = value;
      }
    });
    window.RakuRichEditor?.initPageEditors();
  }

  function collectLegalSettings() {
    window.RakuRichEditor?.syncAll();
    return {
      footer_legal_heading: document.getElementById('set-footer-legal-heading')?.value?.trim() || 'Legal',
      legal_privacy_title: document.getElementById('legal-privacy-title')?.value?.trim() || 'Privacy Policy',
      legal_privacy_content: document.getElementById('legal-privacy-content')?.value || '',
      legal_terms_title: document.getElementById('legal-terms-title')?.value?.trim() || 'Terms & Conditions',
      legal_terms_content: document.getElementById('legal-terms-content')?.value || '',
      legal_return_title: document.getElementById('legal-return-title')?.value?.trim() || 'Return Policy',
      legal_return_content: document.getElementById('legal-return-content')?.value || '',
      legal_preorder_title: document.getElementById('legal-preorder-title')?.value?.trim() || 'Pre-Order Policy',
      legal_preorder_content: document.getElementById('legal-preorder-content')?.value || '',
      legal_points_title: document.getElementById('legal-points-title')?.value?.trim() || 'Reward Point Policy',
      legal_points_content:
        document.getElementById('legal-points-content')?.value ||
        window.RakuRichEditor?.getContent?.('legal-points-content') ||
        '',
    };
  }

  function switchLegalTab(tabId) {
    const root = document.getElementById('sec-legal');
    if (!root || !tabId) return;
    root.querySelectorAll('[data-legal-tab]').forEach((t) => {
      t.classList.toggle('active', t.dataset.legalTab === tabId);
    });
    root.querySelectorAll('#legal-form .settings-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `legal-panel-${tabId}`);
    });
  }

  function initLegalTabs() {
    const root = document.getElementById('sec-legal');
    if (!root || root._legalTabsBound) return;
    root._legalTabsBound = true;
    root.querySelectorAll('[data-legal-tab]').forEach((tab) => {
      tab.addEventListener('click', () => switchLegalTab(tab.dataset.legalTab));
    });
  }

  function switchMarketingTab(tabId) {
    const root = document.getElementById('sec-marketing');
    if (!root || !tabId) return;
    root.querySelectorAll('[data-marketing-tab]').forEach((t) => {
      t.classList.toggle('active', t.dataset.marketingTab === tabId);
    });
    root.querySelectorAll('.settings-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `marketing-panel-${tabId}`);
    });
  }

  function initMarketingTabs() {
    const root = document.getElementById('sec-marketing');
    if (!root || root._marketingTabsBound) return;
    root._marketingTabsBound = true;
    root.querySelectorAll('[data-marketing-tab]').forEach((tab) => {
      tab.addEventListener('click', () => switchMarketingTab(tab.dataset.marketingTab));
    });
  }

  initLegalTabs();
  initMarketingTabs();

  async function loadAnalytics() {
    const data = await api('/analytics');
    if (!data.ok) return;
    const s = data.stats;
    document.getElementById('analytics-stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon" style="background:#E8F3EA;"><i class="ti ti-shopping-bag"></i></div><div><div class="stat-num">${s.monthOrders}</div><div class="stat-label">Orders this month</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="ti ti-users"></i></div><div><div class="stat-num">${s.monthCustomers}</div><div class="stat-label">New customers</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="ti ti-receipt"></i></div><div><div class="stat-num">${s.avgOrderFormatted}</div><div class="stat-label">Avg. order value</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fee2e2;"><i class="ti ti-chart-line"></i></div><div><div class="stat-num">—</div><div class="stat-label">Top products below</div></div></div>`;
    document.getElementById('analytics-tbody').innerHTML = data.topProducts
      .map((p) => `<tr><td>${p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}</td><td>${p.name}</td><td>${p.qty}</td><td>${p.revenueFormatted}</td></tr>`)
      .join('');
  }

  function updateReviewsSelectionUi() {
    const count = selectedReviewIds.size;
    const bulkBtn = document.getElementById('reviews-bulk-delete-btn');
    const clearBtn = document.getElementById('reviews-clear-selection-btn');
    const countEl = document.getElementById('reviews-selected-count');
    if (countEl) countEl.textContent = String(count);
    if (bulkBtn) bulkBtn.hidden = count === 0;
    if (clearBtn) clearBtn.hidden = count === 0;
    syncReviewsSelectAllCheckbox();
  }

  function syncReviewsSelectAllCheckbox() {
    const selectAll = document.getElementById('reviews-select-all');
    const checks = [...document.querySelectorAll('#reviews-tbody .review-row-check')];
    if (!selectAll) return;
    if (!checks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const checkedOnPage = checks.filter((c) => c.checked).length;
    selectAll.checked = checkedOnPage === checks.length;
    selectAll.indeterminate = checkedOnPage > 0 && checkedOnPage < checks.length;
  }

  async function deleteSelectedReviews() {
    const ids = [...selectedReviewIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected review(s) permanently? This cannot be undone.`)) return;
    const data = await api('/reviews/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    if (data.ok) {
      toast(`${data.deleted || ids.length} review(s) deleted`);
      selectedReviewIds.clear();
      updateReviewsSelectionUi();
      loadReviews();
    } else {
      toast(data.error || 'Could not delete selected reviews', 'error');
    }
  }

  async function loadReviews(page) {
    if (page) reviewsPage = page;
    const status = document.getElementById('reviews-filter').value;
    const q = new URLSearchParams({ page: reviewsPage, limit: 10 });
    if (status !== 'all') q.set('status', status);
    const data = await api('/reviews?' + q.toString());
    if (!data.ok) return toast(data.error || 'Load failed', 'error');
    const rb = document.getElementById('review-badge');
    if (rb) rb.textContent = data.pendingCount || 0;
    const tbody = document.getElementById('reviews-tbody');
    if (!data.reviews?.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:24px;">No reviews found.</td></tr>';
      updateReviewsSelectionUi();
      const pagEl = document.getElementById('reviews-pagination');
      if (pagEl) pagEl.innerHTML = '';
      return;
    }
    tbody.innerHTML = data.reviews
      .map((r) => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const checked = selectedReviewIds.has(Number(r.id)) ? ' checked' : '';
        const rowClass = checked ? ' class="row-selected"' : '';
        const avatar = r.reviewer_avatar_url
          ? `<img src="${escHtml(r.reviewer_avatar_url)}" alt="" class="tbl-avatar" loading="lazy" decoding="async" onerror="this.remove();">`
          : `<div class="tbl-avatar-fallback">${escHtml(String(r.customer_name || 'C')[0] || 'C')}</div>`;
        return `<tr${rowClass}>
        <td class="tbl-check-col"><input type="checkbox" class="review-row-check" data-review-id="${r.id}" aria-label="Select review from ${escHtml(r.customer_name)}"${checked}></td>
        <td>${avatar}</td>
        <td>${escHtml(r.customer_name)}</td><td>${escHtml(r.product_name)}</td><td style="color:#EF9F27;">${stars}</td>
        <td>${escHtml(String(r.comment || '').slice(0, 40))}</td><td>${fmtDate(r.created_at)}</td>
        <td><span class="badge badge-${r.status === 'approved' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}">${escHtml(r.status)}</span></td>
        <td>${r.status === 'pending' ? `<button class="btn btn-primary btn-xs" data-approve="${r.id}">Approve</button>` : ''}
        <button class="btn btn-outline btn-xs" data-edit-review="${r.id}">Edit</button>
        <button class="btn btn-danger btn-xs" data-del-review="${r.id}">Delete</button></td></tr>`;
      })
      .join('');
    updateReviewsSelectionUi();

    const pag = data.pagination;
    const pagEl = document.getElementById('reviews-pagination');
    if (pagEl && pag) {
      pagEl.innerHTML = `<span>Page ${pag.page} of ${pag.pages} (${pag.total} reviews)</span><div>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} data-rp="-1">← Prev</button>
        <button type="button" class="btn btn-outline btn-sm" ${pag.page >= pag.pages ? 'disabled' : ''} data-rp="1">Next →</button></div>`;
      pagEl.querySelectorAll('button[data-rp]').forEach((b) => {
        b.onclick = () => loadReviews(reviewsPage + Number(b.dataset.rp));
      });
    }

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
        selectedReviewIds.delete(Number(b.dataset.delReview));
        updateReviewsSelectionUi();
        loadReviews();
      };
    });

    document.querySelectorAll('[data-edit-review]').forEach((b) => {
      b.onclick = () => {
        const id = Number(b.dataset.editReview);
        const rev = data.reviews.find((x) => Number(x.id) === id);
        if (rev) openReviewModal(rev);
      };
    });
  }

  document.getElementById('reviews-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#reviews-tbody .review-row-check').forEach((box) => {
      box.checked = checked;
      const id = Number(box.dataset.reviewId);
      if (checked) selectedReviewIds.add(id);
      else selectedReviewIds.delete(id);
      box.closest('tr')?.classList.toggle('row-selected', checked);
    });
    e.target.indeterminate = false;
    updateReviewsSelectionUi();
  });

  document.getElementById('reviews-bulk-delete-btn')?.addEventListener('click', () => {
    void deleteSelectedReviews();
  });

  document.getElementById('reviews-clear-selection-btn')?.addEventListener('click', () => {
    selectedReviewIds.clear();
    document.querySelectorAll('#reviews-tbody .review-row-check').forEach((box) => {
      box.checked = false;
      box.closest('tr')?.classList.remove('row-selected');
    });
    updateReviewsSelectionUi();
  });

  const reviewsTbody = document.getElementById('reviews-tbody');
  if (reviewsTbody && !reviewsTbody._rakuReviewActionsBound) {
    reviewsTbody._rakuReviewActionsBound = true;
    reviewsTbody.addEventListener('click', (e) => {
      const check = e.target.closest('.review-row-check');
      if (!check) return;
      const id = Number(check.dataset.reviewId);
      if (check.checked) selectedReviewIds.add(id);
      else selectedReviewIds.delete(id);
      check.closest('tr')?.classList.toggle('row-selected', check.checked);
      updateReviewsSelectionUi();
    });
  }

  document.getElementById('reviews-filter').onchange = () => loadReviews(1);

  async function loadReviewVideos() {
    const status = document.getElementById('review-videos-filter')?.value || 'pending';
    const data = await api('/review-videos?status=' + encodeURIComponent(status));
    if (!data.ok) return toast(data.error || 'Load failed', 'error');
    const badge = document.getElementById('review-video-badge');
    if (badge) badge.textContent = data.pendingCount || 0;
    const tbody = document.getElementById('review-videos-tbody');
    if (!tbody) return;
    if (!data.videos?.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">No review videos found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.videos
      .map((v) => {
        const statusCls =
          v.status === 'approved' ? 'green' : v.status === 'pending' ? 'amber' : 'red';
        const videoCell = v.videoUrl
          ? `<a href="${escHtml(v.videoUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-xs"><i class="ti ti-player-play"></i> Watch</a>`
          : '—';
        const approveBtn =
          v.status === 'pending'
            ? `<button type="button" class="btn btn-primary btn-xs" data-approve-rv="${v.id}">Approve</button>`
            : '';
        const rejectBtn =
          v.status === 'pending'
            ? `<button type="button" class="btn btn-outline btn-xs" data-reject-rv="${v.id}">Reject</button>`
            : '';
        return `<tr>
          <td>${escHtml(v.customerName || 'Customer')}</td>
          <td>#${escHtml(v.orderNumber || v.orderId || '')}</td>
          <td>${escHtml(v.productName || '')}</td>
          <td>${videoCell}</td>
          <td>${fmtDate(v.createdAt)}</td>
          <td><span class="badge badge-${statusCls}">${escHtml(v.status)}</span></td>
          <td>${approveBtn} ${rejectBtn}
            <button type="button" class="btn btn-danger btn-xs" data-del-rv="${v.id}">Delete</button></td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-approve-rv]').forEach((btn) => {
      btn.onclick = async () => {
        const res = await api('/review-videos/' + btn.dataset.approveRv, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
        });
        if (res.ok) {
          toast(
            res.pointsAwarded
              ? `Approved — ${res.pointsAwarded} points awarded`
              : 'Review video approved'
          );
          loadReviewVideos();
        } else toast(res.error || 'Approve failed', 'error');
      };
    });
    tbody.querySelectorAll('[data-reject-rv]').forEach((btn) => {
      btn.onclick = async () => {
        const note = prompt('Optional note for customer (why rejected):') || '';
        const res = await api('/review-videos/' + btn.dataset.rejectRv, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'rejected', adminNote: note }),
        });
        if (res.ok) {
          toast('Review video rejected');
          loadReviewVideos();
        } else toast(res.error || 'Reject failed', 'error');
      };
    });
    tbody.querySelectorAll('[data-del-rv]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this review video?')) return;
        await api('/review-videos/' + btn.dataset.delRv, { method: 'DELETE' });
        loadReviewVideos();
      };
    });
  }

  document.getElementById('review-videos-filter')?.addEventListener('change', loadReviewVideos);

  // ——— Review modal (create/edit) ———
  function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('rev-product-pick')?.setAttribute('hidden', 'true');
  }

  function openReviewModal(review) {
    const modal = document.getElementById('review-modal');
    if (!modal) return;
    document.getElementById('review-form-title').textContent = review?.id ? 'Edit Review' : 'Add Review';
    document.getElementById('rev-id').value = review?.id || '';
    document.getElementById('rev-product-id').value = review?.product_id || review?.productId || '';
    document.getElementById('rev-product-search').value = review?.product_name || review?.productName || '';
    const pickedHint = document.getElementById('rev-product-picked-hint');
    const pid = review?.product_id || review?.productId || '';
    if (pickedHint) {
      pickedHint.textContent = pid
        ? `Selected: ${review?.product_name || review?.productName || 'Product'} (#${pid})`
        : 'Select a product from search results.';
    }
    document.getElementById('rev-name').value = review?.customer_name || review?.customerName || '';
    document.getElementById('rev-city').value = review?.reviewer_city || review?.reviewerCity || '';
    document.getElementById('rev-rating').value = String(review?.rating || 5);
    document.getElementById('rev-comment').value = review?.comment || '';
    document.getElementById('rev-status').value = review?.status || 'approved';
    document.getElementById('rev-image').value = review?.image_url || review?.imageUrl || '';
    document.getElementById('rev-avatar').value = review?.reviewer_avatar_url || review?.reviewerAvatarUrl || '';
    const file = document.getElementById('rev-avatar-file');
    if (file) file.value = '';
    const wrap = document.getElementById('rev-avatar-preview-wrap');
    const img = document.getElementById('rev-avatar-preview');
    if (wrap && img) {
      const url = (review?.reviewer_avatar_url || review?.reviewerAvatarUrl || '').trim();
      if (url) {
        img.src = url;
        wrap.hidden = false;
      } else {
        img.removeAttribute('src');
        wrap.hidden = true;
      }
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  document.getElementById('add-review-btn')?.addEventListener('click', () => openReviewModal(null));
  document.getElementById('review-modal-close')?.addEventListener('click', closeReviewModal);
  document.getElementById('review-modal-cancel')?.addEventListener('click', closeReviewModal);
  document.getElementById('rev-reset')?.addEventListener('click', () => openReviewModal(null));

  document.getElementById('review-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'review-modal') closeReviewModal();
  });

  // Product search picker inside review modal (uses existing admin products endpoint)
  const revSearch = document.getElementById('rev-product-search');
  const revPick = document.getElementById('rev-product-pick');
  const revProdId = document.getElementById('rev-product-id');
  const revPickedHint = document.getElementById('rev-product-picked-hint');
  const revPickState = { items: [] };

  async function searchReviewProducts(q) {
    const data = await api('/products?limit=12&page=1&search=' + encodeURIComponent(q || ''));
    if (!data.ok) return [];
    return (data.products || []).map((p) => ({ id: p.id, name: p.name_bn || p.slug || `#${p.id}` }));
  }

  function renderReviewProductPick(items) {
    if (!revPick) return;
    revPickState.items = items || [];
    if (!items?.length) {
      revPick.hidden = true;
      revPick.innerHTML = '';
      return;
    }
    revPick.hidden = false;
    revPick.innerHTML = items
      .map((p) => `<button type="button" class="picker-item" data-pick-id="${p.id}">${escHtml(p.name)} <span class="muted">#${p.id}</span></button>`)
      .join('');
    revPick.querySelectorAll('[data-pick-id]').forEach((btn) => {
      btn.onclick = () => {
        const id = Number(btn.dataset.pickId);
        const item = items.find((x) => Number(x.id) === id);
        if (!item) return;
        if (revProdId) revProdId.value = String(item.id);
        if (revSearch) revSearch.value = item.name;
        if (revPickedHint) revPickedHint.textContent = `Selected: ${item.name} (#${item.id})`;
        renderReviewProductPick([]);
      };
    });
  }

  if (revSearch) {
    revSearch.addEventListener(
      'input',
      debounce(async () => {
        const q = revSearch.value.trim();
        if (!q) return renderReviewProductPick([]);
        const items = await searchReviewProducts(q);
        renderReviewProductPick(items);
      }, 250)
    );
    revSearch.addEventListener('focus', () => {
      if (revPickState.items?.length) revPick.hidden = false;
    });
  }

  document.addEventListener('click', (e) => {
    if (!revPick || revPick.hidden) return;
    if (e.target.closest('#rev-product-pick') || e.target.closest('#rev-product-search')) return;
    renderReviewProductPick([]);
  });

  // Avatar upload preview + upload
  document.getElementById('rev-avatar-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wrap = document.getElementById('rev-avatar-preview-wrap');
      const img = document.getElementById('rev-avatar-preview');
      if (wrap && img) {
        img.src = reader.result;
        wrap.hidden = false;
      }
    };
    reader.readAsDataURL(f);
  });

  document.getElementById('review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rev-id')?.value || '';
    const productId = Number(document.getElementById('rev-product-id')?.value || 0);
    const customerName = document.getElementById('rev-name')?.value?.trim() || '';
    const rating = Number(document.getElementById('rev-rating')?.value || 0);
    const comment = document.getElementById('rev-comment')?.value?.trim() || '';
    const status = document.getElementById('rev-status')?.value || 'approved';
    const city = document.getElementById('rev-city')?.value?.trim() || '';
    const imageUrl = document.getElementById('rev-image')?.value?.trim() || '';
    let avatarUrl = document.getElementById('rev-avatar')?.value?.trim() || '';

    if (!productId) return toast('Select a product', 'error');
    if (!customerName) return toast('Customer name is required', 'error');
    if (!rating) return toast('Rating is required', 'error');

    const f = document.getElementById('rev-avatar-file');
    if (f?.files?.[0]) {
      const fd = new FormData();
      fd.append('image', f.files[0]);
      const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', headers: adminUploadHeaders(), body: fd });
      const upData = await up.json();
      if (upData.ok) avatarUrl = upData.url;
      else return toast(upData.error || 'Avatar upload failed', 'error');
    }

    const body = { productId, customerName, rating, comment, status, city: city || null, imageUrl: imageUrl || null, avatarUrl: avatarUrl || null };
    const res = id
      ? await api('/reviews/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/reviews', { method: 'POST', body: JSON.stringify(body) });

    if (res.ok) {
      toast(id ? 'Review updated' : 'Review added');
      closeReviewModal();
      loadReviews();
    } else {
      toast(res.error || 'Save failed', 'error');
    }
  });

  function syncBannerFormByPosition() {
    const pos = document.getElementById('bn-position')?.value || 'hero';
    const isHero = pos === 'hero';
    document.querySelectorAll('.bn-field--hero-only').forEach((el) => {
      el.hidden = !isHero;
    });
    document.querySelectorAll('.bn-field--promo-only').forEach((el) => {
      el.hidden = isHero;
    });
    const titleInput = document.getElementById('bn-title');
    if (titleInput) titleInput.required = !isHero;
    const id = document.getElementById('bn-id')?.value;
    const titleEl = document.getElementById('banner-form-title');
    if (titleEl) {
      if (isHero) titleEl.textContent = id ? 'Edit Homepage Hero' : 'Add Homepage Hero';
      else titleEl.textContent = id ? 'Edit Banner' : 'Add Banner';
    }
  }

  function updateBannerPreview() {
    const wrap = document.getElementById('bn-preview-wrap');
    const img = document.getElementById('bn-preview');
    const url = document.getElementById('bn-image')?.value.trim();
    if (!wrap || !img) return;
    if (url) {
      img.src = url;
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
      img.removeAttribute('src');
    }
  }

  function resetBannerForm() {
    document.getElementById('banner-form-title').textContent = 'Add Homepage Hero';
    document.getElementById('bn-id').value = '';
    document.getElementById('banner-form').reset();
    document.getElementById('bn-link').value = '/';
    document.getElementById('bn-gradient').value = 'linear-gradient(135deg,#1E4620,#2D6B32)';
    document.getElementById('bn-sort').value = '0';
    document.getElementById('bn-active').checked = true;
    document.getElementById('bn-position').value = 'hero';
    const fileEl = document.getElementById('bn-file');
    if (fileEl) fileEl.value = '';
    updateBannerPreview();
    syncBannerFormByPosition();
  }

  async function loadBanners() {
    const data = await api('/banners');
    if (!data.ok) return;
    banners = data.banners;
    document.getElementById('banners-tbody').innerHTML = banners
      .map((b) => {
        const preview =
          b.position === 'hero'
            ? b.image_url
              ? `<img src="${b.image_url}" alt="" style="width:72px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`
              : '<span class="text-muted">No image</span>'
            : `<strong>${escHtml(b.title)}</strong>`;
        return `<tr><td>${preview}</td><td>${escHtml(b.position)}</td><td>${escHtml(b.link_url || '')}</td>
        <td><span class="badge badge-${b.is_active ? 'green' : 'gray'}">${b.is_active ? 'Active' : 'Off'}</span></td>
        <td><button type="button" class="btn btn-outline btn-xs" data-edit-bn="${b.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-xs" data-del-bn="${b.id}">Delete</button></td></tr>`;
      })
      .join('');
    document.querySelectorAll('[data-edit-bn]').forEach((btn) => {
      btn.onclick = () => {
        const b = banners.find((x) => x.id === Number(btn.dataset.editBn));
        if (!b) return;
        document.getElementById('bn-id').value = b.id;
        document.getElementById('bn-title').value = b.title;
        document.getElementById('bn-position').value = b.position;
        document.getElementById('bn-link').value = b.link_url || '/';
        document.getElementById('bn-gradient').value = b.bg_gradient || 'linear-gradient(135deg,#1E4620,#2D6B32)';
        document.getElementById('bn-image').value = b.image_url || '';
        document.getElementById('bn-expires').value = b.expires_at ? String(b.expires_at).slice(0, 10) : '';
        document.getElementById('bn-sort').value = b.sort_order ?? 0;
        document.getElementById('bn-active').checked = !!b.is_active;
        const fileEl = document.getElementById('bn-file');
        if (fileEl) fileEl.value = '';
        syncBannerFormByPosition();
        updateBannerPreview();
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
  document.getElementById('bn-position')?.addEventListener('change', syncBannerFormByPosition);
  document.getElementById('bn-image')?.addEventListener('input', updateBannerPreview);
  document.getElementById('bn-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wrap = document.getElementById('bn-preview-wrap');
      const img = document.getElementById('bn-preview');
      if (wrap && img) {
        img.src = reader.result;
        wrap.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  });
  syncBannerFormByPosition();

  document.getElementById('banner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let imageUrl = document.getElementById('bn-image').value.trim();
    const f = document.getElementById('bn-file');
    if (f?.files?.[0]) {
      const fd = new FormData();
      fd.append('image', f.files[0]);
      const up = await fetch(API + '/upload', { method: 'POST', credentials: 'same-origin', headers: adminUploadHeaders(), body: fd });
      const upData = await up.json();
      if (upData.ok) imageUrl = upData.url;
      else {
        toast(upData.error || 'Image upload failed', 'error');
        return;
      }
    }
    const position = document.getElementById('bn-position').value;
    const isHero = position === 'hero';
    if (isHero && !imageUrl) {
      toast('Upload a hero banner image', 'error');
      return;
    }
    const promoTitle = document.getElementById('bn-title').value.trim();
    if (!isHero && !promoTitle) {
      toast('Title is required', 'error');
      return;
    }
    const id = document.getElementById('bn-id').value;
    const body = {
      title: isHero ? 'Homepage hero' : promoTitle,
      position,
      linkUrl: document.getElementById('bn-link').value.trim() || '/',
      bgGradient: isHero
        ? 'linear-gradient(135deg,#1E4620,#2D6B32)'
        : document.getElementById('bn-gradient').value.trim(),
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

  // ——— Messenger chat screenshots ———
  function openMessengerModal() {
    const modal = document.getElementById('messenger-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('messenger-modal-open');
  }

  function closeMessengerModal() {
    const modal = document.getElementById('messenger-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('messenger-modal-open');
  }

  function resetMessengerForm() {
    document.getElementById('messenger-form-title').textContent = 'Add Messenger Screenshot';
    document.getElementById('msg-id').value = '';
    document.getElementById('msg-name').value = '';
    document.getElementById('msg-caption').value = '';
    document.getElementById('msg-image').value = '';
    document.getElementById('msg-sort').value = '0';
    document.getElementById('msg-active').checked = true;
    const fileEl = document.getElementById('msg-file');
    if (fileEl) fileEl.value = '';
    setMktImagePreview('msg-preview-wrap', 'msg-preview', '');
  }

  async function loadMessengerSettings() {
    const data = await api('/settings');
    if (!data.ok || !data.settings) return;
    const s = data.settings;
    const en = document.getElementById('msg-sec-enabled');
    if (en) en.checked = s.messenger_chats_enabled !== '0';
    const title = document.getElementById('msg-sec-title');
    const sub = document.getElementById('msg-sec-sub');
    if (title) title.value = s.messenger_chats_title || '';
    if (sub) sub.value = s.messenger_chats_subtitle || '';
  }

  async function loadMessengerChatsList() {
    const data = await api('/messenger-chats');
    if (!data.ok) return;
    messengerChats = data.chats || [];
    const tbody = document.getElementById('messenger-tbody');
    if (!tbody) return;

    if (!messengerChats.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;">No chat screenshots yet. Add your first Messenger screenshot.</td></tr>';
      return;
    }

    tbody.innerHTML = messengerChats
      .map((c) => {
        const src = escHtml(c.image_url || c.imageUrl || '');
        const active = c.is_active === true || c.is_active === 1 || c.is_active === '1';
        return `<tr>
          <td>${src ? `<img src="${src}" alt="" style="width:56px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);">` : '—'}</td>
          <td>${escHtml(c.customer_name || c.customerName || '—')}</td>
          <td>${escHtml(c.caption || '—')}</td>
          <td>${c.sort_order ?? c.sortOrder ?? 0}</td>
          <td><span class="badge badge-${active ? 'green' : 'gray'}">${active ? 'Active' : 'Hidden'}</span></td>
          <td>
            <button type="button" class="btn btn-outline btn-xs" data-edit-msg="${c.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-msg="${c.id}">Delete</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-edit-msg]').forEach((btn) => {
      btn.onclick = () => {
        const c = messengerChats.find((x) => x.id === Number(btn.dataset.editMsg));
        if (!c) return;
        document.getElementById('messenger-form-title').textContent = 'Edit Messenger Screenshot';
        document.getElementById('msg-id').value = c.id;
        document.getElementById('msg-name').value = c.customer_name || c.customerName || '';
        document.getElementById('msg-caption').value = c.caption || '';
        document.getElementById('msg-image').value = c.image_url || c.imageUrl || '';
        document.getElementById('msg-sort').value = c.sort_order ?? c.sortOrder ?? 0;
        document.getElementById('msg-active').checked =
          c.is_active === true || c.is_active === 1 || c.is_active === '1';
        const fileEl = document.getElementById('msg-file');
        if (fileEl) fileEl.value = '';
        setMktImagePreview('msg-preview-wrap', 'msg-preview', c.image_url || c.imageUrl);
        openMessengerModal();
      };
    });

    tbody.querySelectorAll('[data-del-msg]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this chat screenshot?')) return;
        const r = await api('/messenger-chats/' + btn.dataset.delMsg, { method: 'DELETE' });
        if (r.ok) {
          toast('Screenshot deleted');
          loadMessengerChatsList();
        } else toast(r.error || 'Failed', 'error');
      };
    });
  }

  async function loadMessengerChats() {
    await loadMessengerSettings();
    await loadMessengerChatsList();
  }

  document.getElementById('add-messenger-btn')?.addEventListener('click', () => {
    resetMessengerForm();
    openMessengerModal();
  });
  document.getElementById('messenger-modal-close')?.addEventListener('click', closeMessengerModal);
  document.getElementById('messenger-modal-cancel')?.addEventListener('click', closeMessengerModal);
  document.getElementById('messenger-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'messenger-modal') closeMessengerModal();
  });
  document.getElementById('msg-reset')?.addEventListener('click', resetMessengerForm);
  document.getElementById('msg-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMktImagePreview('msg-preview-wrap', 'msg-preview', URL.createObjectURL(f));
  });
  document.getElementById('msg-image')?.addEventListener('input', (e) => {
    setMktImagePreview('msg-preview-wrap', 'msg-preview', e.target.value);
  });

  document.getElementById('messenger-settings-save')?.addEventListener('click', async () => {
    const settings = {
      messenger_chats_enabled: document.getElementById('msg-sec-enabled')?.checked ? '1' : '0',
      messenger_chats_title: document.getElementById('msg-sec-title')?.value.trim() || '',
      messenger_chats_subtitle: document.getElementById('msg-sec-sub')?.value.trim() || '',
    };
    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
    if (data.ok) toast('Messenger section settings saved');
    else toast(data.error || 'Save failed', 'error');
  });

  document.getElementById('messenger-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let imageUrl = document.getElementById('msg-image').value.trim();
    const f = document.getElementById('msg-file')?.files?.[0];
    if (f) {
      const up = await uploadProductImage(f);
      if (!up.ok) {
        toast(up.error || 'Image upload failed', 'error');
        return;
      }
      imageUrl = up.url;
      document.getElementById('msg-image').value = imageUrl;
      document.getElementById('msg-file').value = '';
      setMktImagePreview('msg-preview-wrap', 'msg-preview', imageUrl);
    }
    if (!imageUrl) {
      toast('Please upload or paste a screenshot URL', 'error');
      return;
    }
    const id = document.getElementById('msg-id').value;
    const body = {
      customerName: document.getElementById('msg-name').value.trim(),
      caption: document.getElementById('msg-caption').value.trim(),
      imageUrl,
      sortOrder: Number(document.getElementById('msg-sort').value) || 0,
      isActive: document.getElementById('msg-active').checked,
    };
    const res = id
      ? await api('/messenger-chats/' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/messenger-chats', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      toast(id ? 'Screenshot updated' : 'Screenshot added');
      closeMessengerModal();
      resetMessengerForm();
      loadMessengerChatsList();
    } else toast(res.error || 'Failed', 'error');
  });

  function collectSeoSettings() {
    return {
      site_url: document.getElementById('set-site-url')?.value?.trim() || '',
      seo_home_title: document.getElementById('set-seo-home-title')?.value?.trim() || '',
      seo_meta_description: document.getElementById('set-seo-description')?.value?.trim() || '',
      seo_meta_keywords: document.getElementById('set-seo-keywords')?.value?.trim() || '',
      seo_og_image: document.getElementById('set-seo-og-image')?.value?.trim() || '',
      seo_twitter_handle: document.getElementById('set-seo-twitter')?.value?.trim() || '',
    };
  }

  function collectTrackingSettings() {
    return {
      seo_google_verification: document.getElementById('set-tracking-gsc')?.value?.trim() || '',
      tracking_ga4_id: document.getElementById('set-tracking-ga4')?.value?.trim() || '',
      tracking_gtm_id: document.getElementById('set-tracking-gtm')?.value?.trim() || '',
      tracking_facebook_pixel_id: document.getElementById('set-tracking-fb')?.value?.trim() || '',
      tracking_scripts_head: document.getElementById('set-tracking-head')?.value || '',
      tracking_scripts_body: document.getElementById('set-tracking-body')?.value || '',
      tracking_scripts_footer: document.getElementById('set-tracking-footer')?.value || '',
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
      footer_quick_links: collectFooterLinksFromEditor('footer-quick-links-editor'),
      footer_help_links: collectFooterLinksFromEditor('footer-help-links-editor'),
      free_delivery_min: document.getElementById('set-free-min').value,
      delivery_fee: document.getElementById('set-delivery-fee').value,
      delivery_fee_outside: document.getElementById('set-delivery-outside')?.value || '120',
      maintenance_mode: document.getElementById('set-maintenance').checked ? '1' : '0',
      feature_guest_checkout: document.getElementById('set-guest').checked ? '1' : '0',
      feature_cod: document.getElementById('set-cod').checked ? '1' : '0',
      feature_flash_sale: document.getElementById('set-flash')?.checked ? '1' : '0',
      feature_review_approval: document.getElementById('set-review-approval')?.checked ? '1' : '0',
      feature_sms_notify: document.getElementById('set-sms')?.checked ? '1' : '0',
      ...collectSmtpSettings(),
      ...collectSeoSettings(),
    };
  }

  const SETTINGS_STORE_TABS = new Set(['store', 'contact', 'footer']);

  function switchSettingsTab(tabId) {
    const root = document.getElementById('sec-settings');
    if (!root || !tabId) return;
    root.querySelectorAll('.settings-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.settingsTab === tabId);
    });
    root.querySelectorAll('.settings-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `settings-panel-${tabId}`);
    });
    const saveBar = document.getElementById('settings-save-bar');
    if (saveBar) saveBar.style.display = SETTINGS_STORE_TABS.has(tabId) ? '' : 'none';
    if (tabId === 'team' && isSuperAdminUser()) loadTeamAdmins();
  }

  async function loadTeamAdmins() {
    const tbody = document.getElementById('team-admins-tbody');
    if (!tbody || !isSuperAdminUser()) return;
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Loading team accounts...</td></tr>';
    const data = await api('/admins');
    if (!data.ok) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:20px;">${escHtml(data.error || 'Could not load team accounts')}</td></tr>`;
      return;
    }
    const admins = data.admins || [];
    if (!admins.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">No admin accounts yet.</td></tr>';
      return;
    }
    tbody.innerHTML = admins
      .map((a) => {
        const isSelf = Number(a.id) === Number(currentAdmin?.id);
        const roleBadge =
          a.role === 'product_editor'
            ? '<span class="badge badge-blue">Product Editor</span>'
            : '<span class="badge badge-green">Super Admin</span>';
        const deleteBtn =
          isSelf || a.role !== 'product_editor'
            ? ''
            : `<button type="button" class="btn btn-danger btn-xs" data-team-del="${a.id}">Remove</button>`;
        return `<tr>
          <td>${escHtml(a.fullName || a.username)}${isSelf ? ' <small>(you)</small>' : ''}</td>
          <td>${escHtml(a.username)}</td>
          <td>${escHtml(a.email)}</td>
          <td>${roleBadge}</td>
          <td class="tbl-actions">${deleteBtn}</td>
        </tr>`;
      })
      .join('');
    tbody.querySelectorAll('[data-team-del]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Remove this product editor account?')) return;
        const res = await api('/admins/' + btn.dataset.teamDel, { method: 'DELETE' });
        if (res.ok) {
          toast('Account removed');
          loadTeamAdmins();
        } else toast(res.error || 'Could not remove account', 'error');
      };
    });
  }

  document.getElementById('team-admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSuperAdminUser()) return;
    const body = {
      fullName: document.getElementById('team-full-name')?.value.trim(),
      username: document.getElementById('team-username')?.value.trim(),
      email: document.getElementById('team-email')?.value.trim(),
      password: document.getElementById('team-password')?.value,
      role: 'product_editor',
    };
    const data = await api('/admins', { method: 'POST', body: JSON.stringify(body) });
    if (data.ok) {
      toast('Product editor account created');
      e.target.reset();
      loadTeamAdmins();
    } else {
      toast(data.error || 'Could not create account', 'error');
    }
  });

  function initSettingsTabs() {
    const root = document.getElementById('sec-settings');
    if (!root || root._settingsTabsBound) return;
    root._settingsTabsBound = true;
    root.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchSettingsTab(tab.dataset.settingsTab));
    });
  }

  initSettingsTabs();

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
    if (data.ok) {
      toast('Settings saved');
      applySettingsResponse(data.settings);
    } else toast(data.error || 'Failed', 'error');
  };

  document.getElementById('set-smtp-pass')?.addEventListener('input', (e) => {
    const val = String(e.target.value || '');
    if (val.trim()) {
      const status = document.getElementById('set-smtp-pass-status');
      if (status) status.hidden = true;
      e.target.classList.remove('smtp-pass-input--saved');
      e.target.placeholder = 'Enter new app password';
      return;
    }
    if (String(window._lastSettingsCache?.smtp_pass_set ?? '') === '1') {
      fillSmtpSettings(window._lastSettingsCache);
    }
  });

  document.getElementById('delivery-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = await api('/settings', { method: 'PUT', body: JSON.stringify({ settings: collectSettings() }) });
    if (data.ok) {
      toast('Delivery & email settings saved');
      applySettingsResponse(data.settings);
    } else toast(data.error || 'Failed to save delivery settings', 'error');
  };

  document.getElementById('set-smtp-test-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('set-smtp-test-btn');
    if (btn) btn.disabled = true;
    const data = await api('/settings/test-email', {
      method: 'POST',
      body: JSON.stringify({ settings: collectSmtpSettings() }),
    });
    if (btn) btn.disabled = false;
    if (data.ok) {
      toast(data.message || 'Test email sent');
      if (data.saved) applySettingsResponse(data.settings);
    } else toast(data.error || 'Test email failed', 'error');
  });

  document.getElementById('seo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { ...collectSettings(), ...collectSeoSettings() } }),
    });
    if (data.ok) toast('SEO settings saved');
    else toast(data.error || 'Failed to save SEO settings', 'error');
  });

  document.getElementById('tracking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: collectTrackingSettings() }),
    });
    if (data.ok) toast('Tracking settings saved');
    else toast(data.error || 'Failed to save tracking settings', 'error');
  });

  document.getElementById('legal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    window.RakuRichEditor?.syncAll();
    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: collectLegalSettings() }),
    });
    if (data.ok) {
      toast('Legal pages saved');
      if (window._lastSettingsCache) Object.assign(window._lastSettingsCache, collectLegalSettings());
    } else toast(data.error || 'Failed to save legal pages', 'error');
  });

  document.getElementById('reward-points-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: collectRewardPointSettings() }),
    });
    if (data.ok) {
      toast('Reward point rules saved');
      if (window._lastSettingsCache) Object.assign(window._lastSettingsCache, collectRewardPointSettings());
    } else toast(data.error || 'Failed to save reward point rules', 'error');
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
