/** Storefront visitor activity log (page views + shopping actions) for the admin "Visitor Activity" page. */
const crypto = require('crypto');
const { query, usePostgres } = require('../config/db');

const RETENTION_DAYS = 90;
const BOT_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|lighthouse|headless|pagespeed|preview|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|monitor|uptime/i;

const CLIENT_EVENTS = new Set(['page_view', 'search', 'begin_checkout']);

let ensurePromise = null;
let pruneTimer = null;

function clip(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

async function createTable() {
  const pg = usePostgres();
  if (pg) {
    await query(`CREATE TABLE IF NOT EXISTS visitor_events (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(40) NOT NULL,
      user_id INT NULL,
      event VARCHAR(40) NOT NULL,
      path VARCHAR(500),
      label VARCHAR(300),
      product_id INT NULL,
      meta TEXT,
      referrer VARCHAR(500),
      ip VARCHAR(64),
      user_agent VARCHAR(400),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_visitor_events_vid_time ON visitor_events (visitor_id, created_at)');
    await query('CREATE INDEX IF NOT EXISTS idx_visitor_events_time ON visitor_events (created_at)');
  } else {
    await query(`CREATE TABLE IF NOT EXISTS visitor_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      visitor_id VARCHAR(40) NOT NULL,
      user_id INT NULL,
      event VARCHAR(40) NOT NULL,
      path VARCHAR(500) NULL,
      label VARCHAR(300) NULL,
      product_id INT NULL,
      meta TEXT NULL,
      referrer VARCHAR(500) NULL,
      ip VARCHAR(64) NULL,
      user_agent VARCHAR(400) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_visitor_events_vid_time (visitor_id, created_at),
      INDEX idx_visitor_events_time (created_at)
    )`);
  }
}

async function pruneOldEvents() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await query('DELETE FROM visitor_events WHERE created_at < ?', [cutoff]);
}

function ensureVisitorEventsTable() {
  if (!ensurePromise) {
    ensurePromise = createTable()
      .then(() => {
        pruneOldEvents().catch(() => {});
        if (!pruneTimer) {
          pruneTimer = setInterval(() => pruneOldEvents().catch(() => {}), 6 * 60 * 60 * 1000);
          pruneTimer.unref?.();
        }
      })
      .catch((err) => {
        ensurePromise = null;
        throw err;
      });
  }
  return ensurePromise;
}

function isBotRequest(req) {
  const ua = String(req.get?.('user-agent') || '');
  return !ua || BOT_UA_RE.test(ua);
}

function getVisitorId(req) {
  if (!req.session) return null;
  if (!req.session.vid || typeof req.session.vid !== 'string') {
    req.session.vid = crypto.randomBytes(8).toString('hex');
  }
  return req.session.vid;
}

function requestPath(req) {
  const ref = String(req.get?.('referer') || '');
  try {
    const u = new URL(ref);
    return u.pathname + u.search;
  } catch (_) {
    return null;
  }
}

/** Fire-and-forget: never throws, never delays the response. */
function logVisitorEvent(req, event, data = {}) {
  try {
    if (!req || isBotRequest(req)) return;
    const visitorId = getVisitorId(req);
    if (!visitorId) return;
    const userId = Number(req.session?.userId) || null;
    const meta = data.meta && typeof data.meta === 'object' ? JSON.stringify(data.meta).slice(0, 2000) : null;
    const row = [
      visitorId,
      userId,
      clip(event, 40),
      clip(data.path ?? requestPath(req), 500),
      clip(data.label, 300),
      Number(data.productId) || null,
      meta,
      clip(data.referrer, 500),
      clip(req.ip, 64),
      clip(req.get('user-agent'), 400),
      new Date(),
    ];
    ensureVisitorEventsTable()
      .then(() =>
        query(
          `INSERT INTO visitor_events (visitor_id, user_id, event, path, label, product_id, meta, referrer, ip, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row
        )
      )
      .catch((err) => console.warn('visitor event log failed:', err.message));
  } catch (err) {
    console.warn('visitor event log failed:', err.message);
  }
}

function sameSiteReferrer(ref, req) {
  try {
    const u = new URL(ref);
    const host = String(req.get('host') || '').replace(/^www\./, '');
    return u.host.replace(/^www\./, '') === host;
  } catch (_) {
    return true;
  }
}

/** Handle POST /api/track from the storefront tracker script. */
function handleClientTrack(req, res) {
  res.set('Cache-Control', 'no-store');
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 10) : [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const name = String(e.event || '');
    if (!CLIENT_EVENTS.has(name)) continue;
    const path = clip(e.path, 500);
    if (name === 'page_view' && (!path || !path.startsWith('/'))) continue;
    const referrer = e.referrer && !sameSiteReferrer(e.referrer, req) ? e.referrer : null;
    logVisitorEvent(req, name, {
      path,
      label: e.label,
      productId: e.productId,
      referrer,
      meta: e.meta && typeof e.meta === 'object' ? e.meta : null,
    });
  }
  res.json({ ok: true });
}

module.exports = {
  RETENTION_DAYS,
  ensureVisitorEventsTable,
  logVisitorEvent,
  handleClientTrack,
};
