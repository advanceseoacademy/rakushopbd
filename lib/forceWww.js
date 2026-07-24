/**
 * 301 redirect apex host → www (e.g. rakushopbd.com → www.rakushopbd.com).
 * Skips localhost / private hosts. Enabled in production or when FORCE_WWW=1.
 */
function requestHost(req) {
  return String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function isLocalHost(host) {
  return (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  );
}

function forceWwwRedirect(req, res, next) {
  const force = process.env.FORCE_WWW;
  if (force === '0' || force === 'false') return next();
  const enabled = force === '1' || force === 'true' || process.env.NODE_ENV === 'production';
  if (!enabled) return next();

  const apex = String(process.env.CANONICAL_APEX || 'rakushopbd.com')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (!apex) return next();

  const host = requestHost(req);
  if (isLocalHost(host)) return next();
  if (host !== apex) return next();

  const wwwHost = `www.${apex}`;
  const pathAndQuery = req.originalUrl || '/';
  return res.redirect(301, `https://${wwwHost}${pathAndQuery}`);
}

module.exports = { forceWwwRedirect, requestHost };
