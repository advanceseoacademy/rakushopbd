const LEGAL_SLUGS = ['privacy', 'terms', 'return', 'preorder'];

const LEGAL_PAGE_DEFS = {
  privacy: {
    slug: 'privacy',
    path: '/privacy-policy',
    settingsTitle: 'legal_privacy_title',
    settingsContent: 'legal_privacy_content',
    defaultTitle: 'Privacy Policy',
    defaultSubtitle: 'How RakuShopBD collects, uses, and protects your personal information.',
    seoDescription: 'Privacy Policy — how we handle your personal data when you shop at RakuShopBD.',
  },
  terms: {
    slug: 'terms',
    path: '/terms-and-conditions',
    settingsTitle: 'legal_terms_title',
    settingsContent: 'legal_terms_content',
    defaultTitle: 'Terms & Conditions',
    defaultSubtitle: 'Rules and guidelines for using RakuShopBD and placing orders.',
    seoDescription: 'Terms and Conditions for shopping on RakuShopBD.',
  },
  return: {
    slug: 'return',
    path: '/return-policy',
    settingsTitle: 'legal_return_title',
    settingsContent: 'legal_return_content',
    defaultTitle: 'Return Policy',
    defaultSubtitle: 'Easy returns within 7 days — what is covered and how to request a return.',
    seoDescription: 'Return and refund policy for RakuShopBD orders.',
  },
  preorder: {
    slug: 'preorder',
    path: '/pre-order-policy',
    settingsTitle: 'legal_preorder_title',
    settingsContent: 'legal_preorder_content',
    defaultTitle: 'Pre-Order Policy',
    defaultSubtitle:
      'How pre-orders work for authentic Japanese skincare and beauty products in Bangladesh.',
    seoDescription: 'Pre-order policy for Japanese skincare and beauty products at Raku Shop BD.',
  },
};

function defaultPrivacyHtml(siteName) {
  const n = siteName || 'RakuShopBD';
  return `<h2>Introduction</h2>
<p>Welcome to ${n}. We respect your privacy and are committed to protecting your personal data. This policy explains what information we collect, how we use it, and your rights.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Account &amp; order details:</strong> name, phone number, email address, delivery address, and order history.</li>
<li><strong>Payment information:</strong> mobile wallet transaction references (bKash, Nagad, Rocket) — we do not store full payment credentials.</li>
<li><strong>Usage data:</strong> pages visited, device type, and cookies used to improve our website.</li>
</ul>
<h2>How we use your information</h2>
<ul>
<li>To process and deliver your orders</li>
<li>To communicate order updates and customer support</li>
<li>To improve our products, services, and website experience</li>
<li>To comply with legal obligations</li>
</ul>
<h2>Sharing your data</h2>
<p>We do not sell your personal information. We may share data with trusted delivery partners and payment processors only as needed to fulfil your order.</p>
<h2>Cookies &amp; analytics</h2>
<p>We may use cookies and analytics tools (such as Google Analytics) to understand how visitors use our site. You can control cookies through your browser settings.</p>
<h2>Data security</h2>
<p>We use reasonable technical and organisational measures to protect your information. No method of transmission over the internet is 100% secure.</p>
<h2>Your rights</h2>
<p>You may request access, correction, or deletion of your personal data by contacting us.</p>
<h2>Contact</h2>
<p>Questions about this policy? Visit our <a href="/contact">Contact page</a> or email the address listed in our website footer.</p>
<p><em>Last updated: ${new Date().getFullYear()}</em></p>`;
}

function defaultTermsHtml(siteName) {
  const n = siteName || 'RakuShopBD';
  return `<h2>Agreement</h2>
<p>By accessing ${n} or placing an order, you agree to these Terms &amp; Conditions. If you do not agree, please do not use our website.</p>
<h2>Orders &amp; pricing</h2>
<ul>
<li>All prices are listed in Bangladeshi Taka (৳) unless stated otherwise.</li>
<li>We reserve the right to correct pricing errors and cancel orders affected by such errors.</li>
<li>Order confirmation depends on product availability and successful payment verification.</li>
</ul>
<h2>Payment</h2>
<p>We accept mobile banking (bKash, Nagad, Rocket) and cash on delivery where available. You must provide accurate payment details and transaction references when required.</p>
<h2>Delivery</h2>
<p>Estimated delivery times are shown at checkout. Delays may occur due to weather, holidays, or courier issues beyond our control.</p>
<h2>Product information</h2>
<p>We aim to display accurate product images and descriptions. Minor variations in packaging or colour may occur for genuine imported or local products.</p>
<h2>User accounts</h2>
<p>You are responsible for keeping your account credentials secure and for all activity under your account.</p>
<h2>Limitation of liability</h2>
<p>${n} is not liable for indirect or consequential losses arising from use of the website or delayed delivery, except where required by applicable law.</p>
<h2>Changes</h2>
<p>We may update these terms at any time. Continued use of the site after changes constitutes acceptance.</p>
<h2>Contact</h2>
<p>For questions about these terms, please <a href="/contact">contact us</a>.</p>
<p><em>Last updated: ${new Date().getFullYear()}</em></p>`;
}

