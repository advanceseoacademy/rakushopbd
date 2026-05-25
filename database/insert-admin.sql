-- Run once in phpMyAdmin when `admins` table is empty.
-- Better: on server run  npm run admin:sync  (uses .env ADMIN_*)
-- Or login after insert: admin@rakushopbd.com / RakuAdmin2026!

INSERT INTO admins (username, email, password_hash, full_name)
SELECT 'admin', 'admin@rakushopbd.com',
  '$2a$10$bhXSkjvGk2f4zYJES4zTMuWH1ldcdvszCbZa80RD0E63CZb1iGKy.',
  'Administrator'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admins LIMIT 1);
