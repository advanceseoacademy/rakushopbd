(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

  const bookForm = document.getElementById('appt-book-form');
  const lookupForm = document.getElementById('appt-lookup-form');
  const serviceSel = document.getElementById('appt-service');
  const timeSel = document.getElementById('appt-time');
  const dateInput = document.getElementById('appt-date');

  function setMinMaxDate() {
    const today = new Date();
    const min = new Date(today);
    min.setDate(min.getDate() + 1);
    const max = new Date(today);
    max.setDate(max.getDate() + 30);
    const fmt = (d) => d.toISOString().slice(0, 10);
    dateInput.min = fmt(min);
    dateInput.max = fmt(max);
    if (!dateInput.value) dateInput.value = fmt(min);
  }

  async function loadMeta() {
    try {
      const res = await fetch(API + '/appointments/meta');
      const data = await res.json();
      if (!data.ok) return;
      const types = (data.serviceTypes || []).filter((s) => s.value !== 'store_visit');
      serviceSel.innerHTML = types
        .map((s) => `<option value="${escapeAttr(s.value)}">${escapeHtml(s.label)}</option>`)
        .join('');
      timeSel.innerHTML =
        '<option value="">Select time</option>' +
        (data.timeSlots || [])
          .map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`)
          .join('');
    } catch (_) {
      serviceSel.innerHTML = '<option value="consultation">Product Consultation</option>';
      timeSel.innerHTML = '<option value="10:00 AM – 11:00 AM">10:00 AM – 11:00 AM</option>';
    }
    setMinMaxDate();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function normalizePhone(v) {
    return String(v || '')
      .replace(/\s+/g, '')
      .replace(/^\+880/, '0')
      .replace(/^880/, '0');
  }

  function showErr(el, msg) {
    el.textContent = msg;
    el.hidden = !msg;
  }

  document.querySelectorAll('[data-appt-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-appt-tab]').forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      const id = tab.dataset.apptTab;
      document.getElementById('appt-panel-book').hidden = id !== 'book';
      document.getElementById('appt-panel-lookup').hidden = id !== 'lookup';
    });
  });

  bookForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('appt-book-error');
    const okEl = document.getElementById('appt-book-success');
    const btn = document.getElementById('appt-book-btn');
    showErr(errEl, '');
    okEl.hidden = true;

    const payload = {
      name: document.getElementById('appt-name').value.trim(),
      phone: normalizePhone(document.getElementById('appt-phone').value),
      email: document.getElementById('appt-email').value.trim(),
      serviceType: serviceSel.value,
      date: dateInput.value,
      time: timeSel.value,
      notes: document.getElementById('appt-notes').value.trim(),
    };

    btn.disabled = true;
    try {
      const res = await fetch(API + '/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        showErr(errEl, data.error || 'Could not book appointment');
        return;
      }
      okEl.innerHTML = `
        <h3><i class="ti ti-circle-check"></i> Appointment booked!</h3>
        <p>Your reference number:</p>
        <div class="appt-ref">${escapeHtml(data.referenceNumber)}</div>
        <p>Save this number. We will contact you at <b>${escapeHtml(payload.phone)}</b> to confirm.</p>
        <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">${escapeHtml(data.message || '')}</p>`;
      okEl.hidden = false;
      bookForm.reset();
      setMinMaxDate();
      if (data.referenceNumber) {
        document.getElementById('appt-lookup-ref').value = data.referenceNumber;
        document.getElementById('appt-lookup-phone').value = payload.phone;
      }
    } catch (_) {
      showErr(errEl, 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
    }
  });

  lookupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('appt-lookup-error');
    const resultEl = document.getElementById('appt-lookup-result');
    const btn = document.getElementById('appt-lookup-btn');
    showErr(errEl, '');
    resultEl.hidden = true;

    const ref = document.getElementById('appt-lookup-ref').value.trim();
    const phone = normalizePhone(document.getElementById('appt-lookup-phone').value);
    btn.disabled = true;
    try {
      const q = new URLSearchParams({ ref, phone });
      const res = await fetch(API + '/appointments/lookup?' + q.toString());
      const data = await res.json();
      if (!data.ok) {
        showErr(errEl, data.error || 'Appointment not found');
        return;
      }
      const a = data.appointment;
      const st = (a.status || 'pending').toLowerCase();
      resultEl.innerHTML = `
        <div class="appt-lookup-result">
          <div class="appt-lookup-head">
            <b>${escapeHtml(a.referenceNumber)}</b>
            <span class="appt-status ${st}">${escapeHtml(st)}</span>
          </div>
          <div class="appt-lookup-body">
            <p><b>${escapeHtml(a.customerName)}</b> · ${escapeHtml(a.customerPhone)}</p>
            <p><b>Service:</b> ${escapeHtml(a.serviceLabel || a.serviceType)}</p>
            <p><b>Date:</b> ${escapeHtml(String(a.appointmentDate))}</p>
            <p><b>Time:</b> ${escapeHtml(a.appointmentTime)}</p>
            ${a.notes ? `<p><b>Notes:</b> ${escapeHtml(a.notes)}</p>` : ''}
          </div>
        </div>`;
      resultEl.hidden = false;
    } catch (_) {
      showErr(errEl, 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
    }
  });

  let metaLoaded = false;

  async function initAppointmentPage() {
    if (!document.getElementById('appt-book-form')) return;
    if (!metaLoaded) {
      await loadMeta();
      metaLoaded = true;
    }
    document.title = 'Book Appointment • RakuShopBD';
  }

  window._rakuInitAppointmentPage = initAppointmentPage;

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('appt-book-form')) initAppointmentPage();
  });

  document.addEventListener('raku:ready', () => {
    if (/^\/appointment\/?$/.test(location.pathname)) initAppointmentPage();
  });
})();
