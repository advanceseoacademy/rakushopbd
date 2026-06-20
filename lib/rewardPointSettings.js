/**
 * Reward point rules — admin-editable via site_settings.
 */
const DEFAULTS = {
  reward_points_enabled: '1',
  reward_points_per_taka: '100',
  reward_points_registration: '100',
  reward_points_first_order: '20',
  reward_points_review: '10',
  reward_points_photo_review: '10',
  reward_points_video_review: '100',
  reward_points_referral: '50',
  reward_points_referral_signup: '50',
  reward_points_min_redeem: '100',
  reward_points_max_order_percent: '50',
};

function readNum(value, fallback, { min = 0, max = null } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (out < min) out = min;
  if (max != null && out > max) out = max;
  return out;
}

function parseRewardPointConfig(settings = {}) {
  const perTaka = Math.max(1, readNum(settings.reward_points_per_taka, 100, { min: 1 }));
  return {
    enabled: String(settings.reward_points_enabled ?? '1') !== '0',
    perTaka,
    registration: readNum(settings.reward_points_registration, 100),
    firstOrder: readNum(settings.reward_points_first_order, 20),
    review: readNum(settings.reward_points_review, 10),
    photoReview: readNum(settings.reward_points_photo_review, 10),
    videoReview: readNum(settings.reward_points_video_review, 100),
    referral: readNum(settings.reward_points_referral, 50),
    referralSignup: readNum(settings.reward_points_referral_signup, 50),
    minRedeem: readNum(settings.reward_points_min_redeem, 100, { min: 1 }),
    maxOrderPercent: readNum(settings.reward_points_max_order_percent, 50, { min: 0, max: 100 }),
  };
}

function rewardPointSettingDefaults() {
  return Object.entries(DEFAULTS);
}

module.exports = {
  DEFAULTS,
  parseRewardPointConfig,
  rewardPointSettingDefaults,
};
