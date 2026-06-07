/**
 * Seed default Messenger chat review screenshots.
 * Run: node scripts/seed-messenger-chats.js
 */
require('dotenv').config();
const { query } = require('../config/db');
const { ensureMessengerChats } = require('../lib/ensureMessengerChats');
const { clearStoreBootstrapCache } = require('../lib/storeBootstrap');
const { clearSiteSettingsCache } = require('../lib/siteSettings');
const { upsertSiteSettingSql } = require('../lib/db-dialect');

const SEED_CHATS = [
  {
    customer_name: 'Ummay Habiba',
    caption: 'Products peyechi Alhamdulillah — original Japanese skincare',
    image_url: '/uploads/messenger/chat-ummay-habiba.png',
    sort_order: 1,
  },
  {
    customer_name: 'Airin Pervin',
    caption: 'Face glow & bright — happy with recommended creams',
    image_url: '/uploads/messenger/chat-airin-pervin.png',
    sort_order: 2,
  },
  {
    customer_name: 'Zunaira Amina',
    caption: 'Products are amazing and authentic',
    image_url: '/uploads/messenger/chat-zunaira-amina.png',
    sort_order: 3,
  },
  {
    customer_name: 'Tasfiya Jahan',
    caption: 'Repeat customer — Skin Aqua sunscreen order',
    image_url: '/uploads/messenger/chat-tasfiya-jahan.png',
    sort_order: 4,
  },
  {
    customer_name: 'Aaban Afaf',
    caption: 'Recommended moisturizer is just amazing',
    image_url: '/uploads/messenger/chat-aaban-afaf.png',
    sort_order: 5,
  },
  {
    customer_name: 'Israt Zahan Sonia',
    caption: 'Product gula authentic — thanks for the gift',
    image_url: '/uploads/messenger/chat-israt-zahan.png',
    sort_order: 6,
  },
];

async function main() {
  await ensureMessengerChats();

  await query(upsertSiteSettingSql(), ['messenger_chats_enabled', '1']);
  clearSiteSettingsCache();

  const existing = await query('SELECT image_url FROM messenger_chats');
  const urls = new Set((existing || []).map((r) => r.image_url));

  let added = 0;
  for (const chat of SEED_CHATS) {
    if (urls.has(chat.image_url)) continue;
    await query(
      `INSERT INTO messenger_chats (customer_name, caption, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [chat.customer_name, chat.caption, chat.image_url, chat.sort_order, true]
    );
    added += 1;
  }

  clearStoreBootstrapCache();
  console.log(`Messenger chats seed done. Added ${added} new screenshot(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
