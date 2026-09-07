(function () {
  const API = window.RAKU_RESELLER_API || '/api/reseller';
  let state = {
    user: null,
    reseller: null,
    minPayout: 500,
    products: [],
    categories: [],
    orderLines: [],
    page: 'auth',
  };

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ...data };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function money(n) {
    return '৳' + Number(n || 0).toLocaleString('en-BD');
  }

  function showPage(name) {
    state.page = name;
    document.querySelectorAll('.rs-page').forEach((el) => {
      el.hidden = el.id !== 'page-' + name;
    });
    document.querySelectorAll('[data-nav]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === name);
    });
    if (location.hash.replace('#', '') !== name && name !== 'auth' && name !== 'gate') {
      history.replaceState(null, '', '#' + name);
    }
  }

  function setNavVisible(on) {
    const nav = $('rs-nav');
    if (nav) nav.hidden = !on;
  }

  async function refreshMe() {
    const data = await api('/me');
    state.user = data.user || null;
    state.reseller = data.reseller || null;
    state.minPayout = data.minPayout || 500;
    return data;
  }

  async function routeAfterAuth() {
    await refreshMe();
    if (!state.user) {
      setNavVisible(false);
      showPage('auth');
      return;
    }
    if (!state.reseller) {
      setNavVisible(false);
      $('rs-gate-title').textContent = 'Become a Reseller';
      $('rs-gate-msg').textContent = 'Apply to join the RakuShopBD reseller program. Your application will be reviewed by admin.';
      $('rs-apply-form').hidden = false;
      showPage('gate');
      return;
    }
    if (state.reseller.status === 'pending') {
      setNavVisible(false);
      $('rs-gate-title').textContent = 'Under review';
      $('rs-gate-msg').textContent = 'Your application is under review. We will approve you soon.';
      $('rs-apply-form').hidden = true;
      showPage('gate');
      return;
    }
    if (state.reseller.status === 'suspended') {
      setNavVisible(false);
      $('rs-gate-title').textContent = 'Suspended';
      $('rs-gate-msg').textContent = 'Your reseller account has been suspended. Contact support.';
      $('rs-apply-form').hidden = true;
      showPage('gate');
      return;
    }
    setNavVisible(true);
    const hash = (location.hash || '#dashboard').replace('#', '') || 'dashboard';
    await go(hash);
  }

  async function go(page) {
    if (page === 'dashboard') await loadDashboard();
    if (page === 'products') await loadProducts();
    if (page === 'place-order') await prepareOrder();
    if (page === 'payouts') await loadPayouts();
    showPage(page);
  }

  async function loadDashboard() {
    const data = await api('/dashboard');
    if (!data.ok) return;
    state.reseller = data.reseller;
    const s = data.stats || {};
    $('rs-stats').innerHTML = `
      <div class="rs-stat"><span>Wallet</span><b>${money(state.reseller.walletBalance)}</b></div>
      <div class="rs-stat"><span>Pending</span><b>${money(state.reseller.pendingBalance)}</b></div>
      <div class="rs-stat"><span>Orders</span><b>${s.totalOrders || 0}</b></div>
      <div class="rs-stat"><span>Delivered</span><b>${s.deliveredOrders || 0}</b></div>
      <div class="rs-stat"><span>Total earned</span><b>${money(state.reseller.totalEarned)}</b></div>`;
    $('rs-markup-input').value = state.reseller.defaultMarkupPercent;
    updateMarkupPreview();

    const orders = await api('/orders');
    const list = $('rs-orders-list');
    if (!orders.ok || !orders.orders?.length) {
      list.innerHTML = '<p class="rs-muted">No orders yet.</p>';
      return;
    }
    list.innerHTML = `<table class="rs-table"><thead><tr>
      <th>Order</th><th>Customer</th><th>Total</th><th>Profit</th><th>Status</th>
    </tr></thead><tbody>
      ${orders.orders
        .slice(0, 15)
        .map(
          (o) => `<tr>
        <td><code>${esc(o.orderNumber)}</code><br><small>${esc(o.items.map((i) => i.name).join(', '))}</small></td>
        <td>${esc(o.customerName)}<br>${esc(o.customerPhoneMasked)}</td>
        <td>${money(o.total)}</td>
        <td>${money(o.profit)}</td>
        <td><span class="rs-badge ${esc(o.status)}">${esc(o.status)}</span></td>
      </tr>`
        )
        .join('')}
    </tbody></table>`;
  }

  function updateMarkupPreview() {
    const pct = Number($('rs-markup-input')?.value) || 0;
    const sampleBase = 500;
    const sell = Math.round((sampleBase * (1 + pct / 100)) / 5) * 5;
    $('rs-markup-preview').textContent = `Example: base ৳500 → sell ${money(sell)} (profit ${money(sell - sampleBase)})`;
  }

  async function loadProducts() {
    if (!$('rs-product-cat').dataset.loaded) {
      const cats = await api('/categories');
      if (cats.ok) {
        state.categories = cats.categories || [];
        $('rs-product-cat').innerHTML =
          '<option value="">All categories</option>' +
          state.categories.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
        $('rs-product-cat').dataset.loaded = '1';
      }
    }
    const q = $('rs-product-q').value.trim();
    const category = $('rs-product-cat').value;
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (category) qs.set('category', category);
    const data = await api('/products?' + qs.toString());
    const grid = $('rs-product-grid');
    if (!data.ok) {
      grid.textContent = data.error || 'Failed';
      return;
    }
    state.products = data.products || [];
    if (!state.products.length) {
      grid.innerHTML = '<p class="rs-muted">No products with base price yet.</p>';
      return;
    }
    grid.innerHTML = state.products
      .map(
        (p) => `<article class="rs-product">
      <img src="${esc(p.imageUrl || '/images/rakushopbd-logo.png')}" alt="" loading="lazy">
      <div class="rs-product-body">
        <h3>${esc(p.name)}</h3>
        <div class="rs-price-row"><span class="base">Base ${money(p.basePrice)}</span><span class="sell">Sell ${money(p.sellingPrice)}</span></div>
        <div class="rs-product-actions">
          <button type="button" data-copy="${p.id}">Copy text</button>
          <button type="button" data-dl="${p.id}">Download images</button>
          <button type="button" data-add="${p.id}">Add to order</button>
        </div>
      </div>
    </article>`
      )
      .join('');
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  async function prepareOrder() {
    if (!state.products.length) {
      const data = await api('/products');
      if (data.ok) state.products = data.products || [];
    }
    renderOrderLines();
    $('rs-order-success').hidden = true;
    $('rs-order-form').hidden = false;
  }

  function renderOrderLines() {
    const wrap = $('rs-order-lines');
    if (!state.orderLines.length) {
      wrap.innerHTML = '<p class="rs-muted">No products added yet.</p>';
      $('rs-order-total').textContent = '';
      return;
    }
    wrap.innerHTML = state.orderLines
      .map((line, idx) => {
        const p = state.products.find((x) => x.id === line.productId);
        return `<div class="rs-order-line">
          <div><b>${esc(p?.name || line.productId)}</b><br><small>Base ${money(p?.basePrice || 0)}</small></div>
          <input type="number" min="1" max="99" value="${line.qty}" data-qty="${idx}">
          <input type="number" min="0" step="1" value="${line.sellingPrice}" data-price="${idx}">
          <button type="button" data-remove="${idx}" aria-label="Remove">×</button>
        </div>`;
      })
      .join('');
    const sub = state.orderLines.reduce((s, l) => s + l.sellingPrice * l.qty, 0);
    const profit = state.orderLines.reduce((s, l) => {
      const p = state.products.find((x) => x.id === l.productId);
      return s + Math.max(0, l.sellingPrice - (p?.basePrice || 0)) * l.qty;
    }, 0);
    $('rs-order-total').textContent = `Subtotal ${money(sub)} · Your profit ${money(profit)} (+ delivery at checkout rules)`;
  }

  async function loadPayouts() {
    await refreshMe();
    $('rs-wallet-bal').textContent = money(state.reseller?.walletBalance);
    $('rs-min-payout').textContent = money(state.minPayout);
    const data = await api('/payouts');
    const list = $('rs-payout-list');
    if (!data.ok || !data.payouts?.length) {
      list.innerHTML = '<p class="rs-muted">No payout requests yet.</p>';
      return;
    }
    list.innerHTML = `<table class="rs-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>
      ${data.payouts
        .map(
          (p) => `<tr>
        <td>${esc(String(p.requestedAt || '').slice(0, 10))}</td>
        <td>${money(p.amount)}</td>
        <td>${esc(p.method)} ${esc(p.accountNumber)}</td>
        <td><span class="rs-badge">${esc(p.status)}</span></td>
      </tr>`
        )
        .join('')}
    </tbody></table>`;
  }

  // Events
  $('rs-login-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('/login', {
      method: 'POST',
      body: { email: fd.get('email'), password: fd.get('password') },
    });
    if (!data.ok) {
      $('rs-auth-err').hidden = false;
      $('rs-auth-err').textContent = data.error || 'Login failed';
      return;
    }
    await routeAfterAuth();
  };

  $('rs-register-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('/register', {
      method: 'POST',
      body: {
        fullName: fd.get('fullName'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        password: fd.get('password'),
      },
    });
    if (!data.ok) {
      $('rs-auth-err').hidden = false;
      $('rs-auth-err').textContent = data.error || 'Register failed';
      return;
    }
    await routeAfterAuth();
  };

  $('rs-apply-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('/apply', { method: 'POST', body: { note: fd.get('note') } });
    if (data.ok) await routeAfterAuth();
    else alert(data.error || 'Failed');
  };

  $('rs-logout').onclick = async () => {
    await api('/logout', { method: 'POST' });
    state = { ...state, user: null, reseller: null, orderLines: [] };
    await routeAfterAuth();
  };

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const page = el.getAttribute('data-nav');
      if (!page || page === 'home') return;
      e.preventDefault();
      go(page);
    });
  });

  $('rs-markup-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = await api('/markup', {
      method: 'PATCH',
      body: { defaultMarkupPercent: Number($('rs-markup-input').value) },
    });
    if (data.ok) {
      state.reseller = data.reseller;
      updateMarkupPreview();
      alert('Markup saved');
    } else alert(data.error || 'Failed');
  };
  $('rs-markup-input')?.addEventListener('input', updateMarkupPreview);

  let searchTimer;
  $('rs-product-q')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProducts(), 250);
  });
  $('rs-product-cat')?.addEventListener('change', () => loadProducts());

  $('rs-product-grid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = Number(btn.dataset.copy || btn.dataset.dl || btn.dataset.add);
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    if (btn.dataset.copy) {
      const text = `${p.name}\nBase: ${money(p.basePrice)}\nSell: ${money(p.sellingPrice)}\n\n${String(p.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500)}`;
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy text'), 1200);
    }
    if (btn.dataset.dl) {
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Preparing zip…';
      try {
        const a = document.createElement('a');
        a.href = `${API}/products/${p.id}/images.zip`;
        a.download = `${p.slug || 'product'}-images.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        btn.disabled = false;
        btn.textContent = prev || 'Download images';
      }
    }
    if (btn.dataset.add) {
      const existing = state.orderLines.find((l) => l.productId === p.id);
      if (existing) existing.qty += 1;
      else state.orderLines.push({ productId: p.id, qty: 1, sellingPrice: p.sellingPrice });
      await go('place-order');
    }
  });

  $('rs-order-product-q')?.addEventListener('input', () => {
    const q = $('rs-order-product-q').value.trim().toLowerCase();
    const box = $('rs-order-suggest');
    if (!q) {
      box.hidden = true;
      return;
    }
    const hits = state.products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
    if (!hits.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = hits
      .map(
        (p) =>
          `<button type="button" data-pick="${p.id}">${esc(p.name)} — sell ${money(p.sellingPrice)}</button>`
      )
      .join('');
  });

  $('rs-order-suggest')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    const p = state.products.find((x) => x.id === Number(btn.dataset.pick));
    if (!p) return;
    const existing = state.orderLines.find((l) => l.productId === p.id);
    if (existing) existing.qty += 1;
    else state.orderLines.push({ productId: p.id, qty: 1, sellingPrice: p.sellingPrice });
    $('rs-order-suggest').hidden = true;
    $('rs-order-product-q').value = '';
    renderOrderLines();
  });

  $('rs-order-lines')?.addEventListener('input', (e) => {
    const qty = e.target.dataset.qty;
    const price = e.target.dataset.price;
    if (qty != null) state.orderLines[Number(qty)].qty = Math.max(1, Number(e.target.value) || 1);
    if (price != null) state.orderLines[Number(price)].sellingPrice = Math.max(0, Number(e.target.value) || 0);
    renderOrderLines();
  });
  $('rs-order-lines')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    state.orderLines.splice(Number(btn.dataset.remove), 1);
    renderOrderLines();
  });

  $('rs-order-form').onsubmit = async (e) => {
    e.preventDefault();
    $('rs-order-err').hidden = true;
    if (!state.orderLines.length) {
      $('rs-order-err').hidden = false;
      $('rs-order-err').textContent = 'Add at least one product';
      return;
    }
    const fd = new FormData(e.target);
    const btn = $('rs-order-submit');
    btn.disabled = true;
    const data = await api('/orders', {
      method: 'POST',
      body: {
        name: fd.get('name'),
        phone: fd.get('phone'),
        address: fd.get('address'),
        district: fd.get('district'),
        notes: fd.get('notes'),
        items: state.orderLines,
      },
    });
    btn.disabled = false;
    if (!data.ok) {
      $('rs-order-err').hidden = false;
      $('rs-order-err').textContent = data.error || 'Order failed';
      return;
    }
    state.orderLines = [];
    e.target.reset();
    $('rs-order-form').hidden = true;
    $('rs-order-success').hidden = false;
    $('rs-order-success-msg').textContent = `Order ${data.orderNumber} placed. Total ${data.totalFormatted}. Profit pending: ${money(data.profit)}`;
  };

  $('rs-payout-form').onsubmit = async (e) => {
    e.preventDefault();
    $('rs-payout-err').hidden = true;
    const fd = new FormData(e.target);
    const data = await api('/payouts', {
      method: 'POST',
      body: {
        amount: Number(fd.get('amount')),
        method: fd.get('method'),
        accountNumber: fd.get('accountNumber'),
      },
    });
    if (!data.ok) {
      $('rs-payout-err').hidden = false;
      $('rs-payout-err').textContent = data.error || 'Failed';
      return;
    }
    e.target.reset();
    await loadPayouts();
    alert('Payout requested');
  };

  routeAfterAuth();
})();
