const { query } = require('../config/db');
const { usePostgres } = require('../config/db');

let ensured = false;

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_DUP_FIELDNAME' || code === '42701' || /duplicate column/i.test(String(err?.message));
}

function isDuplicateTableError(err) {
  const code = err?.code || err?.errno;
  return code === 'ER_TABLE_EXISTS_ERROR' || code === '42P07' || /already exists/i.test(String(err?.message));
}

async function ensureUserRewardColumns() {
  const pg = usePostgres();
  const cols = [
    ['referral_code', pg ? 'VARCHAR(32) DEFAULT NULL' : 'VARCHAR(32) DEFAULT NULL'],
    ['referred_by_user_id', pg ? 'INT DEFAULT NULL' : 'INT UNSIGNED DEFAULT NULL'],
  ];
  for (const [name, def] of cols) {
    try {
      await query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
  }
}

async function ensureReviewImageColumn() {
  const pg = usePostgres();
  const def = pg ? 'VARCHAR(500) DEFAULT NULL' : 'VARCHAR(500) DEFAULT NULL';
  try {
    await query(`ALTER TABLE product_reviews ADD COLUMN image_url ${def}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
}

async function ensureRewardPointEventsTable() {
  const pg = usePostgres();
  if (pg) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS reward_point_events (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          event_type VARCHAR(40) NOT NULL,
          points INT NOT NULL,
          reference_key VARCHAR(80) NOT NULL DEFAULT 'once',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (user_id, event_type, reference_key)
        )`);
    } catch (err) {
      if (!isDuplicateTableError(err)) throw err;
    }
    return;
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS reward_point_events (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        event_type VARCHAR(40) NOT NULL,
        points INT NOT NULL,
        reference_key VARCHAR(80) NOT NULL DEFAULT 'once',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_reward_event (user_id, event_type, reference_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  } catch (err) {
    if (!isDuplicateTableError(err)) throw err;
  }
}

async function ensureRewardPointEvents() {
  if (ensured) return true;
  await ensureUserRewardColumns();
  await ensureReviewImageColumn();
  await ensureRewardPointEventsTable();
  ensured = true;
  return true;
}

module.exports = { ensureRewardPointEvents };
