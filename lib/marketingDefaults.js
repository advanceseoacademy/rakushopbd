const { brandPale, primaryPale } = require('./brandColors');

const MARKETING_DEFAULTS = {
  marketing_enabled: '1',
  marketing_card1_title: 'Save More with Group Shopping!',
  marketing_card1_desc:
    'Join friends and family to unlock amazing discounts on our selected popular products. Our group shopping feature lets you enjoy bulk savings while shopping together.',
  marketing_card1_btn: 'Start Group Shopping',
  marketing_card1_link: '#products',
  marketing_card1_image: '/uploads/1780840201419-groupshopping.webp',
  marketing_card1_bg: primaryPale,
  marketing_card2_title: 'Get Surprise gift',
  marketing_card2_desc:
    'Subscribe with your phone number to get new gifts and updates about our new products and offers',
  marketing_card2_btn: 'Submit',
  marketing_card2_image: '/uploads/1780840201433-surprise-banner.webp',
  marketing_card2_bg: brandPale,
  // Popups (up to 5 templates)
  popup_enabled: '1',
  popup_interval_hours: '24',
  popup_active_template: 'gift',
  popup_templates: JSON.stringify([
    {
      id: 'gift',
      enabled: true,
      kicker: 'Exclusive offer',
      badge: 'Surprise gift',
      icon: 'ti-gift',
      title: 'Get Surprise gift',
      desc: 'Subscribe with your phone number to get new gifts and updates about our new products and offers',
      button: 'Submit',
      image: '/uploads/1780840201433-surprise-banner.webp',
      mode: 'subscribe',
    },
    {
      id: 'points',
      enabled: true,
      kicker: 'Reward points',
      badge: 'Earn points',
      icon: 'ti-award',
      title: 'Reward Points is live',
      desc: 'Earn points on signup, first order, and approved reviews. Use your points to save on future orders.',
      button: 'Sign up now',
      image: '',
      mode: 'link',
      link: '/account?signup=1',
    },
    {
      id: 'delivery',
      enabled: true,
      kicker: 'Delivery update',
      badge: 'Fast delivery',
      icon: 'ti-truck-delivery',
      title: 'We deliver all over Bangladesh',
      desc: 'Track your order any time and get support on WhatsApp.',
      button: 'Track order',
      image: '',
      mode: 'link',
      link: '/track',
    },
    {
      id: 'new',
      enabled: false,
      kicker: 'New arrivals',
      badge: 'Just dropped',
      icon: 'ti-sparkles',
      title: 'New products every week',
      desc: 'Check our latest arrivals and limited deals on the homepage.',
      button: 'Browse',
      image: '',
      mode: 'link',
      link: '/#products',
    },
    {
      id: 'support',
      enabled: false,
      kicker: 'Need help?',
      badge: 'Customer care',
      icon: 'ti-message-circle-2',
      title: 'Ask anything before you buy',
      desc: 'We reply fast on Messenger and WhatsApp for product questions.',
      button: 'Contact us',
      image: '',
      mode: 'link',
      link: '/contact',
    },
  ]),
};

function withMarketingDefaults(settings) {
  const out = { ...(settings || {}) };
  for (const [key, value] of Object.entries(MARKETING_DEFAULTS)) {
    if (!String(out[key] ?? '').trim()) out[key] = value;
  }
  return out;
}

module.exports = { MARKETING_DEFAULTS, withMarketingDefaults };
