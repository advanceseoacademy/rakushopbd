const SMTP_DEFAULTS = {
  notify_email: 'diderjp@gmail.com',
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: 'diderjp@gmail.com',
  smtp_pass: '',
};

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
  if (out.smtp_pass) {
    out.smtp_pass_set = '1';
    delete out.smtp_pass;
  } else if (process.env.SMTP_PASS) {
    out.smtp_pass_set = '1';
  } else {
    out.smtp_pass_set = '0';
  }
  return out;
}

module.exports = {
  SMTP_DEFAULTS,
  getSmtpConfig,
  smtpSettingDefaults,
  sanitizeSmtpForAdminResponse,
};
