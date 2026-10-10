const { query, usePostgres } = require('../config/db');

let ensured = false;

function isIgnorableAlterError(err) {
  const msg = String(err?.message || '');
  const code = err?.code || err?.errno;
  return (
    code === 'ER_DUP_FIELDNAME' ||
    code === '42701' ||
    /duplicate|already exists|same as before/i.test(msg)
  );
}

/** Ensure coupons.discount_type accepts free_delivery (Postgres VARCHAR width + MySQL ENUM). */
async function ensureCouponFreeDeliveryType() {
  if (ensured) return;
  try {
    if (usePostgres()) {
      await query(`ALTER TABLE coupons ALTER COLUMN discount_type TYPE VARCHAR(20)`);
    } else {
      await query(
        `ALTER TABLE coupons MODIFY COLUMN discount_type ENUM('percent','fixed','free_delivery') NOT NULL DEFAULT 'percent'`
      );
    }
  } catch (err) {
    if (!isIgnorableAlterError(err)) {
      // Column may already be wide enough / enum already updated
      if (!/varchar|character varying|enum/i.test(String(err.message))) {
        throw err;
      }
    }
  }
  try {
    await query(
      `ALTER TABLE coupons ADD COLUMN free_delivery ${usePostgres() ? 'BOOLEAN NOT NULL DEFAULT false' : 'TINYINT(1) NOT NULL DEFAULT 0'}`
    );
  } catch (err) {
    if (!isIgnorableAlterError(err)) throw err;
  }
  ensured = true;
}

/** Coupon gives free delivery: dedicated free-delivery type, or the on/off switch on a discount coupon. */
function couponGivesFreeDelivery(coupon) {
  if (!coupon) return false;
  if (String(coupon.discount_type || '') === 'free_delivery') return true;
  const flag = coupon.free_delivery ?? coupon.freeDelivery;
  return flag === true || flag === 1 || flag === '1' || flag === 't' || flag === 'true';
}

module.exports = { ensureCouponFreeDeliveryType, couponGivesFreeDelivery };