function defaultReturnHtml(siteName) {
  const n = siteName || 'RakuShopBD';
  return `<h2>7-day return window</h2>
<p>Most items purchased from ${n} can be returned within <strong>7 days</strong> of delivery if they are unused, in original packaging, and accompanied by proof of purchase.</p>
<h2>Eligible items</h2>
<ul>
<li>Products that are damaged, defective, or incorrect on arrival</li>
<li>Sealed beauty &amp; personal care items that are unopened (where applicable)</li>
<li>Items that differ materially from the description on our website</li>
</ul>
<h2>Non-returnable items</h2>
<ul>
<li>Opened or used personal care, cosmetics, or hygiene products</li>
<li>Digital products or gift cards</li>
<li>Items marked as final sale or non-returnable on the product page</li>
</ul>
<h2>How to request a return</h2>
<ol>
<li>Contact us via the <a href="/contact">Contact page</a> or phone with your order number.</li>
<li>Describe the issue and attach photos if the item is damaged or wrong.</li>
<li>Our team will confirm eligibility and arrange pickup or return instructions.</li>
</ol>
<h2>Refunds</h2>
<p>Approved refunds are processed to your original payment method or mobile wallet within <strong>5–10 business days</strong> after we receive and inspect the returned item.</p>
<h2>Exchange</h2>
<p>Exchanges may be offered for the same product (different variant) subject to stock availability.</p>
<h2>Contact</h2>
<p>Need help with a return? <a href="/contact">Get in touch</a> — we are happy to assist.</p>
<p><em>Last updated: ${new Date().getFullYear()}</em></p>`;
}

