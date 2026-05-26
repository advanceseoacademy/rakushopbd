-- RakuShopBD — cPanel phpMyAdmin এ একবার Run করুন
-- (admins table না থাকলে login "Login failed" / Database error দেখায়)

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password: BDRakuadmin2026%%
INSERT INTO admins (username, email, password_hash, full_name)
VALUES (
  'admin@rakushopbd.com',
  'admin@rakushopbd.com',
  '$2a$10$DKZ3zfFHSNJi4Hl3wcLj/.fBrL4GEwwjphPZQ/iaxGoKj3LUPwlk6',
  'Administrator'
)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name);
