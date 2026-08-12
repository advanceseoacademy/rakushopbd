const { getSiteSettings } = require('./siteSettings');
const { parseRewardPointConfig } = require('./rewardPointSettings');

const REWARD = {
  REGISTRATION: 100,
  FIRST_ORDER: 20,
  REVIEW: 10,
  PHOTO_REVIEW: 10,
  REFERRAL: 50,
  REFERRAL_SIGNUP: 50,
};

const POINTS_PER_TAKA = 100;

async function getRewardPointConfig(query) {
  const settings = await getSiteSettings(query);
  return parseRewardPointConfig(settings);
}

function isDuplicateKeyError(err) {
  const code = err?.code || err?.errno;
  return (
    code === 'ER_DUP_ENTRY' ||
    code === 1062 ||
    code === '23505' ||
    /duplicate/i.test(String(err?.message))
  );
}

function pointsForAmount(amount, config) {
  const n = Number(amount);
  const perTaka = Math.max(1, Number(config?.perTaka) || POINTS_PER_TAKA);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / perTaka);
}

function pointsForProductPrice(price, qty = 1, config) {
  const q = Math.max(1, Number(qty) || 1);
  return pointsForAmount(Number(price) * q, config);
}

function pointsFromCartItems(cart, config) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce(
    (sum, item) => sum + pointsForAmount(Number(item.price) * Number(item.qty || 1), config),
    0
  );
}

function pointsFromOrderItems(items, config) {
  if (!Array.isArray(items)) return 0;
  return items.reduce(
    (sum, item) =>
      sum +
      pointsForAmount(
        Number(item.unit_price ?? item.unitPrice ?? item.price) * Number(item.quantity ?? item.qty ?? 1),
        config
      ),
    0
  );
}

function buildReferralCode(userId) {
  return `RAKU${String(userId).padStart(6, '0')}`;
}

async function getUserRewardPoints(query, userId) {
  if (!userId) return 0;
  const rows = await query('SELECT reward_points FROM users WHERE id = ?', [userId]);
  return Number(rows[0]?.reward_points ?? rows[0]?.rewardPoints) || 0;
}

const REWARD_EVENT_LABELS = {
  registration: 'Registration bonus',
  referral: 'Referral — friend signed up',
  referral_signup: 'Referral signup bonus',
  first_order: 'First order bonus',
  review: 'Product review approved',
  review_photo: 'Photo review bonus',
  review_video: 'Video review bonus',
  order_delivery: 'Order delivered',
  order_redeem: 'Redeemed at checkout',
  admin_adjustment: 'Admin adjustment',
};

function describeRewardPointEvent(eventType, referenceKey) {
  const type = String(eventType || '');
  const ref = String(referenceKey || '');
  const label = REWARD_EVENT_LABELS[type] || type.replace(/_/g, ' ');
  let detail = '';
  if (type === 'order_delivery' || type === 'first_order' || type === 'order_redeem') {
    detail = ref ? `Order #${ref}` : '';
  } else if (type === 'referral') {
    detail = ref ? `New user #${ref}` : '';
  } else if (type === 'review' || type === 'review_photo') {
    detail = ref ? `Review #${ref}` : '';
  } else if (type === 'review_video') {
    detail = ref ? `Video #${ref}` : '';
  } else if (type === 'registration' || type === 'referral_signup') {
    detail = 'Account signup';
  } else if (type === 'admin_adjustment') {
    detail = 'Manual balance change';
  }
  return { label, detail };
}

