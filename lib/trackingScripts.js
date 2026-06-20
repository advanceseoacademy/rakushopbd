function buildGscMeta(content) {
  const safe = String(content || '')
    .trim()
    .replace(/["<>]/g, '');
  if (!safe) return '';
  return `<meta name="google-site-verification" content="${safe}">`;
}

function cleanId(value, pattern) {
  const raw = String(value || '').trim();
  if (!raw || !pattern.test(raw)) return '';
  return raw;
}

function cleanPixelId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || '';
}

function buildGa4Snippet(id) {
  const safe = cleanId(id, /^(G-[A-Z0-9]+|UA-\d+-\d+)$/i);
  if (!safe) return '';
  return `<!-- Google Analytics (loads on first user interaction via deferred-vendors.js) -->
<script>window.__RAKU_GA4_ID=${JSON.stringify(safe)};</script>`;
}

function buildGtmHeadSnippet(id) {
  const safe = cleanId(id, /^GTM-[A-Z0-9]+$/i);
  if (!safe) return '';
  return `<!-- Google Tag Manager (loads on first user interaction via deferred-vendors.js) -->
<script>window.__RAKU_GTM_ID=${JSON.stringify(safe)};</script>`;
}

function buildGtmBodySnippet(id) {
  const safe = cleanId(id, /^GTM-[A-Z0-9]+$/i);
  if (!safe) return '';
  return `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${safe}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}

function buildFbPixelSnippet(id) {
  const safe = cleanPixelId(id);
  if (!safe) return '';
  return `<!-- Meta Pixel (loads on checkout/conversion via /js/deferred-vendors.js — not on homepage) -->
<script>
window.__RAKU_FB_PIXEL_ID=${JSON.stringify(safe)};
window.fbq=window.fbq||function(){(window.fbq.q=window.fbq.q||[]).push(arguments);};
if(!window._fbq)window._fbq=window.fbq;
window.fbq.q=window.fbq.q||[];
window.fbq.l=1*new Date();
</script>
<noscript><img height="1" width="1" style="display:none" alt=""
src="https://www.facebook.com/tr?id=${safe}&ev=PageView&noscript=1"/></noscript>`;
}

function buildTrackingScripts(settings) {
  const s = settings || {};
  const headParts = [
    buildGscMeta(s.seo_google_verification),
    buildGa4Snippet(s.tracking_ga4_id),
    buildGtmHeadSnippet(s.tracking_gtm_id),
    buildFbPixelSnippet(s.tracking_facebook_pixel_id),
    String(s.tracking_scripts_head || '').trim(),
  ].filter(Boolean);

  const bodyParts = [
    buildGtmBodySnippet(s.tracking_gtm_id),
    String(s.tracking_scripts_body || '').trim(),
  ].filter(Boolean);

  const footerParts = [String(s.tracking_scripts_footer || '').trim()].filter(Boolean);

  return {
    head: headParts.join('\n'),
    bodyStart: bodyParts.join('\n'),
    footer: footerParts.join('\n'),
  };
}

module.exports = { buildTrackingScripts };
