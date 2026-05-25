const path = require('path');
const { query } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');

function isStorefrontHtmlRoute(pathname) {
  if (pathname.startsWith('/api') || pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/css') || pathname.startsWith('/js') || pathname.startsWith('/images')) return false;
  return true;
}

async function renderMaintenanceIfNeeded(req, res, next) {
  try {
    if (!isStorefrontHtmlRoute(req.path)) return next();
    if (req.method !== 'GET') return next();
    if (path.extname(req.path)) return next();

    const settings = await getSiteSettings(query);
    if (settings.maintenance_mode !== '1') return next();

    return res.status(503).render('maintenance', {
      siteName: settings.site_name || 'RakuShopBD',
      message:
        settings.maintenance_message ||
        `${settings.site_name || 'RakuShopBD'} is under maintenance. We're upgrading the store — please check again soon.`,
      announcement: settings.maintenance_announcement || settings.announcement_text || '',
      contactPhone: settings.contact_phone || '',
      contactEmail: settings.contact_email || '',
    });
  } catch (err) {
    console.error('Maintenance check failed', err);
    return next();
  }
}

module.exports = { renderMaintenanceIfNeeded };
