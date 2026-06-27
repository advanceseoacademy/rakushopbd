const appCache = require('./appCache');

const TTL_SEC = 5 * 60;
const CACHE_KEY = 'settings';

async function getSiteSettings(query) {
  const cached = await appCache.getJson(CACHE_KEY);
  if (cached) return cached;

  let settings = {};
  try {
    const rows = await query('SELECT setting_key, setting_value FROM site_settings');
    settings = {};
    rows.forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });
  } catch (_) {
    settings = {};
  }

  await appCache.setJson(CACHE_KEY, settings, TTL_SEC);
  return settings;
}

function clearSiteSettingsCache() {
  void appCache.del(CACHE_KEY);
}

function deliveryConfig(settings, district) {
  const freeMin = Number(settings.free_delivery_min) || 500;
  const dhakaFee = Number(settings.delivery_fee) || 60;
  const outsideFee = Number(settings.delivery_fee_outside) || 120;
  const isDhaka = district && String(district).trim().toLowerCase() === 'dhaka';
  return { freeMin, fee: isDhaka ? dhakaFee : outsideFee };
}

module.exports = { getSiteSettings, clearSiteSettingsCache, deliveryConfig };
