-- Optional: import if MySQL session store does not auto-create the table (cPanel).
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
