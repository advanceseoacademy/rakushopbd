const { query, usePostgres } = require('../config/db');

let ensured = false;

async function ensureReviewVideosTable() {
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS product_review_videos (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL DEFAULT '',
        video_url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_note VARCHAR(500) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMPTZ NULL,
        UNIQUE (user_id, order_id, product_id)
      )`
    : `CREATE TABLE IF NOT EXISTS product_review_videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL DEFAULT '',
        video_url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_note VARCHAR(500) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        UNIQUE KEY uq_review_video (user_id, order_id, product_id)
      )`;
  await query(sql);
}

async function ensureReviewVideos() {
  if (ensured) return;
  await ensureReviewVideosTable();
  ensured = true;
}

module.exports = { ensureReviewVideos };
