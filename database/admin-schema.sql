-- Admin panel schema (run after schema.sql + auth-schema.sql)

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT 'Admin',
  role VARCHAR(32) NOT NULL DEFAULT 'super_admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_type ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10,2) NOT NULL,
  min_order DECIMAL(12,2) NOT NULL DEFAULT 0,
  usage_limit INT UNSIGNED DEFAULT NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('site_name', 'RakuShopBD'),
('site_tagline', 'Best products, best prices!'),
('contact_email', 'support@rakushopbd.com'),
('contact_phone', '+880 1339-411587'),
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
('trust_4_sub', 'We are here to help anytime');

INSERT IGNORE INTO coupons (code, discount_type, discount_value, min_order, usage_limit, expires_at, is_active) VALUES
('RakuShopBD10', 'percent', 10, 1000, 500, '2026-12-31', 1);
