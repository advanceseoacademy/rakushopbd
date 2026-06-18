/**
 * Client-side maintenance screen (if toggled while user is on site)
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.showMaintenancePage = function (settings) {
    const s = settings || {};
    const siteName = escapeHtml(s.site_name || 'RakuShopBD');
    const message = escapeHtml(
      s.maintenance_message ||
        `${s.site_name || 'RakuShopBD'} is under maintenance. Please check again later.`
    );
    const ann = s.maintenance_announcement || s.announcement_text || '';
    const phone = s.contact_phone || '';
    const email = s.contact_email || '';

    document.title = siteName + ' — Under Maintenance';
    document.body.className = 'maint-body';
    document.body.innerHTML = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
<link rel="stylesheet" href="/css/maintenance.css">
<div class="maint-bg" aria-hidden="true"></div>
<div class="maint-wrap">
  <div class="maint-card">
    <img src="/images/rakushopbd-logo.png?v=8" alt="${siteName}" class="maint-logo" width="240" height="62">
    <div class="maint-icon-ring"><i class="ti ti-tools"></i></div>
    <h1 class="maint-title">We'll be back soon</h1>
    <p class="maint-sub">${message}</p>
    ${ann ? `<div class="maint-announce">${escapeHtml(ann)}</div>` : ''}
    <div class="maint-progress" aria-hidden="true"><div class="maint-progress-bar"></div></div>
    <div class="maint-contact">
      ${phone ? `<a href="tel:${phone.replace(/\s/g, '')}"><i class="ti ti-phone"></i>${escapeHtml(phone)}</a>` : ''}
      ${email ? `<a href="mailto:${escapeHtml(email)}"><i class="ti ti-mail"></i>${escapeHtml(email)}</a>` : ''}
    </div>
    <p class="maint-tagline">Comfort your life</p>
  </div>
</div>`;
  };
})();
