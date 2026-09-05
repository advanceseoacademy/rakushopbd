-- RakuShopBD Supabase — paste in SQL Editor → Run
-- PostgreSQL schema for Supabase (RakuShopBD)

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS user_addresses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS banners CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name_bn VARCHAR(100) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'ti-category',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug VARCHAR(120) NOT NULL UNIQUE,
  sku VARCHAR(80),
  name_bn VARCHAR(255) NOT NULL,
  description_bn TEXT,
  price DECIMAL(12,2) NOT NULL,
  old_price DECIMAL(12,2),
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  review_count INT NOT NULL DEFAULT 0,
  icon VARCHAR(80) NOT NULL DEFAULT 'ti-package',
  icon_color VARCHAR(20) NOT NULL DEFAULT '#2d8a2d',
  bg_color VARCHAR(20) NOT NULL DEFAULT '#e8f5e8',
  image_url VARCHAR(500),
  tag_type VARCHAR(20) NOT NULL DEFAULT 'none',
  tag_text VARCHAR(50),
  discount_percent INT,
  stock INT NOT NULL DEFAULT 100,
  is_featured SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_addresses (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL DEFAULT 'Home',
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  district VARCHAR(80) NOT NULL,
  thana VARCHAR(80),
  address_line TEXT NOT NULL,
  postal_code VARCHAR(20),
  is_default SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(120),
  address_line TEXT NOT NULL,
  district VARCHAR(80) NOT NULL,
  postal_code VARCHAR(20),
  payment_method VARCHAR(30) NOT NULL,
  payment_details JSONB,
  subtotal DECIMAL(12,2) NOT NULL,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  stock_committed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL
);

CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10,2) NOT NULL,
  min_order DECIMAL(12,2) NOT NULL DEFAULT 0,
  usage_limit INT,
  used_count INT NOT NULL DEFAULT 0,
  expires_at DATE,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(120) NOT NULL,
  rating SMALLINT NOT NULL DEFAULT 5,
  comment TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  position VARCHAR(40) NOT NULL DEFAULT 'hero',
  link_url VARCHAR(255) DEFAULT '/',
  image_url VARCHAR(500),
  bg_gradient VARCHAR(120) DEFAULT 'linear-gradient(135deg,#2d8a2d,#164816)',
  expires_at DATE,
  is_active SMALLINT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO categories (slug, name_bn, icon, sort_order) VALUES
('electronics', 'Electronics', 'ti-device-mobile', 1),
('fashion', 'Fashion', 'ti-shirt', 2),
('beauty', 'Beauty', 'ti-heart', 3),
('home', 'Home & Living', 'ti-home-2', 4),
('sports', 'Sports', 'ti-ball-football', 5),
('books', 'Books & Education', 'ti-book', 6),
('kids', 'Kids', 'ti-baby-carriage', 7),
('auto', 'Automotive', 'ti-car', 8)
ON CONFLICT (slug) DO UPDATE SET name_bn = EXCLUDED.name_bn;

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



INSERT INTO site_settings (setting_key, setting_value) VALUES
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



INSERT INTO product_reviews (product_id, customer_name, rating, comment, status)
SELECT id, 'Rafi Ahmed', 5, 'Excellent product! Battery lasts 10–12 days. Great value.', 'approved' FROM products WHERE slug='smartwatch-pro';
INSERT INTO product_reviews (product_id, customer_name, rating, comment, status)
SELECT id, 'Nafisa Islam', 5, 'Delivery was very fast. Watch looks great and is lightweight.', 'approved' FROM products WHERE slug='smartwatch-pro';
INSERT INTO product_reviews (product_id, customer_name, rating, comment, status)
SELECT id, 'Karim Hossain', 4, 'Good sound quality for the price.', 'approved' FROM products WHERE slug='wireless-headphones';


INSERT INTO admins (username, email, password_hash, full_name)
VALUES ('admin@rakushopbd.com', 'admin@rakushopbd.com', '$2a$10$EnrnoJJRDoX/lp0K8FXVheybNjElaEw6ZSonIfxwmfDen8BJsF4..', 'Administrator')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email;
