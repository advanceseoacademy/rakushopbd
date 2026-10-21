const { query, usePostgres } = require('../config/db');
const { upsertSiteSettingSql } = require('./db-dialect');
const { clearSiteSettingsCache } = require('./siteSettings');

const SETTINGS = [
  ['homepage_videos_enabled', '1'],
  ['homepage_videos_title', 'Customer Videos'],
  [
    'homepage_videos_subtitle',
    'Watch real customer stories and product demos from RakuShopBD',
  ],
  /** Auto-scroll interval in milliseconds (admin UI edits seconds). */
  ['homepage_videos_scroll_interval', '4500'],
];

function homepageVideosScrollIntervalMs(settings) {
  const raw = Number(
    settings?.homepage_videos_scroll_interval ?? settings?.homepageVideosScrollInterval
  );
  if (!Number.isFinite(raw)) return 4500;
  // Allow 2s–20s
  return Math.max(2000, Math.min(20000, Math.round(raw)));
}

const SEED_VIDEO = {
  title: 'Customer story',
  youtubeUrl: 'https://youtu.be/HVmd87CqtR4',
  youtubeId: 'HVmd87CqtR4',
  sortOrder: 0,
};

let ensured = false;

function parseYoutubeId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const raw = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const markers = new Set(['embed', 'shorts', 'live', 'v']);
      for (let i = 0; i < parts.length - 1; i += 1) {
        if (markers.has(parts[i]) && /^[a-zA-Z0-9_-]{11}$/.test(parts[i + 1])) {
          return parts[i + 1];
        }
      }
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function normalizeYoutubeUrl(id) {
  return `https://youtu.be/${id}`;
}

async function ensureHomepageVideosTable() {
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS homepage_videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(160) NOT NULL DEFAULT '',
        youtube_url TEXT NOT NULL,
        youtube_id VARCHAR(16) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS homepage_videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(160) NOT NULL DEFAULT '',
        youtube_url TEXT NOT NULL,
        youtube_id VARCHAR(16) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);
  try {
    await query(
      pg
        ? 'CREATE INDEX IF NOT EXISTS idx_homepage_videos_active_sort ON homepage_videos (is_active, sort_order)'
        : 'CREATE INDEX idx_homepage_videos_active_sort ON homepage_videos (is_active, sort_order)'
    );
  } catch (_) {
    /* index may already exist on MySQL */
  }
}

async function seedDefaultVideo() {
  const rows = await query('SELECT id FROM homepage_videos LIMIT 1').catch(() => []);
  if (rows.length) return;
  await query(
    `INSERT INTO homepage_videos (title, youtube_url, youtube_id, sort_order, is_active)
     VALUES (?,?,?,?,?)`,
    [SEED_VIDEO.title, SEED_VIDEO.youtubeUrl, SEED_VIDEO.youtubeId, SEED_VIDEO.sortOrder, true]
  );
}

async function ensureHomepageVideosSettings() {
  let added = false;
  for (const [key, value] of SETTINGS) {
    const rows = await query(
      'SELECT setting_key FROM site_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    if (!rows.length) {
      await query(upsertSiteSettingSql(), [key, value]);
      added = true;
    }
  }
  if (added) clearSiteSettingsCache();
}

async function ensureHomepageVideos() {
  await ensureHomepageVideosTable();
  await ensureHomepageVideosSettings();
  if (ensured) return;
  await seedDefaultVideo();
  clearSiteSettingsCache();
  ensured = true;
}

async function listActiveHomepageVideos() {
  await ensureHomepageVideos();
  const activeFilter = usePostgres() ? 'is_active IS TRUE' : 'is_active = 1';
  return query(
    `SELECT id, title, youtube_url, youtube_id, sort_order
     FROM homepage_videos
     WHERE ${activeFilter}
     ORDER BY sort_order ASC, id DESC`
  ).catch(() => []);
}

module.exports = {
  ensureHomepageVideos,
  listActiveHomepageVideos,
  parseYoutubeId,
  normalizeYoutubeUrl,
  homepageVideosScrollIntervalMs,
};
