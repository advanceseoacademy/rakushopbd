/**
 * Build database/supabase-full.sql — run in Supabase SQL Editor
 * node scripts/build-supabase-sql.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const out = path.join(__dirname, '../database/supabase-full.sql');

async function main() {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'BDRakuadmin2026%%', 10);
  const seed = fs
    .readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8')
    .replace(/ON DUPLICATE KEY UPDATE name_bn = VALUES\(name_bn\)/g, 'ON CONFLICT (slug) DO UPDATE SET name_bn = EXCLUDED.name_bn');

  const settings = `
INSERT INTO site_settings (setting_key, setting_value) VALUES
('site_name', 'RakuShopBD'),
('site_tagline', 'Best products, best prices!'),
('contact_email', 'support@rakushopbd.com'),
('contact_phone', '+880 1700-000000'),
('payment_bkash', '01712-345678'),
('payment_nagad', '01712-345678'),
('payment_rocket', '01712-345678'),
('contact_address', 'Dhaka, Bangladesh'),
('announcement_text', 'Special offer: 10% off on orders over ৳1000 — Code: RakuShopBD10'),
('free_delivery_min', '500'),
('delivery_fee', '60'),
('delivery_fee_outside', '120'),
('maintenance_mode', '0'),
('feature_guest_checkout', '1'),
('feature_cod', '1'),
('feature_flash_sale', '1'),
('footer_desc', 'Bangladesh''s trusted online shopping platform. Huge selection, great prices, and fast delivery.'),
('store_hours', '9 AM — 10 PM'),
('trust_1_title', 'Free & fast delivery'),
('trust_1_sub', 'Nationwide on orders over ৳500'),
('trust_2_title', '100% authentic products'),
('trust_2_sub', 'Full refund on counterfeit items'),
('trust_3_title', 'Easy returns policy'),
('trust_3_sub', 'No-questions return within 7 days'),
('trust_4_title', '24/7 customer support'),
('trust_4_sub', 'We are here to help anytime'),
('feature_review_approval', '1'),
('feature_sms_notify', '0'),
('feature_email_notify', '1'),
('maintenance_message', 'We are upgrading our store for a better shopping experience.'),
('maintenance_announcement', '')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO coupons (code, discount_type, discount_value, min_order, usage_limit, expires_at, is_active) VALUES
('RakuShopBD10', 'percent', 10, 1000, 500, '2026-12-31', 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO banners (title, position, link_url, bg_gradient, is_active, sort_order) VALUES
('Summer Sale', 'hero', '/', 'linear-gradient(135deg,#2d8a2d,#164816)', 1, 1),
('Free Delivery', 'promo', '/category/electronics', 'linear-gradient(135deg,#1D9E75,#0F6E56)', 1, 2),
('Flash Sale', 'promo', '/', 'linear-gradient(135deg,#d48696,#9e5568)', 1, 3),
('Authentic Products', 'promo', '/', 'linear-gradient(135deg,#1D9E75,#0F6E56)', 1, 4);
`;

  const reviews = `
INSERT INTO product_reviews (product_id, customer_name, rating, comment, status)
SELECT id, 'Rafi Ahmed', 5, 'Excellent product! Battery lasts 10–12 days. Great value.', 'approved' FROM products WHERE slug='smartwatch-pro';
INSERT INTO product_reviews (product_id, customer_name, rating, comment, status)
SELECT id, 'Nafisa Islam', 5, 'Delivery was very fast. Watch looks great and is lightweight.', 'approved' FROM products WHERE slug='smartwatch-pro';
INSERT INTO product_reviews (product_id, customer_name, rating, comment, status)
SELECT id, 'Karim Hossain', 4, 'Good sound quality for the price.', 'approved' FROM products WHERE slug='wireless-headphones';
`;

  const schema = fs.readFileSync(path.join(__dirname, '../database/supabase-schema.sql'), 'utf8');

  const sql = `-- RakuShopBD Supabase — paste in SQL Editor → Run
${schema}

${seed}

${settings}

${reviews}

INSERT INTO admins (username, email, password_hash, full_name)
VALUES ('admin@rakushopbd.com', 'admin@rakushopbd.com', '${hash}', 'Administrator')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email;
`;

  fs.writeFileSync(out, sql, 'utf8');
  console.log('✅ Wrote', out);
}

main();
