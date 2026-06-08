const { query, usePostgres } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

const SETTINGS = [
  ['messenger_chats_enabled', '1'],
  ['messenger_chats_title', 'Our Customer Say'],
  [
    'messenger_chats_subtitle',
    'Real Facebook Messenger conversations with our happy customers',
  ],
];

let ensured = false;

async function ensureMessengerChatsTable() {
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS messenger_chats (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(120) NOT NULL DEFAULT '',
        caption VARCHAR(255) NOT NULL DEFAULT '',
        image_url TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS messenger_chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(120) NOT NULL DEFAULT '',
        caption VARCHAR(255) NOT NULL DEFAULT '',
        image_url TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);
}

async function ensureMessengerChats() {
  if (ensured) return;
  await ensureMessengerChatsTable();
  for (const [key, value] of SETTINGS) {
    const rows = await query(
      'SELECT setting_key, setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    if (!rows.length) {
      await query(upsertSiteSettingSql(), [key, value]);
      continue;
    }
    if (key === 'messenger_chats_title') {
      const current = String(rows[0].setting_value ?? rows[0].settingValue ?? '').trim();
      if (current === 'Messenger Customer Reviews') {
        await query(upsertSiteSettingSql(), [key, value]);
      }
    }
  }
  clearSiteSettingsCache();
  ensured = true;
}

async function listActiveMessengerChats() {
  await ensureMessengerChats();
  const activeFilter = usePostgres() ? 'is_active IS TRUE' : 'is_active = 1';
  return query(
    `SELECT id, customer_name, caption, image_url, sort_order
     FROM messenger_chats
     WHERE ${activeFilter}
     ORDER BY sort_order ASC, id DESC`
  ).catch(() => []);
}

module.exports = { ensureMessengerChats, listActiveMessengerChats };
