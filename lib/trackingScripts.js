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
  return `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${safe}"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config','${safe}');
</script>`;
}

function buildGtmHeadSnippet(id) {
  const safe = cleanId(id, /^GTM-[A-Z0-9]+$/i);
  if (!safe) return '';
  return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${safe}');</script>`;
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
  return `<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${safe}');
fbq('track','PageView');
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
