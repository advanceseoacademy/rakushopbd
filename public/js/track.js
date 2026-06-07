(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  let trackBound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtNum(n) {
    return Number(n).toLocaleString('en-US');
  }

  function formatPrice(amount) {
    return '৳' + fmtNum(Math.round(Number(amount) || 0));
  }

  function formatDatePretty(d) {
    try {
      return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d || '';
    }
  }

  async function track(orderNumber) {
    const id = String(orderNumber || '').trim();
    if (!id) return { ok: false, error: 'Please enter your Order ID' };
    const res = await fetch(`${API}/orders/track?orderNumber=${encodeURIComponent(id)}`, {
      credentials: 'same-origin',
    });
    try {
      return await res.json();
    } catch {
      return { ok: false, error: 'Invalid server response' };
    }
  }

  function renderResult(data) {
    const box = $('trk-result');
    if (!box) return;
    box.hidden = false;

    if (!data?.ok || !data.order) {
      box.innerHTML = `<div class="trk-err">${escapeHtml(data?.error || 'Order not found')}</div>`;
      return;
    }

    const o = data.order;
    const status = String(o.status || 'pending');
    const items = o.items || [];

    box.innerHTML = `
      <div class="trk-box">
        <div class="trk-r-head">
          <div><b>Order</b> <span style="color:var(--primary);">#${escapeHtml(o.orderNumber)}</span></div>
          <div class="trk-status ${escapeHtml(status)}">${escapeHtml(status)}</div>
        </div>
        <div class="trk-r-body">
          <div class="trk-meta">
            <div class="trk-m"><b>Name:</b> ${escapeHtml(o.customerName || '—')}</div>
            <div class="trk-m"><b>Date:</b> ${escapeHtml(formatDatePretty(o.createdAt))}</div>
            <div class="trk-m"><b>District:</b> ${escapeHtml(o.district || '—')}</div>
            <div class="trk-m"><b>Payment:</b> ${escapeHtml(o.paymentMethod || '—')}</div>
          </div>
          <div class="trk-items">
            ${items
              .map(
                (it) =>
                  `<div class="trk-item"><span>${escapeHtml(it.product_name)} <b>×${escapeHtml(
                    it.quantity
                  )}</b></span><span><b>${formatPrice(it.line_total)}</b></span></div>`
              )
              .join('')}
            <div class="trk-total"><span>Total</span><span>${escapeHtml(o.totalFormatted || formatPrice(o.total))}</span></div>
          </div>
        </div>
      </div>
    `;
  }

  async function runTrack() {
    const input = $('trk-order-id');
    const submit = $('trk-submit');
    if (!submit) return;
    submit.disabled = true;
    const res = await track(input?.value);
    submit.disabled = false;
    renderResult(res);
  }

  function initTrackPage() {
    if (!$('trk-order-id')) return;

    if (!trackBound) {
      trackBound = true;
      const input = $('trk-order-id');
      const submit = $('trk-submit');
      if (submit) submit.addEventListener('click', runTrack);
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') runTrack();
        });
      }
    }

    const input = $('trk-order-id');
    const result = $('trk-result');
    if (result) result.hidden = true;

    try {
      const url = new URL(window.location.href);
      const id = url.searchParams.get('id');
      if (id && input) {
        input.value = id;
        void runTrack();
        return;
      }
    } catch (_) {}

    if (input) setTimeout(() => input.focus(), 0);
  }

  window._rakuInitTrackPage = initTrackPage;

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('page-track');
    if (page && page.style.display !== 'none') initTrackPage();
  });
})();