function defaultPreorderHtml(siteName) {
  const n = siteName || 'Raku Shop BD';
  return `<p>At ${n}, we offer selected Japanese skincare, cosmetics, and beauty products through our pre-order service so customers in Bangladesh can access authentic items that may not always be available in ready stock.</p>
<p>Please read this policy carefully before placing a pre-order. By confirming your order, you agree to the terms and conditions mentioned below.</p>
<h2>1. What is a Pre-Order?</h2>
<p>A pre-order means placing an order for a product that is not currently available for immediate delivery. The item will be specially sourced, arranged, or imported upon customer request.</p>
<p>Pre-order items may require additional time due to supplier confirmation, international shipping, customs processing, and local delivery arrangements.</p>
<h2>2. Estimated Delivery Time</h2>
<p>Delivery times for pre-order items may vary depending on product availability, supplier response, shipment schedules, and customs procedures.</p>
<p><strong>Estimated delivery time:</strong> 10–25 working days</p>
<p>In some situations, delivery may take longer due to:</p>
<ul>
<li>Supplier delays</li>
<li>International shipping disruptions</li>
<li>Customs clearance procedures</li>
<li>Public holidays</li>
<li>Unexpected logistics issues</li>
</ul>
<h2>3. Advance Payment Policy</h2>
<p>Certain pre-order products may require either:</p>
<ul>
<li>Full advance payment, or</li>
<li>Partial advance payment</li>
</ul>
<p>Orders will only be considered confirmed after the required payment has been successfully received.</p>
<h2>4. Price Adjustment Policy</h2>
<p>Pre-order prices are generally confirmed at the time the order is placed. However, rare situations may cause price changes because of:</p>
<ul>
<li>Supplier price updates</li>
<li>Currency exchange rate fluctuations</li>
<li>Shipping cost increases</li>
<li>Customs or import-related charges</li>
</ul>
<p>If any major pricing issue occurs before final confirmation, ${n} will contact the customer before proceeding.</p>
<h2>5. Cancellation Policy</h2>
<p>Since pre-order items are specially arranged upon customer request, confirmed orders usually cannot be cancelled once sourcing or shipping has started.</p>
<p>Cancellation requests may only be considered if:</p>
<ul>
<li>The product becomes unavailable from the supplier</li>
<li>${n} cannot arrange the item</li>
<li>An exceptional case is approved by our support team</li>
</ul>
<h2>6. Refund Policy for Pre-Orders</h2>
<p>Refunds for confirmed pre-orders are generally not applicable except in the following cases:</p>
<ul>
<li>${n} is unable to source the product</li>
<li>The item becomes permanently unavailable</li>
<li>The order cannot be fulfilled due to unavoidable circumstances approved by ${n}</li>
</ul>
<p>For approved cases, refunds will be processed through the original payment method within 7–10 working days.</p>
<h2>7. Delivery with Ready Stock Items</h2>
<p>If an order contains both ready stock products and pre-order items, ${n} may:</p>
<ul>
<li>Ship all products together after the pre-order item arrives, or</li>
<li>Ship separately depending on product type, shipping arrangement, or customer request</li>
</ul>
<p>Additional delivery charges may apply for split shipments.</p>
<h2>8. Product Availability</h2>
<p>All pre-order products are subject to supplier availability. Placing a pre-order does not always guarantee final availability.</p>
<p>If a product becomes unavailable after an order is placed, ${n} may offer:</p>
<ul>
<li>Refund</li>
<li>Store credit</li>
<li>Alternative product suggestions</li>
</ul>
<h2>9. Delays and Liability</h2>
<p>${n} is not responsible for delays caused by:</p>
<ul>
<li>International shipping problems</li>
<li>Customs delays</li>
<li>Courier service disruptions</li>
<li>Supplier stock shortages</li>
<li>Natural disasters or unexpected events</li>
</ul>
<p>However, we always aim to keep customers informed and provide support throughout the pre-order process.</p>
<h2>10. Order Updates</h2>
<p>Customers may contact ${n} for updates regarding their pre-order status.</p>
<p>While we aim to provide timely communication, exact arrival dates for international pre-order items cannot always be guaranteed.</p>
<h2>Contact Us</h2>
<p>For any questions regarding pre-orders, feel free to contact ${n} through our official Facebook page, Instagram, or <a href="/contact">customer support channels</a>.</p>
<p><em>Last updated: ${new Date().getFullYear()}</em></p>`;
}

function defaultContentForSlug(slug, siteName) {
  if (slug === 'privacy') return defaultPrivacyHtml(siteName);
  if (slug === 'terms') return defaultTermsHtml(siteName);
  if (slug === 'return') return defaultReturnHtml(siteName);
  if (slug === 'preorder') return defaultPreorderHtml(siteName);
  return '';
}

function getLegalPageDef(slug) {
  return LEGAL_PAGE_DEFS[slug] || null;
}

function getLegalPageFromSettings(slug, settings = {}) {
  const def = getLegalPageDef(slug);
  if (!def) return null;
  const siteName = settings.site_name || 'RakuShopBD';
  const title =
    String(settings[def.settingsTitle] || '').trim() || def.defaultTitle;
  const content =
    String(settings[def.settingsContent] || '').trim() ||
    defaultContentForSlug(slug, siteName);
  return {
    slug: def.slug,
    path: def.path,
    title,
    subtitle: def.defaultSubtitle,
    content,
    seoDescription: def.seoDescription,
  };
}

function getAllLegalPages(settings = {}) {
  return LEGAL_SLUGS.map((slug) => getLegalPageFromSettings(slug, settings)).filter(Boolean);
}

function legalDefaults(siteName) {
  const n = siteName || 'RakuShopBD';
  return [
    ['legal_privacy_title', 'Privacy Policy'],
    ['legal_privacy_content', defaultPrivacyHtml(n)],
    ['legal_terms_title', 'Terms & Conditions'],
    ['legal_terms_content', defaultTermsHtml(n)],
    ['legal_return_title', 'Return Policy'],
    ['legal_return_content', defaultReturnHtml(n)],
    ['legal_preorder_title', 'Pre-Order Policy'],
    ['legal_preorder_content', defaultPreorderHtml(n)],
  ];
}

module.exports = {
  LEGAL_SLUGS,
  LEGAL_PAGE_DEFS,
  getLegalPageDef,
  getLegalPageFromSettings,
  getAllLegalPages,
  legalDefaults,
  defaultContentForSlug,
};
