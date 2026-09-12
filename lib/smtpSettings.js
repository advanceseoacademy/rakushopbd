const SMTP_DEFAULTS = {
  notify_email: '',
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
};

/** Keys that must never appear on public/storefront API responses. */
const PUBLIC_SECRET_SETTING_KEYS = [
  'smtp_pass',
  'smtp_pass_set',
  'smtp_user',
  'smtp_host',
  'smtp_port',
  'smtp_from',
  'notify_email',
];

function getSmtpConfig(settings = {}) {
  const user = String(settings.smtp_user || process.env.SMTP_USER || '').trim();
  const pass = String(settings.smtp_pass || process.env.SMTP_PASS || '').trim();
  const host = String(settings.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(settings.smtp_port || process.env.SMTP_PORT || 587);
  const from = String(settings.smtp_from || process.env.SMTP_FROM || user).trim();
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from,
    configured: Boolean(user && pass),
  };
}

function smtpSettingDefaults() {
  return Object.entries(SMTP_DEFAULTS);
}

function sanitizeSmtpForAdminResponse(settings) {
  const out = { ...settings };
  const hasStoredPass = Boolean(String(out.smtp_pass ?? '').trim());
  const hasEnvPass = Boolean(String(process.env.SMTP_PASS ?? '').trim());
  out.smtp_pass_set = hasStoredPass || hasEnvPass || out.smtp_pass_set === '1' ? '1' : '0';
  delete out.smtp_pass;
  return out;
}

/** Strip SMTP / notify secrets from public settings payloads. */
function sanitizePublicSettings(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const out = { ...settings };
  for (const key of PUBLIC_SECRET_SETTING_KEYS) {
    delete out[key];
  }
  return out;
}

module.exports = {
  SMTP_DEFAULTS,
  PUBLIC_SECRET_SETTING_KEYS,
  getSmtpConfig,
  smtpSettingDefaults,
  sanitizeSmtpForAdminResponse,
  sanitizePublicSettings,
};
