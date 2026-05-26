let cache = null;
let cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

async function getSiteSettings(query) {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  try {
    const rows = await query('SELECT setting_key, setting_value FROM site_settings');
    cache = {};
    rows.forEach((r) => {
      cache[r.setting_key] = r.setting_value;
    });
  } catch (_) {
    cache = {};
  }
  cacheAt = Date.now();
  return cache;
}

function clearSiteSettingsCache() {
  cache = null;
  cacheAt = 0;
}

function deliveryConfig(settings, district) {
  const freeMin = Number(settings.free_delivery_min) || 500;
  const dhakaFee = Number(settings.delivery_fee) || 60;
  const outsideFee = Number(settings.delivery_fee_outside) || 120;
  const isDhaka = district && String(district).trim().toLowerCase() === 'dhaka';
  return { freeMin, fee: isDhaka ? dhakaFee : outsideFee };
}

module.exports = { getSiteSettings, clearSiteSettingsCache, deliveryConfig };
