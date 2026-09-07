const { query, usePostgres } = require('../config/db');

let ensured = false;

function isIgnorable(err) {
  const code = err?.code || err?.errno;
  const msg = String(err?.message || '');
  return (
    code === 'ER_DUP_FIELDNAME' ||
    code === 'ER_TABLE_EXISTS_ERROR' ||
    code === '42P07' ||
    code === '42701' ||
    /duplicate|already exists/i.test(msg)
  );
}

async function ensureResellerTables() {
  if (ensured) return true;
  const pg = usePostgres();

  if (pg) {
    await query(`
      CREATE TABLE IF NOT EXISTS resellers (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        default_markup_percent NUMERIC(8,2) DEFAULT 20,
        wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
        apply_note TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS reseller_product_prices (
        id SERIAL PRIMARY KEY,
        reseller_id INT NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
        product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        selling_price NUMERIC(12,2) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (reseller_id, product_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS reseller_payouts (
        id SERIAL PRIMARY KEY,
        reseller_id INT NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        account_number VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'requested',
        requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMPTZ,
        admin_note TEXT
      )
    `);
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS resellers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        default_markup_percent DECIMAL(8,2) DEFAULT 20,
        wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        pending_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
        apply_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS reseller_product_prices (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        reseller_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,
        selling_price DECIMAL(12,2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reseller_product (reseller_id, product_id),
        FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS reseller_payouts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        reseller_id INT UNSIGNED NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        account_number VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'requested',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP NULL,
        admin_note TEXT,
        FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  const money = pg ? 'NUMERIC(12,2)' : 'DECIMAL(12,2) NULL';
  for (const sql of [
    `ALTER TABLE orders ADD COLUMN reseller_id ${pg ? 'INT' : 'INT UNSIGNED'} NULL`,
    `ALTER TABLE order_items ADD COLUMN base_price_snapshot ${money}`,
    `ALTER TABLE order_items ADD COLUMN reseller_price_snapshot ${money}`,
    `ALTER TABLE order_items ADD COLUMN reseller_profit_snapshot ${money}`,
  ]) {
    try {
      await query(sql);
    } catch (err) {
      if (!isIgnorable(err)) throw err;
    }
  }

  const settings = [
    ['reseller_min_payout', '500'],
    ['reseller_default_markup_suggest', '20'],
  ];
  for (const [key, value] of settings) {
    try {
      if (pg) {
        await query(
          `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
           ON CONFLICT (setting_key) DO NOTHING`,
          [key, value]
        );
      } else {
        await query(
          `INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)`,
          [key, value]
        );
      }
    } catch (_) {
      /* ignore */
    }
  }

  ensured = true;
  return true;
}

module.exports = { ensureResellerTables };
