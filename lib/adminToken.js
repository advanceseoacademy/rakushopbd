const crypto = require('crypto');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_COOKIE = 'rakushopbd_admin';

function getSecret() {
  return process.env.SESSION_SECRET || 'rakushopbd-dev-secret-change-me';
}

function signAdminToken(adminId) {
  const ts = Date.now();
  const payload = `${adminId}:${ts}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const lastColon = raw.lastIndexOf(':');
    if (lastColon < 0) return null;
    const sig = raw.slice(lastColon + 1);
    const body = raw.slice(0, lastColon);
    const secondColon = body.indexOf(':');
    if (secondColon < 0) return null;
    const id = Number(body.slice(0, secondColon));
    const ts = Number(body.slice(secondColon + 1));
    if (!id || !ts) return null;
    const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('hex');
    if (sig !== expected || Date.now() - ts > MAX_AGE_MS) return null;
    return id;
  } catch {
    return null;
  }
}

function tokenFromHeaders(req) {
  const custom = req.headers['x-admin-token'];
  if (custom && typeof custom === 'string') {
    const id = verifyAdminToken(custom.trim());
    if (id) return id;
  }
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return verifyAdminToken(auth.slice(7).trim());
  return null;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
}

function tokenFromCookie(req) {
  const raw = readCookie(req, ADMIN_COOKIE);
  if (!raw) return null;
  return verifyAdminToken(raw);
}

function getAdminIdFromRequest(req) {
  const fromHeader = tokenFromHeaders(req);
  if (fromHeader) return fromHeader;
  const fromCookie = tokenFromCookie(req);
  if (fromCookie) return fromCookie;
  if (req.session && req.session.adminId) return req.session.adminId;
  return null;
}

function setAdminAuthCookie(res, adminId) {
  const token = signAdminToken(adminId);
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_MS,
    secure: process.env.COOKIE_SECURE === 'true',
  });
  return token;
}

function clearAdminAuthCookie(res) {
  res.clearCookie(ADMIN_COOKIE, {
    path: '/',
    secure: process.env.COOKIE_SECURE === 'true',
  });
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  getAdminIdFromRequest,
  setAdminAuthCookie,
  clearAdminAuthCookie,
  ADMIN_COOKIE,
};
