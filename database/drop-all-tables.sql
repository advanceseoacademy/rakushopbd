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
