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
