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
