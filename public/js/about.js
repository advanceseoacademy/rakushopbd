(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';

  function fillAboutInfo(settings) {
    if (!settings) return;

    const fb = document.getElementById('about-facebook-link');
    if (fb) {
      const url = String(settings.social_facebook || '').trim() || 'https://www.facebook.com/rakushopbd';
      fb.href = url;
    }

    const wa = document.getElementById('about-whatsapp-link');
    if (wa) {
      const raw = String(settings.social_whatsapp || settings.contact_phone || '+880 1339-411587').trim();
      const digits = raw.replace(/\D/g, '');
      const waNum = digits.startsWith('880') ? digits : `880${digits.replace(/^0/, '')}`;
      wa.href = `https://wa.me/${waNum}`;
      wa.textContent = raw || '+880 1339-411587';
    }

    const address = document.getElementById('about-address');
    if (address && settings.contact_address) {
      address.textContent = settings.contact_address;
    }
  }

  async function loadSettings() {
    if (window._rakuStoreSettings) {
      fillAboutInfo(window._rakuStoreSettings);
      return;
    }
    try {
      const res = await fetch(`${API}/settings`);
      const data = await res.json();
      if (data.ok && data.settings) {
        window._rakuStoreSettings = data.settings;
        fillAboutInfo(data.settings);
      }
    } catch (_) {}
  }

  window._rakuInitAboutPage = loadSettings;

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('page-about');
    if (page && page.style.display !== 'none') loadSettings();
  });
  document.addEventListener('raku:settings-loaded', (e) => fillAboutInfo(e.detail));
})();
