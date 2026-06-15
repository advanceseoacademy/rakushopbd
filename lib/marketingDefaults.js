const MARKETING_DEFAULTS = {
  marketing_enabled: '1',
  marketing_card1_title: 'Save More with Group Shopping!',
  marketing_card1_desc:
    'Join friends and family to unlock amazing discounts on our selected popular products. Our group shopping feature lets you enjoy bulk savings while shopping together.',
  marketing_card1_btn: 'Start Group Shopping',
  marketing_card1_link: '#products',
  marketing_card1_image: '/uploads/1780840201419-groupshopping.webp',
  marketing_card1_bg: '#fce4ec',
  marketing_card2_title: 'Get Surprise gift',
  marketing_card2_desc:
    'Subscribe with your phone number to get new gifts and updates about our new products and offers',
  marketing_card2_btn: 'Submit',
  marketing_card2_image: '/uploads/1780840201433-surprise-banner.webp',
  marketing_card2_bg: '#ede7f6',
};

function withMarketingDefaults(settings) {
  const out = { ...(settings || {}) };
  for (const [key, value] of Object.entries(MARKETING_DEFAULTS)) {
    if (!String(out[key] ?? '').trim()) out[key] = value;
  }
  return out;
}

module.exports = { MARKETING_DEFAULTS, withMarketingDefaults };
