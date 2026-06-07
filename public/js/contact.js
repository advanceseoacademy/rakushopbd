(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  const form = document.getElementById('contact-form');
  const alertBox = document.getElementById('contact-alert');
  const submitBtn = document.getElementById('contact-submit');

  function showAlert(type, text) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = `contact-alert ${type}`;
    alertBox.textContent = text;
  }

  function fillContactInfo(settings) {
    if (!settings) return;
    const phone = document.getElementById('contact-info-phone');
    const email = document.getElementById('contact-info-email');
    const address = document.getElementById('contact-info-address');
    const hours = document.getElementById('contact-info-hours');
    const wa = document.getElementById('contact-whatsapp');

    if (phone && settings.contact_phone) {
      const p = String(settings.contact_phone).trim();
      phone.href = `tel:${p.replace(/\s/g, '')}`;
      phone.textContent = p;
    }
    if (email && settings.contact_email) {
      email.href = `mailto:${settings.contact_email}`;
      email.textContent = settings.contact_email;
    }
    if (address && settings.contact_address) {
      address.textContent = settings.contact_address;
    }
    if (hours) {
      hours.textContent = settings.store_hours || '9 AM — 10 PM';
    }
    if (wa) {
      const waNum = (settings.social_whatsapp || settings.contact_phone || '').replace(/\D/g, '');
      if (waNum) {
        wa.href = `https://wa.me/${waNum.startsWith('880') ? waNum : '880' + waNum.replace(/^0/, '')}`;
        wa.hidden = false;
      }
    }
  }

  async function loadSettings() {
    if (window._rakuStoreSettings) {
      fillContactInfo(window._rakuStoreSettings);
      return;
    }
    try {
      const res = await fetch(`${API}/settings`);
      const data = await res.json();
      if (data.ok && data.settings) {
        window._rakuStoreSettings = data.settings;
        fillContactInfo(data.settings);
      }
    } catch (_) {}
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (alertBox) alertBox.hidden = true;
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value,
        message: form.message.value.trim(),
      };

      try {
        const res = await fetch(`${API}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          showAlert('success', data.message || 'Message sent successfully. We will reply soon.');
          form.reset();
        } else {
          showAlert('error', data.error || 'Could not send message. Please try again.');
        }
      } catch (_) {
        showAlert('error', 'Network error. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  window._rakuInitContactPage = loadSettings;

  window._rakuPrefillContactPreOrder = function ({ name, sku }) {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const subject = form.querySelector('[name="subject"]');
    const message = form.querySelector('[name="message"]');
    if (subject) subject.value = 'preorder';
    if (message) {
      message.value = `I would like to pre-order the following product:\n\nProduct: ${name}\nSKU: ${sku}\n\nPlease contact me when it is available.`;
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('page-contact');
    if (page && page.style.display !== 'none') loadSettings();
  });
  document.addEventListener('raku:settings-loaded', (e) => fillContactInfo(e.detail));
})();