async function recordRewardPointEvent(query, userId, eventType, points, referenceKey = 'once') {
  if (!userId || !Number.isFinite(Number(points)) || Number(points) === 0) return false;
  try {
    await query(
      `INSERT INTO reward_point_events (user_id, event_type, points, reference_key) VALUES (?, ?, ?, ?)`,
      [userId, eventType, Math.floor(Number(points)), String(referenceKey)]
    );
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

async function setUserRewardPoints(query, userId, points, options = {}) {
  const next = Math.max(0, Math.floor(Number(points) || 0));
  const current = await getUserRewardPoints(query, userId);
  await query('UPDATE users SET reward_points = ? WHERE id = ?', [next, userId]);
  if (options.logSource === 'admin' && next !== current) {
    await recordRewardPointEvent(query, userId, 'admin_adjustment', next - current, `admin_${Date.now()}`);
  }
  return next;
}

async function awardPointsEvent(query, userId, eventType, points, referenceKey = 'once') {
  if (!userId || points <= 0) {
    return { awarded: 0, balance: await getUserRewardPoints(query, userId) };
  }

  try {
    await query(
      `INSERT INTO reward_point_events (user_id, event_type, points, reference_key) VALUES (?, ?, ?, ?)`,
      [userId, eventType, points, String(referenceKey)]
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { awarded: 0, balance: await getUserRewardPoints(query, userId) };
    }
    throw err;
  }

  await query('UPDATE users SET reward_points = COALESCE(reward_points, 0) + ? WHERE id = ?', [
    points,
    userId,
  ]);
  return { awarded: points, balance: await getUserRewardPoints(query, userId) };
}

async function assignReferralCode(query, userId) {
  const code = buildReferralCode(userId);
  await query(
    'UPDATE users SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = \'\')',
    [code, userId]
  );
  const rows = await query('SELECT referral_code FROM users WHERE id = ? LIMIT 1', [userId]);
  return String(rows[0]?.referral_code || code);
}

async function findUserIdByReferralCode(query, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  const rows = await query('SELECT id FROM users WHERE UPPER(referral_code) = ? LIMIT 1', [normalized]);
  return rows[0]?.id || null;
}

async function awardRegistrationBonus(query, userId, config) {
  const cfg = config || (await getRewardPointConfig(query));
  if (!cfg.enabled) return { awarded: 0, balance: await getUserRewardPoints(query, userId) };
  return awardPointsEvent(query, userId, 'registration', cfg.registration, 'signup');
}

async function awardReferralBonus(query, referrerUserId, newUserId, config) {
  const cfg = config || (await getRewardPointConfig(query));
  if (!cfg.enabled || !referrerUserId || referrerUserId === newUserId) {
    return { awarded: 0, balance: await getUserRewardPoints(query, referrerUserId) };
  }
  return awardPointsEvent(query, referrerUserId, 'referral', cfg.referral, String(newUserId));
}

async function awardReferralSignupBonus(query, userId, config) {
  const cfg = config || (await getRewardPointConfig(query));
  if (!cfg.enabled || !userId || !cfg.referralSignup) {
    return { awarded: 0, balance: await getUserRewardPoints(query, userId) };
  }
  return awardPointsEvent(query, userId, 'referral_signup', cfg.referralSignup, 'signup');
}

async function awardFirstOrderBonus(query, userId, orderId, config) {
  const cfg = config || (await getRewardPointConfig(query));
  if (!cfg.enabled) return { awarded: 0, balance: await getUserRewardPoints(query, userId) };
  return awardPointsEvent(query, userId, 'first_order', cfg.firstOrder, String(orderId));
}

async function awardApprovedReviewPoints(query, review, config) {
  const cfg = config || (await getRewardPointConfig(query));
  const userId = Number(review?.user_id ?? review?.userId);
  if (!cfg.enabled || !userId) return { awarded: 0, balance: null };

  let awarded = 0;
  let balance = await getUserRewardPoints(query, userId);
  const reviewId = String(review.id);

  const base = await awardPointsEvent(query, userId, 'review', cfg.review, reviewId);
  awarded += base.awarded;
  balance = base.balance;

  const imageUrl = String(review.image_url ?? review.imageUrl ?? '').trim();
  if (imageUrl && cfg.photoReview > 0) {
    const photo = await awardPointsEvent(query, userId, 'review_photo', cfg.photoReview, reviewId);
    awarded += photo.awarded;
    balance = photo.balance;
  }

  return { awarded, balance };
}

async function awardApprovedReviewVideoPoints(query, videoRow, config) {
  const cfg = config || (await getRewardPointConfig(query));
  const userId = Number(videoRow?.user_id ?? videoRow?.userId);
  if (!cfg.enabled || !userId || !cfg.videoReview) {
    return { awarded: 0, balance: userId ? await getUserRewardPoints(query, userId) : null };
  }
  return awardPointsEvent(query, userId, 'review_video', cfg.videoReview, String(videoRow.id));
}

async function processNewUserRewards(query, userId, { referralCode, config } = {}) {
  const cfg = config || (await getRewardPointConfig(query));
  await assignReferralCode(query, userId);

  let referrerId = null;
  let referralAwarded = 0;
  let referralSignupAwarded = 0;

  if (cfg.enabled && referralCode) {
    referrerId = await findUserIdByReferralCode(query, referralCode);
    if (referrerId && Number(referrerId) !== Number(userId)) {
      await query('UPDATE users SET referred_by_user_id = ? WHERE id = ?', [referrerId, userId]);
      const ref = await awardReferralBonus(query, referrerId, userId, cfg);
      referralAwarded = ref.awarded;
      const signupRef = await awardReferralSignupBonus(query, userId, cfg);
      referralSignupAwarded = signupRef.awarded;
    }
  }

  const signup = await awardRegistrationBonus(query, userId, cfg);

  return {
    registrationAwarded: signup.awarded,
    referralAwarded,
    referralSignupAwarded,
    welcomePoints: signup.awarded + referralSignupAwarded,
    balance: signup.balance,
    referrerId,
  };
}

/** Award purchase points when an order is marked delivered (once per order). */
async function awardOrderPointsOnDelivery(query, orderId, config) {
  const cfg = config || (await getRewardPointConfig(query));
  const rows = await query(
    'SELECT id, user_id, status, reward_points_awarded FROM orders WHERE id = ?',
    [orderId]
  );
  const order = rows[0];
  if (!order?.user_id) return { earned: 0, bonus: 0, balance: null };
  if (Number(order.reward_points_awarded) > 0) {
    return { earned: 0, bonus: 0, balance: await getUserRewardPoints(query, order.user_id) };
  }
  if (String(order.status).toLowerCase() !== 'delivered') {
    return { earned: 0, bonus: 0, balance: null };
  }

  const items = await query('SELECT unit_price, quantity FROM order_items WHERE order_id = ?', [orderId]);
  let earned = 0;
  if (cfg.enabled) {
    earned = pointsFromOrderItems(items, cfg);
    if (earned > 0) {
      await awardPointsEvent(query, order.user_id, 'order_delivery', earned, String(orderId));
    }
  }
  await query('UPDATE orders SET reward_points_awarded = ? WHERE id = ?', [earned, orderId]);

  let bonus = 0;
  if (cfg.enabled) {
    const deliveredRows = await query(
      `SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ? AND LOWER(status) = 'delivered'`,
      [order.user_id]
    );
    const deliveredCount = Number(deliveredRows[0]?.cnt ?? deliveredRows[0]?.count) || 0;
    if (deliveredCount === 1) {
      const firstOrder = await awardFirstOrderBonus(query, order.user_id, orderId, cfg);
      bonus = firstOrder.awarded || 0;
    }
  }

  return {
    earned,
    bonus,
    balance: await getUserRewardPoints(query, order.user_id),
  };
}

async function listUserRewardPointHistory(query, userId) {
  if (!userId) return [];

  const events = await query(
    `SELECT id, event_type, points, reference_key, created_at
     FROM reward_point_events
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );

  const orders = await query(
    `SELECT id, reward_points_awarded, created_at
     FROM orders
     WHERE user_id = ? AND COALESCE(reward_points_awarded, 0) > 0`,
    [userId]
  );

  const loggedOrderIds = new Set(
    events.filter((row) => row.event_type === 'order_delivery').map((row) => String(row.reference_key))
  );

  const synthesized = orders
    .filter((order) => !loggedOrderIds.has(String(order.id)))
    .map((order) => ({
      id: null,
      event_type: 'order_delivery',
      points: Number(order.reward_points_awarded) || 0,
      reference_key: String(order.id),
      created_at: order.created_at,
      synthesized: true,
    }));

  return [...events, ...synthesized].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (tb !== ta) return tb - ta;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

module.exports = {
  POINTS_PER_TAKA,
  REWARD,
  REWARD_EVENT_LABELS,
  describeRewardPointEvent,
  recordRewardPointEvent,
  listUserRewardPointHistory,
  getRewardPointConfig,
  pointsForAmount,
  pointsForProductPrice,
  pointsFromCartItems,
  pointsFromOrderItems,
  getUserRewardPoints,
  setUserRewardPoints,
  buildReferralCode,
  assignReferralCode,
  findUserIdByReferralCode,
  awardRegistrationBonus,
  awardReferralBonus,
  awardReferralSignupBonus,
  awardFirstOrderBonus,
  awardApprovedReviewPoints,
  awardApprovedReviewVideoPoints,
  processNewUserRewards,
  awardOrderPointsOnDelivery,
};
