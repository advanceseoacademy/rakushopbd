-- Reset admin password in phpMyAdmin (run once).
-- Login: admin  OR  admin@rakushopbd.com
-- Password: Admin@2026!

UPDATE admins
SET password_hash = '$2a$10$SbpBEcth6aOWiA1U99UkH.qzZzNC5boUhTFducs5wK.2/BJModpxi'
WHERE username = 'admin' OR email = 'admin@rakushopbd.com';
