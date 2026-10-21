/**
 * RakuShopBD — User account (auth, profile, orders, addresses)
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api/auth';
  const STORE_API = (window.RAKU_API_BASE || '') + '/api';
  const USER_SESSION_KEY = 'raku_user_session';
  let currentUser = null;

  function hasSessionCookie() {
    try {
      return document.cookie.split(';').some((c) => c.trim().startsWith('rakushopbd.sid='));
    } catch (_) {
      return false;
    }
  }

  function finishAccountAuthPending() {
    document.documentElement.classList.remove('account-auth-pending');
  }

  function prepareAccountAuthShell() {
    const html = document.documentElement;
    const cached = getCachedUserSession();
    const cookie = hasSessionCookie();

    if (cached && !cookie) {
      try {
        localStorage.removeItem(USER_SESSION_KEY);
        sessionStorage.removeItem(USER_SESSION_KEY);
      } catch (_) {}
      html.classList.remove('user-auth-restoring');
    }

    if (cached && cookie) {
      applyCachedUserShell(cached);
      return;
    }
    if (cookie) {
      markUserAuthRestoring();
      return;
    }
    html.classList.add('account-auth-pending');
  }

  function getCachedUserSession() {
    try {
      const raw = localStorage.getItem(USER_SESSION_KEY) || sessionStorage.getItem(USER_SESSION_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw);
      return user && user.id ? user : null;
    } catch (_) {
      return null;
    }
  }

  function cacheUserSession(user) {
    if (!user?.id) return;
    try {
      const json = JSON.stringify(user);
      localStorage.setItem(USER_SESSION_KEY, json);
      sessionStorage.setItem(USER_SESSION_KEY, json);
    } catch (_) {}
  }

  function clearUserSessionCache() {
    try {
      localStorage.removeItem(USER_SESSION_KEY);
      sessionStorage.removeItem(USER_SESSION_KEY);
    } catch (_) {}
    document.documentElement.classList.remove('user-auth-restoring');
  }

  function markUserAuthRestoring() {
    document.documentElement.classList.add('user-auth-restoring');
  }

  function applyCachedUserShell(user) {
    if (!user) return;
    markUserAuthRestoring();
    const page = document.getElementById('page-account');
    if (page) page.classList.add('logged-in');

    setNavAccountLabels('My Account');

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
    set('acc-sidebar-name', user.fullName || 'Member');
    set('acc-sidebar-email', user.email || '—');
    set('acc-dash-name', String(user.fullName || 'Member').split(' ')[0]);
    set('acc-stat-points', String(user.rewardPoints || 0));
  }

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

  const ordersByNumber = new Map();

  function itemProductUrl(it) {
    const slug = it.product_slug || it.productSlug;
    const id = it.product_id || it.productId;
    if (slug) return `/product/${encodeURIComponent(slug)}`;
    if (id) return `/product/${encodeURIComponent(id)}`;
    return '';
  }

  function itemThumbHtml(it) {
    const img = it.product_image || it.productImage;
    const safe = img && /^(\/|https:\/\/)/.test(String(img)) ? String(img) : '';
    return safe
      ? `<img class="acc-oi-thumb" src="${escapeHtml(safe)}" alt="" loading="lazy" width="48" height="48">`
      : '<span class="acc-oi-thumb acc-oi-thumb--empty"><i class="ti ti-package"></i></span>';
  }

  function orderItemRowHtml(it) {
    const url = itemProductUrl(it);
    const name = escapeHtml(itemLineName(it));
    const unit = Number(it.unit_price ?? it.unitPrice ?? 0);
    const line = Number(it.line_total ?? it.lineTotal ?? unit * Number(it.quantity || 1));
    const nameHtml = url
      ? `<a class="acc-oi-name" href="${escapeHtml(url)}">${name}</a>`
      : `<span class="acc-oi-name">${name}</span>`;
    const thumb = url ? `<a href="${escapeHtml(url)}" tabindex="-1" aria-hidden="true">${itemThumbHtml(it)}</a>` : itemThumbHtml(it);
    return `<div class="acc-oi">
        ${thumb}
        <div class="acc-oi-info">
          ${nameHtml}
          <div class="acc-oi-meta">${formatPrice(unit)} × ${escapeHtml(it.quantity)}</div>
        </div>
        <div class="acc-oi-total">${formatPrice(line)}</div>
      </div>`;
  }

  function orderCardHtml(o) {
    ordersByNumber.set(String(o.orderNumber), o);
    const items = o.items || [];
    return `
      <div class="acc-order-card">
        <div class="acc-order-head">
          <div>
            <div class="acc-order-id">#${escapeHtml(o.orderNumber)}</div>
            <div class="acc-order-date">${formatDate(o.createdAt)}</div>
          </div>
          <span class="acc-status ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>
        </div>
        <div class="acc-order-items acc-oi-list">${items.length ? items.map(orderItemRowHtml).join('') : '—'}</div>
        <div class="acc-order-foot">
          <div class="acc-order-total">${escapeHtml(o.totalFormatted || '')}</div>
          <button type="button" class="acc-btn-sm primary" data-track-order="${escapeHtml(o.orderNumber)}">
            <i class="ti ti-list-details"></i> Details
          </button>
        </div>
      </div>`;
  }

  const ORDER_STEPS = [
    { key: 'pending', label: 'Order placed', icon: 'ti-receipt' },
    { key: 'confirmed', label: 'Confirmed', icon: 'ti-circle-check' },
    { key: 'shipped', label: 'Shipped', icon: 'ti-truck-delivery' },
    { key: 'delivered', label: 'Delivered', icon: 'ti-package' },
  ];

  function orderStepperHtml(status) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'cancelled') {
      return '<div class="acc-od-cancelled"><i class="ti ti-circle-x"></i> This order was cancelled.</div>';
    }
    const idx = Math.max(0, ORDER_STEPS.findIndex((x) => x.key === s));
    return `<ol class="acc-od-steps">${ORDER_STEPS.map((st, i) => {
      const cls = i < idx ? 'done' : i === idx ? 'current' : '';
      return `<li class="acc-od-step ${cls}"><span class="acc-od-dot"><i class="ti ${st.icon}"></i></span><span>${st.label}</span></li>`;
    }).join('')}</ol>`;
  }

  function orderDetailsHtml(o) {
    const pay = String(o.paymentMethod || '—');
    const addr = [o.address, o.district, o.postalCode].filter(Boolean).join(', ');
    const discountRow = Number(o.discount) > 0
      ? `<div class="acc-od-row"><span>Discount</span><span>−${formatPrice(o.discount)}</span></div>`
      : '';
    return `<div class="acc-trk-box acc-od">
        ${orderStepperHtml(o.status)}
        <div class="acc-od-grid">
          <div class="acc-od-block">
            <h4>Delivery</h4>
            <p><b>${escapeHtml(o.customerName || '—')}</b>${o.customerPhone ? ` · ${escapeHtml(o.customerPhone)}` : ''}</p>
            <p>${escapeHtml(addr || '—')}</p>
            <p>Ordered on ${escapeHtml(formatDate(o.createdAt))} · Payment: ${escapeHtml(pay.toUpperCase())}</p>
          </div>
          <div class="acc-od-block">
            <h4>Payment summary</h4>
            <div class="acc-od-row"><span>Items</span><span>${formatPrice(o.subtotal)}</span></div>
            <div class="acc-od-row"><span>Delivery</span><span>${Number(o.deliveryFee) > 0 ? formatPrice(o.deliveryFee) : 'Free'}</span></div>
            ${discountRow}
            <div class="acc-od-row acc-od-total"><span>Total</span><span>${formatPrice(o.total)}</span></div>
          </div>
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

    const shareMsg = `Raku Shop BD e join korun amar invite link diye — signup e reward points paben!\n${link}`;
    const wa = document.getElementById('acc-ref-share-wa');
    const fb = document.getElementById('acc-ref-share-fb');
    if (wa) wa.href = `https://wa.me/?text=${encodeURIComponent(shareMsg)}`;
    if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;

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

  function setNavAccountLabels(text) {
    const loggedIn = text === 'My Account';
    ['nav-account-label', 'nav-account-label-desktop'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
    ['nav-account-btn', 'nav-account-btn-desktop'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.setAttribute('aria-label', text);
      btn.classList.toggle('header-account-btn--logged-in', loggedIn);
    });
  }

  function updateNavAccountLabel() {
    setNavAccountLabels(currentUser ? 'My Account' : 'SingUp');
  }

  function setLoggedInUI(user) {
    currentUser = user;
    cacheUserSession(user);
    markUserAuthRestoring();
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

  function applyAuthTabFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('signup') === '1' || params.get('tab') === 'register') {
        setAuthTab('register');
      }
    } catch (_) {}
  }

  function setLoggedOutUI() {
    currentUser = null;
    clearUserSessionCache();
    const page = document.getElementById('page-account');
    if (page) page.classList.remove('logged-in');
    setAuthTab('login');
    applyAuthTabFromUrl();
    updateNavAccountLabel();
  }

  async function loadSession() {
    try {
      const data = await authFetch('/me');
      if (data.ok && data.user) {
        setLoggedInUI(data.user);
      } else {
        setLoggedOutUI();
      }
      return data.user;
    } finally {
      finishAccountAuthPending();
    }
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
    if (panelId === 'review-videos') {
      loadReviewVideosPanel();
      loadPhotoReviewPanel();
    }
    if (panelId === 'video-contest') loadVideoContestPanel();
    return true;
  }

  function reviewVideoStatusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    return 'Under review';
  }

  function reviewVideoStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    return 'pending';
  }

  function renderReviewVideosList(videos, highlightId) {
    const el = document.getElementById('acc-rv-list');
    if (!el) return;
    if (!videos.length) {
      el.innerHTML = '<div class="acc-empty"><i class="ti ti-video"></i>No review videos yet.</div>';
      return;
    }
    el.innerHTML = videos
      .map((v) => {
        const status = reviewVideoStatusClass(v.status);
        const label = reviewVideoStatusLabel(v.status);
        const note = v.adminNote
          ? `<p class="acc-rv-note">${escapeHtml(v.adminNote)}</p>`
          : '';
        const isNew = highlightId != null && Number(v.id) === Number(highlightId);
        return `<article class="acc-rv-item${isNew ? ' is-new' : ''}">
          <div class="acc-rv-item-head">
            <div>
              <strong>${escapeHtml(v.productName || 'Product')}</strong>
              <div class="acc-rv-meta">Order #${escapeHtml(v.orderNumber || v.orderId || '')} · ${formatDate(v.createdAt)}</div>
            </div>
            <span class="acc-rv-status ${status}">${label}</span>
          </div>
          <video class="acc-rv-preview" src="${escapeHtml(v.videoUrl)}" controls playsinline preload="metadata"></video>
          ${note}
        </article>`;
      })
      .join('');
  }

  function syncReviewSelectState() {
    const sel = document.getElementById('acc-rv-product');
    const wrap = document.getElementById('acc-rv-select-wrap');
    if (!sel || !wrap) return;
    wrap.classList.toggle('has-value', !!sel.value);
    wrap.classList.toggle('is-disabled', !!sel.disabled);
  }

  function populateEligibleProducts(eligible) {
    const sel = document.getElementById('acc-rv-product');
    if (!sel) return;
    if (!eligible.length) {
      sel.innerHTML = '<option value="">No delivered products available for video review</option>';
      sel.disabled = true;
      syncReviewSelectState();
      return;
    }
    sel.disabled = false;
    sel.innerHTML =
      '<option value="">Select a product…</option>' +
      eligible
        .map((item) => {
          const key = `${item.orderId}:${item.productId}`;
          const suffix = item.canResubmit ? ' (resubmit)' : '';
          return `<option value="${escapeHtml(key)}">${escapeHtml(item.productName)} — #${escapeHtml(item.orderNumber)}${suffix}</option>`;
        })
        .join('');
    syncReviewSelectState();
  }

  function syncContestSelectState() {
    const sel = document.getElementById('acc-vc-product');
    const wrap = document.getElementById('acc-vc-select-wrap');
    if (!sel || !wrap) return;
    wrap.classList.toggle('has-value', !!sel.value);
    wrap.classList.toggle('is-disabled', !!sel.disabled);
  }

  function populateContestEligible(eligible) {
    const sel = document.getElementById('acc-vc-product');
    if (!sel) return;
    if (!eligible.length) {
      sel.innerHTML =
        '<option value="">No delivered product yet — order deliver hole contest e join korte parben</option>';
      sel.disabled = true;
      syncContestSelectState();
      return;
    }
    sel.disabled = false;
    sel.innerHTML =
      '<option value="">Contest er jonno product select korun…</option>' +
      eligible
        .map((item) => {
          const key = `${item.orderId}:${item.productId}`;
          const suffix = item.canResubmit ? ' (resubmit)' : '';
          return `<option value="${escapeHtml(key)}">${escapeHtml(item.productName)} — #${escapeHtml(item.orderNumber)}${suffix}</option>`;
        })
        .join('');
    syncContestSelectState();
  }

  function renderContestVideosList(videos, highlightId) {
    const el = document.getElementById('acc-vc-list');
    if (!el) return;
    if (!videos.length) {
      el.innerHTML =
        '<div class="acc-empty"><i class="ti ti-video"></i>No contest videos yet. Submit your first review video above.</div>';
      return;
    }
    el.innerHTML = videos
      .map((v) => {
        const status = reviewVideoStatusClass(v.status);
        const label = reviewVideoStatusLabel(v.status);
        const note = v.adminNote
          ? `<p class="acc-rv-note">${escapeHtml(v.adminNote)}</p>`
          : '';
        const isNew = highlightId != null && Number(v.id) === Number(highlightId);
        return `<article class="acc-rv-item${isNew ? ' is-new' : ''}">
          <div class="acc-rv-item-head">
            <div>
              <strong>${escapeHtml(v.productName || 'Product')}</strong>
              <div class="acc-rv-meta">Order #${escapeHtml(v.orderNumber || v.orderId || '')} · ${formatDate(v.createdAt)}</div>
            </div>
            <span class="acc-rv-status ${status}">${label}</span>
          </div>
          <video class="acc-rv-preview" src="${escapeHtml(v.videoUrl)}" controls playsinline preload="metadata"></video>
          ${note}
        </article>`;
      })
      .join('');
  }

  async function loadVideoContestPanel(highlightId) {
    if (!currentUser) return null;
    const [cfgRes, eligibleRes, listRes] = await Promise.all([
      authFetch('/review-videos/config'),
      authFetch('/review-videos/eligible'),
      authFetch('/review-videos'),
    ]);
    const pts = cfgRes.ok ? Number(cfgRes.videoReviewPoints) || 100 : 100;
    const ptsLabel = document.getElementById('acc-vc-points-label');
    if (ptsLabel) ptsLabel.textContent = String(pts);
    if (eligibleRes.ok) populateContestEligible(eligibleRes.eligible || []);
    if (listRes.ok) renderContestVideosList(listRes.videos || [], highlightId);
    return listRes.ok ? listRes.videos || [] : null;
  }

  async function loadReviewVideosPanel(highlightId) {
    if (!currentUser) return null;
    const [cfgRes, eligibleRes, listRes] = await Promise.all([
      authFetch('/review-videos/config'),
      authFetch('/review-videos/eligible'),
      authFetch('/review-videos'),
    ]);
    const pts = cfgRes.ok ? Number(cfgRes.videoReviewPoints) || 100 : 100;
    const ptsLabel = document.getElementById('acc-rv-points-label');
    if (ptsLabel) ptsLabel.textContent = String(pts);
    if (eligibleRes.ok) populateEligibleProducts(eligibleRes.eligible || []);
    if (listRes.ok) renderReviewVideosList(listRes.videos || [], highlightId);
    return listRes.ok ? listRes.videos || [] : null;
  }

  const RV_MAX_BYTES = 1024 * 1024 * 1024;

  function formatBytes(n) {
    const gb = Number(n) / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = Number(n) / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(Number(n) / 1024))} KB`;
  }

  function setRvProgress(state, { pct, label, size } = {}) {
    const box = document.getElementById('acc-rv-progress');
    if (!box) return;
    if (state === 'hidden') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.toggle('is-processing', state === 'processing');
    box.classList.toggle('is-done', state === 'done');
    box.classList.toggle('is-error', state === 'error');
    if (pct != null) {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      const bar = document.getElementById('acc-rv-progress-bar');
      const pctEl = document.getElementById('acc-rv-progress-pct');
      const track = document.getElementById('acc-rv-progress-track');
      if (bar) bar.style.width = p + '%';
      if (pctEl) pctEl.textContent = p + '%';
      if (track) track.setAttribute('aria-valuenow', String(p));
    }
    if (label != null) {
      const l = document.getElementById('acc-rv-progress-label');
      if (l) l.textContent = label;
    }
    if (size != null) {
      const s = document.getElementById('acc-rv-progress-size');
      if (s) s.textContent = size;
    }
  }

  function uploadReviewVideoWithProgress(file, onProgress) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/review-videos/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (_) {
          data = null;
        }
        if (data) return resolve(data);
        if (xhr.status === 413) return resolve({ ok: false, error: 'Video is too large. Maximum size is 1 GB.' });
        if (xhr.status === 401) return resolve({ ok: false, error: 'Your session expired. Please log in again.' });
        resolve({ ok: false, error: `Upload failed (server error ${xhr.status}). Please try again.` });
      };
      xhr.onerror = () => resolve({ ok: false, error: 'Network error — check your internet connection and try again.' });
      xhr.ontimeout = () => resolve({ ok: false, error: 'Upload timed out. Please try again on a faster connection.' });
      const fd = new FormData();
      fd.append('video', file);
      xhr.send(fd);
    });
  }

  function bindReviewVideosPanel() {
    const form = document.getElementById('acc-rv-form');
    if (!form || form._rakuRvBound) return;
    form._rakuRvBound = true;
    const productSel = document.getElementById('acc-rv-product');
    const selectWrap = document.getElementById('acc-rv-select-wrap');
    productSel?.addEventListener('change', syncReviewSelectState);
    productSel?.addEventListener('focus', () => selectWrap?.classList.add('is-open'));
    productSel?.addEventListener('blur', () => selectWrap?.classList.remove('is-open'));
    syncReviewSelectState();
    document.getElementById('acc-rv-video')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      const drop = form.querySelector('.acc-rv-drop');
      const fileLabel = document.getElementById('acc-rv-file-label');
      if (!f) {
        drop?.classList.remove('is-filled');
        if (fileLabel) fileLabel.textContent = 'Tap to choose video';
        return setRvProgress('hidden');
      }
      drop?.classList.add('is-filled');
      if (fileLabel) fileLabel.textContent = f.name;
      if (f.size > RV_MAX_BYTES) {
        setRvProgress('error', {
          pct: 0,
          label: 'Video is too large',
          size: `Your file is ${formatBytes(f.size)} — maximum allowed is 1 GB.`,
        });
      } else {
        setRvProgress('hidden');
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      const alertEl = document.getElementById('acc-rv-alert');
      const submitBtn = document.getElementById('acc-rv-submit');
      const productKey = document.getElementById('acc-rv-product')?.value || '';
      const fileInput = document.getElementById('acc-rv-video');
      const file = fileInput?.files?.[0];
      const [orderId, productId] = productKey.split(':').map(Number);
      if (!orderId || !productId) {
        showAlert(alertEl, 'Please select a delivered product.');
        return;
      }
      if (!file) {
        showAlert(alertEl, 'Please choose a video file.');
        return;
      }
      if (file.size > RV_MAX_BYTES) {
        setRvProgress('error', {
          pct: 0,
          label: 'Video is too large',
          size: `Your file is ${formatBytes(file.size)} — maximum allowed is 1 GB.`,
        });
        showAlert(alertEl, 'Video is too large. Maximum size is 1 GB.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      const fail = (msg) => {
        setRvProgress('error', { label: msg });
        showAlert(alertEl, escapeHtml(msg));
      };
      try {
        setRvProgress('uploading', { pct: 0, label: 'Uploading video…', size: `0 MB of ${formatBytes(file.size)}` });
        const upData = await uploadReviewVideoWithProgress(file, (loaded, total) => {
          const pct = (loaded / total) * 100;
          if (pct >= 100) {
            setRvProgress('processing', { pct: 100, label: 'Saving video on server…', size: formatBytes(total) });
          } else {
            setRvProgress('uploading', {
              pct,
              label: 'Uploading video…',
              size: `${formatBytes(loaded)} of ${formatBytes(total)}`,
            });
          }
        });
        if (!upData.ok) {
          fail(upData.error || 'Video upload failed');
          return;
        }
        setRvProgress('processing', { pct: 100, label: 'Sending to review section…' });
        const data = await authFetch('/review-videos', {
          method: 'POST',
          body: JSON.stringify({
            orderId,
            productId,
            videoUrl: upData.url,
          }),
        });
        if (!data.ok) {
          fail(data.error || 'Could not submit review video');
          return;
        }
        const newId = data.video?.id;
        form.reset();
        form.querySelector('.acc-rv-drop')?.classList.remove('is-filled');
        const fileLabel = document.getElementById('acc-rv-file-label');
        if (fileLabel) fileLabel.textContent = 'Tap to choose video';
        syncReviewSelectState();
        const videos = await loadReviewVideosPanel(newId);
        const confirmed = Array.isArray(videos) && videos.some((v) => Number(v.id) === Number(newId));
        if (confirmed) {
          setRvProgress('done', {
            pct: 100,
            label: '✓ Video sent to the review section — status: Under review',
            size: 'Admin will check it soon. You will get reward points after approval.',
          });
          showAlert(alertEl, 'Review video submitted — status: Under review.', 'success');
        } else {
          setRvProgress('done', {
            pct: 100,
            label: '✓ Video submitted for review',
            size: 'Refresh this page if it does not appear in “Your submissions” yet.',
          });
        }
      } catch (_) {
        fail('Upload failed. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function setVcProgress(state, { pct, label, size } = {}) {
    const box = document.getElementById('acc-vc-progress');
    if (!box) return;
    if (state === 'hidden') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.toggle('is-processing', state === 'processing');
    box.classList.toggle('is-done', state === 'done');
    box.classList.toggle('is-error', state === 'error');
    if (pct != null) {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      const bar = document.getElementById('acc-vc-progress-bar');
      const pctEl = document.getElementById('acc-vc-progress-pct');
      const track = document.getElementById('acc-vc-progress-track');
      if (bar) bar.style.width = p + '%';
      if (pctEl) pctEl.textContent = p + '%';
      if (track) track.setAttribute('aria-valuenow', String(p));
    }
    if (label != null) {
      const l = document.getElementById('acc-vc-progress-label');
      if (l) l.textContent = label;
    }
    if (size != null) {
      const s = document.getElementById('acc-vc-progress-size');
      if (s) s.textContent = size;
    }
  }

  function bindVideoContestPanel() {
    const form = document.getElementById('acc-vc-form');
    if (!form || form._rakuVcBound) return;
    form._rakuVcBound = true;
    const productSel = document.getElementById('acc-vc-product');
    const selectWrap = document.getElementById('acc-vc-select-wrap');
    productSel?.addEventListener('change', syncContestSelectState);
    productSel?.addEventListener('focus', () => selectWrap?.classList.add('is-open'));
    productSel?.addEventListener('blur', () => selectWrap?.classList.remove('is-open'));
    syncContestSelectState();
    document.getElementById('acc-vc-video')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      const drop = form.querySelector('.acc-rv-drop');
      const fileLabel = document.getElementById('acc-vc-file-label');
      if (!f) {
        drop?.classList.remove('is-filled');
        if (fileLabel) fileLabel.textContent = 'Tap to choose video';
        return setVcProgress('hidden');
      }
      drop?.classList.add('is-filled');
      if (fileLabel) fileLabel.textContent = f.name;
      if (f.size > RV_MAX_BYTES) {
        setVcProgress('error', {
          pct: 0,
          label: 'Video is too large',
          size: `Your file is ${formatBytes(f.size)} — maximum allowed is 1 GB.`,
        });
      } else {
        setVcProgress('hidden');
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      const alertEl = document.getElementById('acc-vc-alert');
      const submitBtn = document.getElementById('acc-vc-submit');
      const productKey = document.getElementById('acc-vc-product')?.value || '';
      const fileInput = document.getElementById('acc-vc-video');
      const file = fileInput?.files?.[0];
      const [orderId, productId] = productKey.split(':').map(Number);
      if (!orderId || !productId) {
        showAlert(alertEl, 'Please select a delivered product.');
        return;
      }
      if (!file) {
        showAlert(alertEl, 'Please choose a video file.');
        return;
      }
      if (file.size > RV_MAX_BYTES) {
        setVcProgress('error', {
          pct: 0,
          label: 'Video is too large',
          size: `Your file is ${formatBytes(file.size)} — maximum allowed is 1 GB.`,
        });
        showAlert(alertEl, 'Video is too large. Maximum size is 1 GB.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      const fail = (msg) => {
        setVcProgress('error', { label: msg });
        showAlert(alertEl, escapeHtml(msg));
      };
      try {
        setVcProgress('uploading', { pct: 0, label: 'Uploading video…', size: `0 MB of ${formatBytes(file.size)}` });
        const upData = await uploadReviewVideoWithProgress(file, (loaded, total) => {
          const pct = (loaded / total) * 100;
          if (pct >= 100) {
            setVcProgress('processing', { pct: 100, label: 'Saving video on server…', size: formatBytes(total) });
          } else {
            setVcProgress('uploading', {
              pct,
              label: 'Uploading video…',
              size: `${formatBytes(loaded)} of ${formatBytes(total)}`,
            });
          }
        });
        if (!upData.ok) {
          fail(upData.error || 'Video upload failed');
          return;
        }
        setVcProgress('processing', { pct: 100, label: 'Submitting to contest…' });
        const data = await authFetch('/review-videos', {
          method: 'POST',
          body: JSON.stringify({
            orderId,
            productId,
            videoUrl: upData.url,
          }),
        });
        if (!data.ok) {
          fail(data.error || 'Could not submit contest video');
          return;
        }
        const newId = data.video?.id;
        form.reset();
        form.querySelector('.acc-rv-drop')?.classList.remove('is-filled');
        const fileLabel = document.getElementById('acc-vc-file-label');
        if (fileLabel) fileLabel.textContent = 'Tap to choose video';
        syncContestSelectState();
        const videos = await loadVideoContestPanel(newId);
        const confirmed = Array.isArray(videos) && videos.some((v) => Number(v.id) === Number(newId));
        if (confirmed) {
          setVcProgress('done', {
            pct: 100,
            label: '✓ Contest e video submit hoyeche — Under review',
            size: 'Admin check korbe. Selected winners pabe up to ৳2,000 bonus + reward points.',
          });
          showAlert(
            alertEl,
            'Contest video submitted — Under review. Selected winners get up to ৳2,000 bonus.',
            'success'
          );
        } else {
          setVcProgress('done', {
            pct: 100,
            label: '✓ Contest video submitted',
            size: 'Refresh this page if it does not appear in “Your contest submissions” yet.',
          });
        }
      } catch (_) {
        fail('Upload failed. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  const PR_UPLOAD_URL = (window.RAKU_API_BASE || '') + '/api/reviews/upload-image';
  const PR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  let prRating = 0;

  function setReviewTab(tab) {
    document.querySelectorAll('.acc-rv-tab[data-rv-tab]').forEach((b) => {
      const on = b.dataset.rvTab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.acc-rv-pane[data-rv-pane]').forEach((p) => {
      p.hidden = p.dataset.rvPane !== tab;
    });
  }

  function setPrRating(n) {
    prRating = n;
    document.querySelectorAll('#acc-pr-stars [data-star]').forEach((b) => {
      const on = Number(b.dataset.star) <= n;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', Number(b.dataset.star) === n ? 'true' : 'false');
    });
  }

  function setPrProgress(state, { pct, label } = {}) {
    const box = document.getElementById('acc-pr-progress');
    if (!box) return;
    if (state === 'hidden') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.toggle('is-processing', state === 'processing');
    box.classList.toggle('is-done', state === 'done');
    box.classList.toggle('is-error', state === 'error');
    if (pct != null) {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      const bar = document.getElementById('acc-pr-progress-bar');
      const pctEl = document.getElementById('acc-pr-progress-pct');
      if (bar) bar.style.width = p + '%';
      if (pctEl) pctEl.textContent = p + '%';
    }
    if (label != null) {
      const l = document.getElementById('acc-pr-progress-label');
      if (l) l.textContent = label;
    }
  }

  function starsHtml(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  function renderPhotoReviewsList(reviews, highlightId) {
    const el = document.getElementById('acc-pr-list');
    if (!el) return;
    if (!reviews.length) {
      el.innerHTML = '<div class="acc-empty"><i class="ti ti-photo"></i>No photo reviews yet.</div>';
      return;
    }
    el.innerHTML = reviews
      .map((r) => {
        const status = reviewVideoStatusClass(r.status);
        const label = reviewVideoStatusLabel(r.status);
        const isNew = highlightId != null && Number(r.id) === Number(highlightId);
        const name = escapeHtml(r.productName || 'Product');
        const title = r.productSlug
          ? `<a href="/product/${encodeURIComponent(r.productSlug)}">${name}</a>`
          : name;
        return `<article class="acc-rv-item acc-pr-item${isNew ? ' is-new' : ''}">
          <img class="acc-pr-thumb" src="${escapeHtml(r.imageUrl)}" alt="" loading="lazy">
          <div class="acc-pr-body">
            <div class="acc-rv-item-head">
              <div>
                <strong>${title}</strong>
                <div class="acc-rv-meta"><span class="acc-pr-rating">${starsHtml(r.rating)}</span> · ${formatDate(r.createdAt)}</div>
              </div>
              <span class="acc-rv-status ${status}">${label}</span>
            </div>
            ${r.comment ? `<p class="acc-pr-comment">${escapeHtml(r.comment)}</p>` : ''}
          </div>
        </article>`;
      })
      .join('');
  }

  function syncPhotoSelectState() {
    const sel = document.getElementById('acc-pr-product');
    const wrap = document.getElementById('acc-pr-select-wrap');
    if (!sel || !wrap) return;
    wrap.classList.toggle('has-value', !!sel.value);
    wrap.classList.toggle('is-disabled', !!sel.disabled);
  }

  function populatePhotoEligible(eligible) {
    const sel = document.getElementById('acc-pr-product');
    if (!sel) return;
    if (!eligible.length) {
      sel.innerHTML = '<option value="">No delivered products waiting for a photo review</option>';
      sel.disabled = true;
      syncPhotoSelectState();
      return;
    }
    sel.disabled = false;
    sel.innerHTML =
      '<option value="">Select a product…</option>' +
      eligible
        .map(
          (item) =>
            `<option value="${escapeHtml(`${item.orderId}:${item.productId}`)}">${escapeHtml(item.productName)} — #${escapeHtml(item.orderNumber)}</option>`
        )
        .join('');
    syncPhotoSelectState();
  }

  async function loadPhotoReviewPanel(highlightId) {
    if (!currentUser) return null;
    const [eligibleRes, listRes] = await Promise.all([
      authFetch('/photo-reviews/eligible'),
      authFetch('/photo-reviews'),
    ]);
    if (eligibleRes.ok) populatePhotoEligible(eligibleRes.eligible || []);
    if (listRes.ok) renderPhotoReviewsList(listRes.reviews || [], highlightId);
    return listRes.ok ? listRes.reviews || [] : null;
  }

  function compressReviewImage(file) {
    return new Promise((resolve) => {
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return resolve(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return resolve(file);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) return resolve(file);
            resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  function uploadReviewImageWithProgress(file, onProgress) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', PR_UPLOAD_URL);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (_) {
          data = null;
        }
        if (data) return resolve(data);
        if (xhr.status === 413) return resolve({ ok: false, error: 'Photo is too large. Maximum size is 5 MB.' });
        if (xhr.status === 401) return resolve({ ok: false, error: 'Your session expired. Please log in again.' });
        resolve({ ok: false, error: `Upload failed (server error ${xhr.status}). Please try again.` });
      };
      xhr.onerror = () => resolve({ ok: false, error: 'Network error — check your internet connection and try again.' });
      const fd = new FormData();
      fd.append('image', file);
      xhr.send(fd);
    });
  }

  function bindPhotoReviewPanel() {
    const form = document.getElementById('acc-pr-form');
    if (!form || form._rakuPrBound) return;
    form._rakuPrBound = true;

    document.querySelectorAll('.acc-rv-tab[data-rv-tab]').forEach((b) => {
      b.addEventListener('click', () => setReviewTab(b.dataset.rvTab));
    });
    document.querySelectorAll('#acc-pr-stars [data-star]').forEach((b) => {
      b.addEventListener('click', () => setPrRating(Number(b.dataset.star)));
    });

    const productSel = document.getElementById('acc-pr-product');
    const selectWrap = document.getElementById('acc-pr-select-wrap');
    productSel?.addEventListener('change', syncPhotoSelectState);
    productSel?.addEventListener('focus', () => selectWrap?.classList.add('is-open'));
    productSel?.addEventListener('blur', () => selectWrap?.classList.remove('is-open'));
    syncPhotoSelectState();

    const preview = document.getElementById('acc-pr-preview');
    const drop = form.querySelector('.acc-pr-drop');
    const fileLabel = document.getElementById('acc-pr-file-label');
    let previewUrl = null;
    const clearPreview = () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      if (preview) preview.hidden = true;
      drop?.classList.remove('is-filled');
      if (fileLabel) fileLabel.textContent = 'Tap to choose photo';
    };
    document.getElementById('acc-pr-image')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      setPrProgress('hidden');
      clearPreview();
      if (!f) return;
      if (!/^image\//i.test(f.type)) {
        setPrProgress('error', { pct: 0, label: 'Please choose an image file (JPG, PNG or WebP).' });
        return;
      }
      drop?.classList.add('is-filled');
      if (fileLabel) fileLabel.textContent = f.name;
      if (!preview) return;
      previewUrl = URL.createObjectURL(f);
      preview.querySelector('img').src = previewUrl;
      preview.hidden = false;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      const alertEl = document.getElementById('acc-pr-alert');
      const submitBtn = document.getElementById('acc-pr-submit');
      const [orderId, productId] = (document.getElementById('acc-pr-product')?.value || '').split(':').map(Number);
      const comment = document.getElementById('acc-pr-comment')?.value.trim() || '';
      const original = document.getElementById('acc-pr-image')?.files?.[0];
      if (!orderId || !productId) return showAlert(alertEl, 'Please select a delivered product.');
      if (!prRating) return showAlert(alertEl, 'Please choose a star rating.');
      if (!original) return showAlert(alertEl, 'Please choose a photo.');
      if (!/^image\//i.test(original.type)) return showAlert(alertEl, 'Please choose an image file (JPG, PNG or WebP).');

      if (submitBtn) submitBtn.disabled = true;
      const fail = (msg) => {
        setPrProgress('error', { label: msg });
        showAlert(alertEl, escapeHtml(msg));
      };
      try {
        setPrProgress('processing', { pct: 0, label: 'Preparing photo…' });
        const file = await compressReviewImage(original);
        if (file.size > PR_MAX_UPLOAD_BYTES) {
          fail(`Photo is too large (${formatBytes(file.size)}). Maximum size is 5 MB.`);
          return;
        }
        setPrProgress('uploading', { pct: 0, label: 'Uploading photo…' });
        const upData = await uploadReviewImageWithProgress(file, (loaded, total) => {
          const pct = (loaded / total) * 100;
          if (pct >= 100) setPrProgress('processing', { pct: 100, label: 'Saving photo…' });
          else setPrProgress('uploading', { pct, label: 'Uploading photo…' });
        });
        if (!upData.ok || !upData.url) {
          fail(upData.error || 'Photo upload failed');
          return;
        }
        setPrProgress('processing', { pct: 100, label: 'Sending to review section…' });
        const data = await authFetch('/photo-reviews', {
          method: 'POST',
          body: JSON.stringify({ orderId, productId, rating: prRating, comment, imageUrl: upData.url }),
        });
        if (!data.ok) {
          fail(data.error || 'Could not submit photo review');
          return;
        }
        form.reset();
        setPrRating(0);
        clearPreview();
        syncPhotoSelectState();
        await loadPhotoReviewPanel(data.id);
        setPrProgress('done', { pct: 100, label: '✓ Photo review sent — status: Under review' });
        showAlert(alertEl, 'Photo review submitted. It will appear on the product page after admin approval.', 'success');
      } catch (_) {
        fail('Upload failed. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
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
          ${orderStepperHtml(status)}
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

  async function fetchOrderTrack(orderNumber, phone) {
    const id = String(orderNumber || '').trim();
    if (!id) return { ok: false, error: 'Please enter your Order ID' };
    const q = new URLSearchParams({ orderNumber: id });
    const phoneVal = String(phone || '').trim();
    if (phoneVal) q.set('phone', phoneVal);
    const res = await fetch(`${STORE_API}/orders/track?${q.toString()}`, { credentials: 'same-origin' });
    try {
      return await res.json();
    } catch {
      return { ok: false, error: 'Could not load tracking info' };
    }
  }

  async function runAccountTrack(orderNumber) {
    const input = document.getElementById('acc-track-order-id');
    const phoneInput = document.getElementById('acc-track-phone');
    const submit = document.getElementById('acc-track-submit');
    const q = orderNumber != null ? String(orderNumber).trim() : input?.value.trim();
    if (input && orderNumber != null) input.value = q;
    if (!q) {
      renderTrackResult({ ok: false, error: 'Please enter your Order ID' });
      return;
    }
    if (submit) submit.disabled = true;
    const data = await fetchOrderTrack(q, phoneInput?.value);
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

    const cached = ordersByNumber.get(String(orderNumber));
    if (cached) {
      box.innerHTML = orderDetailsHtml(cached);
    } else {
      box.innerHTML = '<p class="acc-trk-loading"><i class="ti ti-loader"></i> Loading tracking…</p>';
      const data = await fetchOrderTrack(orderNumber);
      box.innerHTML = buildTrackResultHtml(data);
    }
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
          window.rakuSyncCart?.();
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
          window.rakuSyncCart?.();
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

    document.querySelectorAll('.acc-breadcrumb .link[data-page="home"]').forEach((el) => {
      el.onclick = () => {
        if (window.showPage) window.showPage('home');
      };
    });
  }

  window.openAccount = async function () {
    if (window.showPage && window._rakuVisiblePage !== 'account') {
      window.showPage('account');
      return;
    }
    await window._rakuInitAccountPage();
  };

  window._rakuInitAccountPage = async function () {
    if (!window.__RAKU_ACCOUNT_UI_BOUND) {
      bootAccountUi();
      window.__RAKU_ACCOUNT_UI_BOUND = true;
    }
    prepareAccountAuthShell();
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
    bindReviewVideosPanel();
    bindPhotoReviewPanel();
    bindVideoContestPanel();
    captureReferralFromUrl();
    applyStoredReferral();
  }

  initPasswordToggles();

  function bootAccountWhenReady() {
    if (window.RAKU_STANDALONE || window._rakuVisiblePage === 'account') {
      void window._rakuInitAccountPage();
    }
  }

  document.addEventListener('raku:ready', bootAccountWhenReady);
  if (window.__RAKU_READY__) bootAccountWhenReady();
})();
