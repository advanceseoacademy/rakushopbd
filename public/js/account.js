/**
 * RakuShopBD — User account (auth, profile, orders, addresses)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api/auth';
  const STORE_API = (window.RAKU_API_BASE || '') + '/api';
  let currentUser = null;

  async function authFetch(url, options = {}) {
    const res = await fetch(API + url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    return res.json();
  }

  function showAlert(el, msg, type = 'error') {
    if (!el) return;
    el.innerHTML = `<div class="acc-alert ${type}">${msg}</div>`;
    setTimeout(() => {
      el.innerHTML = '';
    }, 5000);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(amount) {
    return '৳' + Number(amount).toLocaleString('en-US');
  }

  function itemLineName(it) {
    return it.product_name || it.productName || 'Item';
  }

  function orderCardHtml(o) {
    const items = (o.items || [])
      .map((i) => `${itemLineName(i)} ×${i.quantity}`)
      .join(', ');
    return `
      <div class="acc-order-card">
        <div class="acc-order-head">
          <div>
            <div class="acc-order-id">#${escapeHtml(o.orderNumber)}</div>
            <div class="acc-order-date">${formatDate(o.createdAt)}</div>
          </div>
          <span class="acc-status ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>
        </div>
        <div class="acc-order-items">${escapeHtml(items || '—')}</div>
        <div class="acc-order-foot">
          <div class="acc-order-total">${escapeHtml(o.totalFormatted || '')}</div>
          <button type="button" class="acc-btn-sm primary" data-track-order="${escapeHtml(o.orderNumber)}">
            <i class="ti ti-truck-delivery"></i> Track
          </button>
        </div>
      </div>`;
  }

  function renderOrders(orders, targetId, emptyMsg) {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (!orders.length) {
      el.innerHTML = `<div class="acc-empty"><i class="ti ti-package"></i>${emptyMsg}</div>`;
      return;
    }
    el.innerHTML = orders.map((o) => orderCardHtml(o)).join('');
  }

  function updateDashboard(orders) {
    const pending = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;

    const elOrders = document.getElementById('acc-stat-orders');
    const elPending = document.getElementById('acc-stat-pending');
    const elDelivered = document.getElementById('acc-stat-delivered');
    if (elOrders) elOrders.textContent = orders.length;
    if (elPending) elPending.textContent = pending;
    if (elDelivered) elDelivered.textContent = delivered;

    renderOrders(orders.slice(0, 3), 'acc-recent-orders', 'No orders yet. Start shopping!');
    renderOrders(orders, 'acc-orders-list', 'You have not placed any orders yet.');
  }

  function renderAddresses(addresses) {
    const el = document.getElementById('acc-addresses-list');
    if (!el) return;
    if (!addresses.length) {
      el.innerHTML = '<div class="acc-empty"><i class="ti ti-map-pin"></i>No saved addresses yet.</div>';
      return;
    }
    el.innerHTML = addresses
      .map(
        (a) => `
      <div class="acc-address-card ${a.is_default ? 'default' : ''}">
        ${a.is_default ? '<div class="acc-address-label">Default</div>' : ''}
        <div class="acc-address-text">
          <strong>${a.label}</strong> — ${a.full_name}<br>
          ${a.address_line}, ${a.thana ? a.thana + ', ' : ''}${a.district}<br>
          Phone: ${a.phone}
        </div>
        <div class="acc-address-actions">
          <button type="button" class="acc-btn-sm danger" data-delete-addr="${a.id}"><i class="ti ti-trash"></i> Delete</button>
        </div>
      </div>`
      )
      .join('');

    el.querySelectorAll('[data-delete-addr]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this address?')) return;
        await authFetch(`/addresses/${btn.dataset.deleteAddr}`, { method: 'DELETE' });
        loadAddresses();
      };
    });
  }

  function fillProfileForm(user) {
    const form = document.getElementById('acc-profile-form');
    if (!form || !user) return;
    form.fullName.value = user.fullName || '';
    form.email.value = user.email || '';
    form.phone.value = user.phone || '';
  }

  const REFERRAL_STORAGE_KEY = 'raku_referral_code';

  function storeReferralCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return;
    try {
      localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
    } catch (_) {}
    applyStoredReferral();
  }

  function applyStoredReferral() {
    let stored = '';
    try {
      stored = localStorage.getItem(REFERRAL_STORAGE_KEY) || '';
    } catch (_) {}
    const input = document.querySelector('#acc-register-form input[name="referralCode"]');
    if (input && stored && !input.value.trim()) input.value = stored;
    const hint = document.getElementById('acc-referral-hint');
    if (hint) hint.hidden = !(stored || (input && input.value.trim()));
  }

  function captureReferralFromUrl() {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (!ref) return;
      storeReferralCode(ref);
      if (window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
      if (window.showPage && !window.RAKU_STANDALONE) {
        window.showPage('account');
        setAuthTab('register');
      }
    } catch (_) {}
  }

  async function copyText(value, btn) {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (btn) {
      const prev = btn.innerHTML;
      btn.innerHTML = '<i class="ti ti-check"></i> Copied';
      setTimeout(() => {
        btn.innerHTML = prev;
      }, 1600);
    }
  }

  function paintReferralPanel(info) {
    if (!info) return;
    const origin = window.location.origin.replace(/\/$/, '');
    const link = info.link && /^https?:\/\//i.test(info.link) ? info.link : `${origin}${info.link || '/'}`;
    const linkEl = document.getElementById('acc-ref-link');
    const codeEl = document.getElementById('acc-ref-code');
    if (linkEl) linkEl.value = link;
    if (codeEl) codeEl.value = info.code || '—';

    const setNum = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(n);
    };
    setNum('acc-ref-count', info.referralCount || 0);
    setNum('acc-ref-you-earn', info.referrerBonus || 0);
    setNum('acc-ref-friend-earn', info.newUserTotalWithReferral || 0);
    setNum('acc-ref-step-friend', info.newUserTotalWithReferral || 0);
    setNum('acc-ref-step-you', info.referrerBonus || 0);

    const breakdown = document.getElementById('acc-ref-step-breakdown');
    if (breakdown) {
      breakdown.textContent = `${info.registrationBonus || 100} registration + ${info.referralSignupBonus || 50} referral bonus`;
    }
  }

  async function loadReferralPanel() {
    if (!currentUser) return;
    const data = await authFetch('/referral');
    if (data.ok && data.referral) paintReferralPanel(data.referral);
  }

  function bindReferralPanel() {
    const copyLink = document.getElementById('acc-ref-copy-link');
    const copyCode = document.getElementById('acc-ref-copy-code');
    if (copyLink && !copyLink.dataset.bound) {
      copyLink.dataset.bound = '1';
      copyLink.onclick = () => copyText(document.getElementById('acc-ref-link')?.value, copyLink);
    }
    if (copyCode && !copyCode.dataset.bound) {
      copyCode.dataset.bound = '1';
      copyCode.onclick = () => copyText(document.getElementById('acc-ref-code')?.value, copyCode);
    }
  }

  function updateNavAccountLabel() {
    const label = document.getElementById('nav-account-label');
    if (label) label.textContent = currentUser ? 'My Account' : 'Login / Register';
  }

  function setLoggedInUI(user) {
    currentUser = user;
    const page = document.getElementById('page-account');
    if (page) page.classList.add('logged-in');
    updateNavAccountLabel();

    const initials = (user.fullName || 'U')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const avatar = document.getElementById('acc-avatar');
    if (avatar) avatar.textContent = initials;

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('acc-sidebar-name', user.fullName);
    set('acc-sidebar-email', user.email);
    set('acc-dash-name', user.fullName.split(' ')[0]);
    set('acc-stat-points', String(user.rewardPoints || 0));

    fillProfileForm(user);
    loadOrders();
    loadAddresses();
    loadReferralPanel();
  }

  function setLoggedOutUI() {
    currentUser = null;
    const page = document.getElementById('page-account');
    if (page) page.classList.remove('logged-in');
    setAuthTab('login');
    updateNavAccountLabel();
  }

  async function loadSession() {
    const data = await authFetch('/me');
    if (data.ok && data.user) {
      setLoggedInUI(data.user);
    } else {
      setLoggedOutUI();
    }
    return data.user;
  }

  async function loadOrders() {
    if (!currentUser) return;
    const data = await authFetch('/orders');
    if (data.ok) updateDashboard(data.orders || []);
  }

  async function loadAddresses() {
    if (!currentUser) return;
    const data = await authFetch('/addresses');
    if (data.ok) renderAddresses(data.addresses || []);
  }

  function switchPanel(panelId) {
    const target = document.getElementById(`acc-panel-${panelId}`);
    if (!target) return false;

    document.querySelectorAll('.acc-nav-btn[data-acc-panel]').forEach((b) => {
      b.classList.toggle('active', b.dataset.accPanel === panelId);
    });
    document.querySelectorAll('.acc-panel').forEach((p) => {
      p.classList.toggle('active', p === target);
    });
    if (panelId === 'referral') loadReferralPanel();
    return true;
  }

  function buildTrackResultHtml(data) {
    if (!data?.ok || !data.order) {
      return `<div class="acc-trk-err">${escapeHtml(data?.error || 'Order not found')}</div>`;
    }

    const o = data.order;
    const status = String(o.status || 'pending');
    const items = o.items || [];

    return `
      <div class="acc-trk-box">
        <div class="acc-trk-box-head">
          <div><b>Order</b> <span class="order-num">#${escapeHtml(o.orderNumber)}</span></div>
          <span class="acc-trk-status ${escapeHtml(status)}">${escapeHtml(status)}</span>
        </div>
        <div class="acc-trk-box-body">
          <div class="acc-trk-meta">
            <div class="m"><b>Name:</b> ${escapeHtml(o.customerName || '—')}</div>
            <div class="m"><b>Date:</b> ${escapeHtml(formatDate(o.createdAt))}</div>
            <div class="m"><b>District:</b> ${escapeHtml(o.district || '—')}</div>
            <div class="m"><b>Payment:</b> ${escapeHtml(o.paymentMethod || '—')}</div>
          </div>
          <div class="acc-trk-items">
            ${items
              .map((it) => {
                const line = it.line_total ?? it.lineTotal ?? 0;
                return `<div class="acc-trk-item"><span>${escapeHtml(itemLineName(it))} <b>×${escapeHtml(
                  it.quantity
                )}</b></span><span><b>${formatPrice(line)}</b></span></div>`;
              })
              .join('')}
            <div class="acc-trk-total"><span>Total</span><span>${escapeHtml(o.totalFormatted || formatPrice(o.total))}</span></div>
          </div>
        </div>
      </div>`;
  }

  function renderTrackResult(data, box) {
    const el = box || document.getElementById('acc-track-result');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = buildTrackResultHtml(data);
  }

  async function fetchOrderTrack(orderNumber) {
    const id = String(orderNumber || '').trim();
    if (!id) return { ok: false, error: 'Please enter your Order ID' };
    const res = await fetch(
      `${STORE_API}/orders/track?orderNumber=${encodeURIComponent(id)}`,
      { credentials: 'same-origin' }
    );
    try {
      return await res.json();
    } catch {
      return { ok: false, error: 'Could not load tracking info' };
    }
  }

  async function runAccountTrack(orderNumber) {
    const input = document.getElementById('acc-track-order-id');
    const submit = document.getElementById('acc-track-submit');
    const q = orderNumber != null ? String(orderNumber).trim() : input?.value.trim();
    if (input && orderNumber != null) input.value = q;
    if (!q) {
      renderTrackResult({ ok: false, error: 'Please enter your Order ID' });
      return;
    }
    if (submit) submit.disabled = true;
    const data = await fetchOrderTrack(q);
    if (submit) submit.disabled = false;
    renderTrackResult(data);
    document.getElementById('acc-track-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function showOrderTrackInline(orderNumber, btn) {
    const card = btn?.closest('.acc-order-card');
    if (!card) return;

    let box = card.querySelector('.acc-order-track-inline');
    if (!box) {
      box = document.createElement('div');
      box.className = 'acc-order-track-inline';
      card.appendChild(box);
    }

    const openId = box.dataset.orderId;
    if (openId === orderNumber && !box.hidden) {
      box.hidden = true;
      btn.classList.remove('active');
      return;
    }

    box.hidden = false;
    box.dataset.orderId = orderNumber;
    btn.classList.add('active');
    box.innerHTML = '<p class="acc-trk-loading"><i class="ti ti-loader"></i> Loading tracking…</p>';

    const data = await fetchOrderTrack(orderNumber);
    box.innerHTML = buildTrackResultHtml(data);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openTrackPanel(orderNumber) {
    if (!switchPanel('track')) {
      const id = encodeURIComponent(String(orderNumber || '').trim());
      window.location.href = id ? `/track?id=${id}` : '/track';
      return;
    }
    const input = document.getElementById('acc-track-order-id');
    if (input && orderNumber) input.value = orderNumber;
    if (orderNumber) runAccountTrack(orderNumber);
    else input?.focus();
  }

  function bindTrackPanel() {
    const form = document.getElementById('acc-track-form');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        runAccountTrack();
      });
    }

    const page = document.getElementById('page-account');
    if (page && !page.dataset.trackBound) {
      page.dataset.trackBound = '1';
      page.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-track-order]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const orderId = btn.dataset.trackOrder;
        if (!orderId) return;
        showOrderTrackInline(orderId, btn);
      });
    }
  }

  const AUTH_COPY = {
    login: {
      heading: 'Welcome back',
      subheading: 'Sign in to continue shopping',
    },
    register: {
      heading: 'Create your account',
      subheading: 'Join Raku Shop BD — get 100 reward points (150 with a referral link)',
    },
  };

  function setAuthTab(tabName) {
    const isLogin = tabName === 'login';
    document.querySelectorAll('.acc-auth-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.authTab === tabName);
    });
    const loginForm = document.getElementById('acc-login-form');
    const regForm = document.getElementById('acc-register-form');
    if (loginForm) loginForm.style.display = isLogin ? '' : 'none';
    if (regForm) regForm.style.display = isLogin ? 'none' : '';
    const copy = AUTH_COPY[tabName] || AUTH_COPY.login;
    const heading = document.getElementById('acc-auth-heading');
    const sub = document.getElementById('acc-auth-subheading');
    if (heading) heading.textContent = copy.heading;
    if (sub) sub.textContent = copy.subheading;
    const alert = document.getElementById('acc-auth-alert');
    if (alert) alert.innerHTML = '';
    if (!isLogin) applyStoredReferral();
  }

  function bindAuthTabs() {
    document.querySelectorAll('.acc-auth-tab').forEach((tab) => {
      tab.onclick = () => setAuthTab(tab.dataset.authTab);
    });
  }

  function bindForms() {
    const loginForm = document.getElementById('acc-login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(loginForm);
        const data = await authFetch('/login', {
          method: 'POST',
          body: JSON.stringify({
            email: fd.get('email'),
            password: fd.get('password'),
          }),
        });
        if (data.ok) {
          setLoggedInUI(data.user);
          switchPanel('dashboard');
        } else {
          showAlert(document.getElementById('acc-auth-alert'), data.error || 'Login failed');
        }
      };
    }

    const regForm = document.getElementById('acc-register-form');
    if (regForm) {
      regForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(regForm);
        const data = await authFetch('/register', {
          method: 'POST',
          body: JSON.stringify({
            fullName: fd.get('fullName'),
            email: fd.get('email'),
            password: fd.get('password'),
            referralCode: fd.get('referralCode'),
          }),
        });
        if (data.ok) {
          try {
            localStorage.removeItem(REFERRAL_STORAGE_KEY);
          } catch (_) {}
          setLoggedInUI(data.user);
          switchPanel('dashboard');
          if (data.message) {
            showAlert(document.getElementById('acc-profile-alert'), data.message, 'success');
          }
        } else {
          showAlert(document.getElementById('acc-auth-alert'), data.error || 'Registration failed');
        }
      };
    }

    const profileForm = document.getElementById('acc-profile-form');
    if (profileForm) {
      profileForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(profileForm);
        const data = await authFetch('/profile', {
          method: 'PUT',
          body: JSON.stringify({
            fullName: fd.get('fullName'),
            phone: fd.get('phone'),
          }),
        });
        if (data.ok) {
          setLoggedInUI(data.user);
          showAlert(document.getElementById('acc-profile-alert'), 'Profile updated successfully.', 'success');
        } else {
          showAlert(document.getElementById('acc-profile-alert'), data.error || 'Update failed');
        }
      };
    }

    const passForm = document.getElementById('acc-password-form');
    if (passForm) {
      passForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(passForm);
        const data = await authFetch('/password', {
          method: 'PUT',
          body: JSON.stringify({
            currentPassword: fd.get('currentPassword'),
            newPassword: fd.get('newPassword'),
          }),
        });
        if (data.ok) {
          passForm.reset();
          showAlert(document.getElementById('acc-password-alert'), 'Password updated.', 'success');
        } else {
          showAlert(document.getElementById('acc-password-alert'), data.error || 'Could not update password');
        }
      };
    }

    const addrForm = document.getElementById('acc-address-form');
    if (addrForm) {
      addrForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(addrForm);
        const data = await authFetch('/addresses', {
          method: 'POST',
          body: JSON.stringify({
            label: fd.get('label'),
            fullName: fd.get('fullName'),
            phone: fd.get('phone'),
            district: fd.get('district'),
            thana: fd.get('thana'),
            addressLine: fd.get('addressLine'),
            postalCode: fd.get('postalCode'),
            isDefault: fd.get('isDefault') === 'on',
          }),
        });
        if (data.ok) {
          addrForm.reset();
          showAlert(document.getElementById('acc-address-alert'), 'Address saved.', 'success');
          loadAddresses();
        } else {
          showAlert(document.getElementById('acc-address-alert'), data.error || 'Could not save address');
        }
      };
    }
  }

  function initPasswordToggles() {
    if (window.__accPwToggleBound) return;
    window.__accPwToggleBound = true;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.acc-pw-toggle');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const wrap = btn.closest('.acc-input-wrap--password');
      const inp = wrap?.querySelector('input.acc-input');
      const icon = btn.querySelector('i');
      if (!inp || !icon) return;

      const reveal = inp.getAttribute('type') === 'password';
      inp.setAttribute('type', reveal ? 'text' : 'password');
      icon.className = reveal ? 'ti ti-eye-off' : 'ti ti-eye';
      btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      btn.title = reveal ? 'Hide password' : 'Show password';
      inp.focus();
    });
  }

  function bindNav() {
    document.querySelectorAll('.acc-nav-btn[data-acc-panel]').forEach((btn) => {
      btn.onclick = () => switchPanel(btn.dataset.accPanel);
    });

    document.querySelectorAll('[data-goto-panel]').forEach((btn) => {
      btn.onclick = () => switchPanel(btn.dataset.gotoPanel);
    });

    const logoutBtn = document.getElementById('acc-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await authFetch('/logout', { method: 'POST' });
        setLoggedOutUI();
        switchPanel('dashboard');
      };
    }
  }

  window.openAccount = async function () {
    if (window.showPage) window.showPage('account');
    await loadSession();
    (window.rakuScrollToTop || (() => window.scrollTo(0, 0)))();
  };

  window.openAccountTrack = function (orderNumber) {
    if (window.showPage) window.showPage('account');
    if (!currentUser) {
      switchPanel('dashboard');
      return;
    }
    openTrackPanel(orderNumber || '');
  };

  window._rakuStoreReferralCode = storeReferralCode;

  window._rakuUpdateUserRewardPoints = function (balance) {
    const pts = Number(balance) || 0;
    if (currentUser) currentUser.rewardPoints = pts;
    const el = document.getElementById('acc-stat-points');
    if (el) el.textContent = String(pts);
  };

  function bootAccountUi() {
    bindAuthTabs();
    bindForms();
    initPasswordToggles();
    bindTrackPanel();
    bindNav();
    bindReferralPanel();
    captureReferralFromUrl();
    applyStoredReferral();
  }

  initPasswordToggles();

  document.addEventListener('raku:ready', () => {
    bootAccountUi();
    const runSession = () => loadSession();
    if (window.requestIdleCallback) requestIdleCallback(runSession, { timeout: 2500 });
    else setTimeout(runSession, 250);

    ['nav-account-btn', 'nav-account-btn-desktop'].forEach((id) => {
      const navBtn = document.getElementById(id);
      if (!navBtn || navBtn._rakuAccountBound) return;
      navBtn._rakuAccountBound = true;
      navBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.openAccount();
      });
    });

    document.querySelectorAll('.acc-breadcrumb .link[data-page="home"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (window.showPage) window.showPage('home');
      });
    });
  });
})();
