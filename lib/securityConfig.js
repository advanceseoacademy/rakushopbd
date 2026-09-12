function cookiesShouldBeSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function resolveSessionSecret() {
  const fromEnv = String(process.env.SESSION_SECRET || '').trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: SESSION_SECRET is required when NODE_ENV=production');
    process.exit(1);
  }
  return 'rakushopbd-dev-secret-change-me';
}

module.exports = {
  cookiesShouldBeSecure,
  resolveSessionSecret,
};
