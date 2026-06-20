-- ═══════════════════════════════════════════════════════════
-- RakuShopBD — FULL DATABASE (single import file)
-- cPanel → phpMyAdmin → select database → Import → this file
--
-- Admin login after import:
--   Username: admin@rakushopbd.com
--   Password: BDRakuadmin2026%%
--
-- Generated: 2026-05-26
-- ═══════════════════════════════════════════════════════════


-- ─── Drop existing tables (drop-all-tables.sql) ───

-- RakuShopBD — সব টেবিল মুছে ফেলুন (phpMyAdmin → SQL)
-- তারপর: cPanel Terminal → npm run db:setup

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_reviews;
DROP TABLE IF EXISTS user_addresses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS sessions;

SET FOREIGN_KEY_CHECKS = 1;


-- ─── Core schema (schema.sql) ───

-- RakuShopBD MySQL Schema
-- cPanel → phpMyAdmin → Import করুন

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name_bn VARCHAR(100) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'ti-category',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name_bn VARCHAR(255) NOT NULL,
  description_bn TEXT,
  price DECIMAL(12,2) NOT NULL,
  old_price DECIMAL(12,2) DEFAULT NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  icon VARCHAR(80) NOT NULL DEFAULT 'ti-package',
  icon_color VARCHAR(20) NOT NULL DEFAULT '#2d8a2d',
  bg_color VARCHAR(20) NOT NULL DEFAULT '#e8f5e8',
  tag_type ENUM('none','discount','bestseller','hot','new') NOT NULL DEFAULT 'none',
  tag_text VARCHAR(50) DEFAULT NULL,
  discount_percent INT UNSIGNED DEFAULT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 100,
  is_featured TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(120) DEFAULT NULL,
  address_line TEXT NOT NULL,
  district VARCHAR(80) NOT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  payment_method VARCHAR(30) NOT NULL,
  payment_details JSON DEFAULT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  notes TEXT,
  status ENUM('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;


-- ─── Sample categories & products (seed.sql) ───

-- Sample products (English)
INSERT INTO categories (slug, name_bn, icon, sort_order) VALUES
('electronics', 'Electronics', 'ti-device-mobile', 1),
('fashion', 'Fashion', 'ti-shirt', 2),
('beauty', 'Beauty', 'ti-heart', 3),
('home', 'Home & Living', 'ti-home-2', 4),
('sports', 'Sports', 'ti-ball-football', 5),
('books', 'Books & Education', 'ti-book', 6),
('kids', 'Kids', 'ti-baby-carriage', 7),
('auto', 'Automotive', 'ti-car', 8)
ON DUPLICATE KEY UPDATE name_bn = VALUES(name_bn);

INSERT INTO products (category_id, slug, name_bn, price, old_price, rating, review_count, icon, icon_color, bg_color, tag_type, tag_text, discount_percent) VALUES
((SELECT id FROM categories WHERE slug='electronics'), 'smartwatch-pro', 'Smartwatch Pro — Health Tracker, GPS', 3999, 5999, 4.8, 1243, 'ti-watch', '#993556', '#FBEAF0', 'discount', NULL, 33),
((SELECT id FROM categories WHERE slug='electronics'), 'wireless-headphones', 'Wireless Headphones — ANC, 40hr Battery', 1299, 2499, 4.7, 892, 'ti-headphones', '#2d8a2d', '#e8f5e8', 'bestseller', 'Best Seller', NULL),
((SELECT id FROM categories WHERE slug='electronics'), 'bluetooth-speaker', 'Bluetooth Speaker — IPX7, 360° Sound', 899, 1400, 4.6, 567, 'ti-speakerphone', '#3B6D11', '#EAF3DE', 'hot', 'Hot', NULL),
((SELECT id FROM categories WHERE slug='electronics'), 'gaming-laptop', 'Gaming Laptop — RTX 4060, 16GB RAM', 89999, 115000, 4.9, 234, 'ti-device-laptop', '#854F0B', '#FAEEDA', 'discount', NULL, 22),
((SELECT id FROM categories WHERE slug='fashion'), 'cotton-kurta', 'Premium Cotton Kurta', 899, 1500, 4.5, 678, 'ti-shirt', '#993556', '#FBEAF0', 'discount', NULL, 40),
((SELECT id FROM categories WHERE slug='fashion'), 'sports-sneaker', 'Sports Sneakers — Comfort Sole', 2499, 4200, 4.8, 1120, 'ti-shoe', '#3B6D11', '#EAF3DE', 'bestseller', 'Best Seller', NULL),
((SELECT id FROM categories WHERE slug='fashion'), 'denim-jacket', 'Denim Jacket — Unisex', 1599, 2800, 4.4, 445, 'ti-jacket', '#2d8a2d', '#e8f5e8', 'new', 'New', NULL),
((SELECT id FROM categories WHERE slug='fashion'), 'silk-saree', 'Pure Silk Saree — Handloom', 4999, 8500, 4.9, 321, 'ti-ribbon-health', '#854F0B', '#FAEEDA', 'discount', NULL, 41),
((SELECT id FROM categories WHERE slug='beauty'), 'vitamin-c-serum', 'Vitamin C Serum — Glow Skin', 599, 950, 4.7, 1567, 'ti-droplet', '#993556', '#FBEAF0', 'hot', 'Hot', NULL),
((SELECT id FROM categories WHERE slug='beauty'), 'hair-oil', 'Herbal Hair Oil — 200ml', 349, 500, 4.6, 2341, 'ti-bottle', '#3B6D11', '#EAF3DE', 'bestseller', 'Best Seller', NULL),
((SELECT id FROM categories WHERE slug='beauty'), 'face-wash', 'Natural Face Wash — Sensitive Skin', 299, 450, 4.5, 876, 'ti-wash', '#2d8a2d', '#e8f5e8', 'discount', NULL, 33),
((SELECT id FROM categories WHERE slug='home'), 'air-fryer', 'Digital Air Fryer — 5.5L', 3499, 5500, 4.8, 654, 'ti-grill', '#854F0B', '#FAEEDA', 'discount', NULL, 36),
((SELECT id FROM categories WHERE slug='home'), 'bed-sheet-set', 'King Size Bed Sheet Set — Cotton', 1299, 2000, 4.4, 432, 'ti-bed', '#993556', '#FBEAF0', 'new', 'New', NULL),
((SELECT id FROM categories WHERE slug='home'), 'led-bulb-pack', 'LED Bulb Pack — 9W, 10 pcs', 499, 800, 4.3, 289, 'ti-bulb', '#3B6D11', '#EAF3DE', 'discount', NULL, 38),
((SELECT id FROM categories WHERE slug='sports'), 'dumbbell-set', 'Adjustable Dumbbell Set 20kg', 3499, 5400, 4.9, 578, 'ti-barbell', '#3B6D11', '#EAF3DE', 'bestseller', 'Best Seller', NULL),
((SELECT id FROM categories WHERE slug='sports'), 'cycle-helmet', 'Cycle Helmet — Shockproof, Ventilated', 899, 1200, 4.5, 225, 'ti-bike', '#993556', '#FBEAF0', 'discount', NULL, 25),
((SELECT id FROM categories WHERE slug='sports'), 'yoga-mat', 'Yoga Mat — Non-slip, 6mm', 599, 800, 4.8, 934, 'ti-swimming', '#854F0B', '#FAEEDA', 'hot', 'Hot', NULL),
((SELECT id FROM categories WHERE slug='books'), 'hsc-physics', 'HSC Physics Guide — Complete', 280, 400, 4.9, 876, 'ti-book', '#3B6D11', '#EAF3DE', 'discount', NULL, 30),
((SELECT id FROM categories WHERE slug='books'), 'ielts-package', 'IELTS Complete Study Package', 899, 1300, 4.9, 1453, 'ti-books', '#2d8a2d', '#e8f5e8', 'bestseller', 'Best Seller', NULL),
((SELECT id FROM categories WHERE slug='kids'), 'puzzle-set', 'Educational Puzzle Set — Ages 3–8', 549, 885, 4.8, 432, 'ti-puzzle', '#2d8a2d', '#e8f5e8', 'discount', NULL, 38),
((SELECT id FROM categories WHERE slug='kids'), 'baby-stroller', 'Baby Stroller — Foldable, Lightweight', 8999, 13500, 4.9, 654, 'ti-baby-carriage', '#993556', '#FBEAF0', 'bestseller', 'Best Seller', NULL),
((SELECT id FROM categories WHERE slug='auto'), 'car-phone-holder', 'Car Phone Holder — Magnetic', 399, 650, 4.4, 312, 'ti-steering-wheel', '#2d8a2d', '#e8f5e8', 'discount', NULL, 39),
((SELECT id FROM categories WHERE slug='auto'), 'car-vacuum', 'Car Vacuum Cleaner — Cordless', 1299, 1999, 4.6, 198, 'ti-vacuum-cleaner', '#3B6D11', '#EAF3DE', 'new', 'New', NULL);


-- ─── Users & orders link (auth-schema.sql) ───

-- User accounts schema (run after main schema.sql)

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_addresses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  label VARCHAR(50) NOT NULL DEFAULT 'Home',
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  district VARCHAR(80) NOT NULL,
  thana VARCHAR(80) DEFAULT NULL,
  address_line TEXT NOT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link orders to logged-in users
ALTER TABLE orders ADD COLUMN user_id INT UNSIGNED NULL AFTER id;


-- ─── Admin, settings, coupons (admin-schema.sql) ───

-- Admin panel schema (run after schema.sql + auth-schema.sql)

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT 'Admin',
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


-- ─── Reviews, banners, product columns (admin-extended.sql) ───

-- Extended admin features (run after admin-schema.sql)

ALTER TABLE products
  ADD COLUMN sku VARCHAR(80) DEFAULT NULL AFTER slug,
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER bg_color;

CREATE TABLE IF NOT EXISTS product_reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  customer_name VARCHAR(120) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
  comment TEXT,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  position VARCHAR(40) NOT NULL DEFAULT 'hero',
  link_url VARCHAR(255) DEFAULT '/',
  image_url VARCHAR(500) DEFAULT NULL,
  bg_gradient VARCHAR(120) DEFAULT 'linear-gradient(135deg,#2d8a2d,#164816)',
  expires_at DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('feature_review_approval', '1'),
('feature_sms_notify', '0'),
('feature_email_notify', '1'),
('feature_flash_sale', '1');

INSERT IGNORE INTO banners (title, position, link_url, bg_gradient, is_active, sort_order) VALUES
('Summer Sale', 'hero', '/', 'linear-gradient(135deg,#2d8a2d,#164816)', 1, 1),
('Free Delivery', 'promo', '/category/electronics', 'linear-gradient(135deg,#1D9E75,#0F6E56)', 1, 2),
('Flash Sale', 'promo', '/', 'linear-gradient(135deg,#d48696,#9e5568)', 1, 3),
('Authentic Products', 'promo', '/', 'linear-gradient(135deg,#1D9E75,#0F6E56)', 1, 4);

INSERT IGNORE INTO product_reviews (product_id, customer_name, rating, comment, status) VALUES
(1, 'Rafi Ahmed', 5, 'Excellent product! Battery lasts 10–12 days. Great value.', 'approved'),
(1, 'Nafisa Islam', 5, 'Delivery was very fast. Watch looks great and is lightweight.', 'approved'),
(2, 'Karim Hossain', 4, 'Good sound quality for the price.', 'approved');

-- ─── Admin account ───
INSERT INTO admins (username, email, password_hash, full_name)
VALUES (
  'admin@rakushopbd.com',
  'admin@rakushopbd.com',
  '$2a$10$OPZFMYYwEvenqfaasaYEdOGjHLSxpwWH5KBkoBX1s7hQWCePJAnIy',
  'Administrator'
);


-- ─── insert-site-settings.sql ───

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
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
('maintenance_message', 'We are upgrading our store for a better shopping experience. Please visit again shortly.'),
('maintenance_announcement', '');


-- ─── sessions-table.sql ───

-- Optional: import if MySQL session store does not auto-create the table (cPanel).
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─── update-brand-colors.sql ───

-- RakushopBD brand colors (logo: green #206020 + pink #d48696)
UPDATE products SET icon_color = '#2d8a2d', bg_color = '#e8f5e8'
WHERE icon_color IN ('#185FA5', '#0C447C') OR bg_color IN ('#E6F1FB', '#dbeafe');

UPDATE products SET icon_color = '#d48696', bg_color = '#fdf0f3'
WHERE icon_color IN ('#993556', '#E24B4A', '#A32D2D');

UPDATE products SET icon_color = '#2d8a2d', bg_color = '#e8f5e8'
WHERE icon_color = '#3B6D11' OR bg_color = '#EAF3DE';

UPDATE products SET icon_color = '#8a6914', bg_color = '#faf3e0'
WHERE icon_color = '#854F0B' OR bg_color IN ('#FAEEDA', '#fef3c7');

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#2d8a2d,#164816)'
WHERE bg_gradient LIKE '%185FA5%' OR bg_gradient LIKE '%0C447C%';

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#d48696,#9e5568)'
WHERE bg_gradient LIKE '%E24B4A%' OR bg_gradient LIKE '%A32D2D%';

-- Done
