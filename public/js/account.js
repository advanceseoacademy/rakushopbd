/**
 * RakuShopBD — User account (auth, profile, orders, addresses)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api/auth';
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

  function orderCardHtml(o, compact) {
    const items = (o.items || [])
      .map((i) => `${i.product_name} ×${i.quantity}`)
      .join(', ');
    return `
      <div class="acc-order-card">
        <div class="acc-order-head">
          <div>
            <div class="acc-order-id">#${o.orderNumber}</div>
            <div class="acc-order-date">${formatDate(o.createdAt)}</div>
          </div>
          <span class="acc-status ${o.status}">${o.status}</span>
        </div>
        <div class="acc-order-items">${items || '—'}</div>
        <div class="acc-order-total">${o.totalFormatted || ''}</div>
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

    fillProfileForm(user);
    loadOrders();
    loadAddresses();
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
    document.querySelectorAll('.acc-nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.accPanel === panelId);
    });
    document.querySelectorAll('.acc-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `acc-panel-${panelId}`);
    });
  }

  const AUTH_COPY = {
    login: {
      heading: 'Welcome back',
      subheading: 'Sign in to continue shopping',
    },
    register: {
      heading: 'Create your account',
      subheading: 'Join RakuShopBD — it only takes a minute',
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
            phone: fd.get('phone'),
            password: fd.get('password'),
          }),
        });
        if (data.ok) {
          setLoggedInUI(data.user);
          switchPanel('dashboard');
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
    window.scrollTo(0, 0);
  };

  document.addEventListener('raku:ready', () => {
    bindAuthTabs();
    bindForms();
    bindNav();
    const runSession = () => loadSession();
    if (window.requestIdleCallback) requestIdleCallback(runSession, { timeout: 2500 });
    else setTimeout(runSession, 250);

    const navBtn = document.getElementById('nav-account-btn');
    if (navBtn) {
      navBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.openAccount();
      });
    }

    document.querySelectorAll('.acc-breadcrumb .link[data-page="home"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (window.showPage) window.showPage('home');
      });
    });
  });
})();
