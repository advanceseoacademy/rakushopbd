const { query, usePostgres } = require('../config/db');

let ensured = false;

async function ensureProductImagesTable() {
  if (ensured) return true;
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        image_url VARCHAR(500) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`
    : `CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        KEY idx_product_images_product (product_id),
        CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`;
  await query(sql);
  ensured = true;
  return true;
}

module.exports = { ensureProductImagesTable };
