const { query, usePostgres } = require('../config/db');

let ensured = false;
let ensurePromise = null;

async function ensureBlogPostsTable() {
  if (ensured) return true;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const pg = usePostgres();
    const sql = pg
      ? `CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(160) NOT NULL UNIQUE,
        excerpt TEXT,
        content TEXT NOT NULL,
        featured_image_url VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
      : `CREATE TABLE IF NOT EXISTS blog_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(160) NOT NULL UNIQUE,
        excerpt TEXT,
        content MEDIUMTEXT NOT NULL,
        featured_image_url VARCHAR(500) DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        published_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`;
    await query(sql);
    ensured = true;
    return true;
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}

module.exports = { ensureBlogPostsTable };
