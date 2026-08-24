(function () {
  const cfg = window.__OFFER_DR_HANCY__ || {};
  const productId = Number(cfg.productId);
  const productUrl = cfg.productUrl || '/';
  const basePrice = Number(cfg.price) || 850;
  const deliveryFee = Number(cfg.deliveryFee) || 60;
  const deliveryFeeOutside = Number(cfg.deliveryFeeOutside) || 120;

  /* ── COUNTDOWN ── */
  (function initTimer() {
    const el = document.getElementById('lp-timer');
    if (!el) return;
    const ends = new Date(el.dataset.ends || '').getTime();
    if (!ends || isNaN(ends)) return;
    const d = document.getElementById('lp-td');
    const h = document.getElementById('lp-th');
    const m = document.getElementById('lp-tm');
    const s = document.getElementById('lp-ts');
    if (!d || !h || !m || !s) return;

    function pad(n) { return String(Math.max(0, n)).padStart(2, '0'); }
    function tick() {
      const diff = ends - Date.now();
      if (diff <= 0) { d.textContent = h.textContent = m.textContent = s.textContent = '00'; return; }
      d.textContent = pad(Math.floor(diff / 86400000));
      h.textContent = pad(Math.floor((diff % 86400000) / 3600000));
      m.textContent = pad(Math.floor((diff % 3600000) / 60000));
      s.textContent = pad(Math.floor((diff % 60000) / 1000));
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ── GALLERY THUMBS ── */
  const mainImg = document.getElementById('lp-main-img');
  document.querySelectorAll('.lp-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const src = thumb.dataset.src;
      if (!src || !mainImg) return;
      mainImg.src = src;
      document.querySelectorAll('.lp-thumb').forEach((t) => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });

  /* ── QTY CONTROL ── */
  const qtyInput = document.getElementById('lp-qty');
  const qtyDisplay = document.getElementById('lp-qty-display');
  const minusBtn = document.getElementById('lp-qty-minus');
  const plusBtn = document.getElementById('lp-qty-plus');
  let currentDistrict = 'Dhaka';

  function getQty() { return Math.max(1, Math.min(10, Number(qtyInput?.value) || 1)); }
  function getCurrentDelivery() { return currentDistrict === 'Dhaka' ? deliveryFee : deliveryFeeOutside; }
  function formatBDT(n) { return '৳' + Number(n).toLocaleString('en-BD'); }

  function updateSummary() {
    const qty = getQty();
    const subtotal = basePrice * qty;
    const delFee = getCurrentDelivery();
    const total = subtotal + delFee;

    if (qtyDisplay) qtyDisplay.textContent = qty;
    const lineEl = document.getElementById('lp-cart-line');
    if (lineEl) lineEl.textContent = formatBDT(subtotal);
    const summName = document.getElementById('lp-summ-name');
    if (summName) summName.textContent = (cfg.shortName || 'Product') + ' × ' + qty;
    const sub1 = document.getElementById('lp-summ-subtotal');
    const sub2 = document.getElementById('lp-summ-subtotal2');
    if (sub1) sub1.textContent = formatBDT(subtotal);
    if (sub2) sub2.textContent = formatBDT(subtotal);
    const delEl = document.getElementById('lp-summ-delivery');
    if (delEl) delEl.textContent = formatBDT(delFee);
    const totalEl = document.getElementById('lp-summ-total');
    if (totalEl) totalEl.textContent = formatBDT(total);
    const placeBtn = document.getElementById('lp-place-btn');
    const placeLabel = placeBtn?.querySelector('.lp-btn-label');
    if (placeLabel && !placeBtn.disabled) placeLabel.textContent = 'Place order ' + formatBDT(total);
  }

  if (minusBtn) minusBtn.addEventListener('click', () => {
    if (qtyInput) qtyInput.value = Math.max(1, getQty() - 1);
    updateSummary();
  });
  if (plusBtn) plusBtn.addEventListener('click', () => {
    if (qtyInput) qtyInput.value = Math.min(10, getQty() + 1);
    updateSummary();
  });
  if (qtyInput) qtyInput.addEventListener('input', updateSummary);

  /* ── DELIVERY ZONE ── */
  document.querySelectorAll('.lp-zone-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      document.querySelectorAll('.lp-zone-tile').forEach((t) => t.classList.remove('selected'));
      tile.classList.add('selected');
      currentDistrict = tile.dataset.district || 'Dhaka';
      const hidden = document.getElementById('lp-district');
      if (hidden) hidden.value = currentDistrict;
      updateSummary();
    });
  });

  /* ── PAYMENT METHOD ── */
  document.querySelectorAll('.lp-pay-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      document.querySelectorAll('.lp-pay-tile').forEach((t) => t.classList.remove('selected'));
      tile.classList.add('selected');
      const method = tile.dataset.method || 'cod';
      const hidden = document.getElementById('lp-paymethod');
      if (hidden) hidden.value = method;
      const trxWrap = document.getElementById('lp-trx-wrap');
      if (trxWrap) {
        const needsTrx = method === 'bkash' || method === 'nagad' || method === 'rocket';
        trxWrap.classList.toggle('is-visible', needsTrx);
        trxWrap.style.display = needsTrx ? '' : 'none';
      }
    });
  });
  // hide trx wrap initially
  const trxWrapInit = document.getElementById('lp-trx-wrap');
  if (trxWrapInit) trxWrapInit.style.display = 'none';

  /* ── DIRECT BUY NOW (hero buttons above form) ── */
  async function buyNow(btn) {
    if (btn.disabled || !productId) return;
    const label = btn.querySelector('.lp-btn-label');
    const orig = label ? label.textContent : null;
    btn.disabled = true;
    if (label) label.textContent = 'Adding…';
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, qty: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok || data.alreadyInCart) {
        window.location.href = '/checkout';
        return;
      }
      if (res.status === 400 && /out of stock|pre-order/i.test(String(data.error || ''))) {
        window.location.href = productUrl;
        return;
      }
      window.alert(data.error || 'Could not add to cart. Please try again.');
    } catch (_) {
      window.alert('Network error. Please try again.');
    } finally {
      btn.disabled = false;
      if (label && orig) label.textContent = orig;
    }
  }

  document.querySelectorAll('[data-offer-buy]').forEach((btn) => {
    btn.addEventListener('click', () => buyNow(btn));
  });

  /* ── ORDER FORM SUBMIT ── */
  function showError(msg) {
    const el = document.getElementById('lp-form-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function placeOrder(e) {
    e.preventDefault();
    showError('');
    const name = (document.getElementById('lp-name')?.value || '').trim();
    const phone = (document.getElementById('lp-phone')?.value || '').trim();
    const address = (document.getElementById('lp-address')?.value || '').trim();
    const district = (document.getElementById('lp-district')?.value || 'Dhaka').trim();
    const paymentMethod = (document.getElementById('lp-paymethod')?.value || 'cod').trim();
    const trxId = (document.getElementById('lp-trxid')?.value || '').trim();
    const qty = getQty();

    if (!name) return showError('আপনার নাম লিখুন।');
    if (!phone || !/^01[3-9]\d{8}$/.test(phone.replace(/\s/g, '')))
      return showError('সঠিক মোবাইল নম্বর লিখুন (01XXXXXXXXX)।');
    if (!address) return showError('আপনার পূর্ণ ঠিকানা লিখুন।');
    const needsTrx = paymentMethod === 'bkash' || paymentMethod === 'nagad' || paymentMethod === 'rocket';
    if (needsTrx && !trxId) return showError('Transaction ID (TrxID) লিখুন।');

    const placeBtn = document.getElementById('lp-place-btn');
    const placeLabel = placeBtn?.querySelector('.lp-btn-label');
    if (placeBtn) placeBtn.disabled = true;
    if (placeLabel) placeLabel.textContent = 'অর্ডার দেওয়া হচ্ছে…';

    try {
      // 1. add to cart (or ensure in cart)
      const cartRes = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, qty }),
      });
      const cartData = await cartRes.json().catch(() => ({}));
      if (!cartData.ok && !cartData.alreadyInCart) {
        showError(cartData.error || 'Could not add to cart.');
        if (placeBtn) placeBtn.disabled = false;
        if (placeLabel) placeLabel.textContent = 'Place order';
        return;
      }

      // 2. set delivery district on session
      await fetch('/api/cart/district', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ district }),
      });

      // 3. place order
      let notes = trxId ? `TrxID (${paymentMethod}): ${trxId}` : '';
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone, address, district, paymentMethod, notes }),
      });
      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderData.ok) {
        showError(orderData.error || 'অর্ডার দেওয়া সম্ভব হয়নি। আবার চেষ্টা করুন।');
        if (placeBtn) placeBtn.disabled = false;
        if (placeLabel) placeLabel.textContent = 'Place order';
        return;
      }

      // 4. show success
      const formWrap = document.getElementById('lp-form-wrap');
      const successEl = document.getElementById('lp-success');
      const orderNumEl = document.getElementById('lp-success-order-num');
      if (formWrap) formWrap.querySelector('form').hidden = true;
      if (successEl) { successEl.hidden = false; successEl.scrollIntoView({ behavior: 'smooth' }); }
      if (orderNumEl) orderNumEl.textContent = 'Order ID: ' + (orderData.orderNumber || '');
    } catch (_) {
      showError('Network error. Please try again.');
      if (placeBtn) placeBtn.disabled = false;
      if (placeLabel) placeLabel.textContent = 'Place order';
    }
  }

  const form = document.getElementById('lp-order-form');
  if (form) form.addEventListener('submit', placeOrder);

  // initialise summary display
  updateSummary();
})();
