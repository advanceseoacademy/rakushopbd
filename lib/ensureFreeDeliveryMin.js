const { query } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');
const { clearStoreBootstrapCache } = require('./storeBootstrap');

/**
 * Align free-delivery marketing copy with ৳2,500 when still on legacy ৳500 values.
 */
async function ensureFreeDeliveryMin() {
  try {
    const rows = await query(
      `SELECT setting_key, setting_value FROM site_settings
       WHERE setting_key IN ('free_delivery_min', 'trust_1_sub')`
    );
    const map = Object.fromEntries(
      (rows || []).map((r) => [r.setting_key, String(r.setting_value ?? '')])
    );
    const freeMin = String(map.free_delivery_min || '').trim();
    const trustSub = String(map.trust_1_sub || '').trim();
    let changed = false;

    if (!freeMin || freeMin === '500') {
      await query(upsertSiteSettingSql(), ['free_delivery_min', '2500']);
      changed = true;
    }
    if (
      !trustSub ||
      /৳\s*500\b/.test(trustSub) ||
      /Tk\.?\s*500\b/i.test(trustSub) ||
      /over\s+500\b/i.test(trustSub)
    ) {
      await query(upsertSiteSettingSql(), ['trust_1_sub', 'Nationwide on orders over ৳2,500']);
      changed = true;
    }

    // Always drop settings + bootstrap caches so Redis cannot keep legacy ৳500 copy.
    await clearSiteSettingsCache();
    await clearStoreBootstrapCache();
  } catch (err) {
    console.warn('ensureFreeDeliveryMin:', err.message);
  }
}

module.exports = { ensureFreeDeliveryMin };
