const nodemailer = require('nodemailer');
const { formatPrice } = require('./format');
const { getSmtpConfig } = require('./smtpSettings');
const { getSiteSettings } = require('./siteSettings');

const DEFAULT_NOTIFY_EMAIL = 'diderjp@gmail.com';

const NOTIFY_SETTING_KEYS = [
  'notify_email',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'feature_email_notify',
  'site_name',
];

function getTransporter(settings) {
  const cfg = getSmtpConfig(settings || {});
  if (!cfg.configured) return null;
  return {
    transport: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    }),
    from: cfg.from,
  };
}

function emailNotifyEnabled(settings) {
  return String(settings?.feature_email_notify ?? '1') !== '0';
}

function getNotifyRecipient(settings) {
  const fromSettings = String(settings?.notify_email || '').trim();
  const fromEnv = String(process.env.NOTIFY_EMAIL || '').trim();
  return fromSettings || fromEnv || DEFAULT_NOTIFY_EMAIL;
}

function siteLabel(settings) {
  return String(settings?.site_name || 'RakuShopBD').trim() || 'RakuShopBD';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendAdminEmail(settings, { subject, text, html }) {
  if (!emailNotifyEnabled(settings)) {
    return { skipped: true, reason: 'disabled' };
  }

  const to = getNotifyRecipient(settings);
  const mailer = getTransporter(settings);
  if (!mailer) {
    console.warn(
      'Email notify skipped: configure SMTP in Admin → Settings → Delivery (or set SMTP_USER/SMTP_PASS in .env)'
    );
    return { skipped: true, reason: 'no-smtp' };
  }

  await mailer.transport.sendMail({
    from: `"${siteLabel(settings)}" <${mailer.from}>`,
    to,
    subject,
    text,
    html: html || `<div style="font-family:sans-serif;line-height:1.5">${text.replace(/\n/g, '<br>')}</div>`,
  });
  console.log(`Admin email sent to ${to}: ${subject}`);
  return { ok: true, to };
}

async function loadNotifySettings(query) {
  const base = query ? await getSiteSettings(query) : {};
  if (!query) return { ...base };

  try {
    const placeholders = NOTIFY_SETTING_KEYS.map(() => '?').join(',');
    const rows = await query(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${placeholders})`,
      NOTIFY_SETTING_KEYS
    );
    const fresh = { ...base };
    for (const row of rows) {
      const key = row.setting_key ?? row.settingKey;
      const val = row.setting_value ?? row.settingValue;
      if (key != null) fresh[key] = val;
    }
    return fresh;
  } catch {
    return base;
  }
}

async function dispatchAdminEmail(query, fn, payload, settingsOverride = null) {
  const settings = settingsOverride || (await loadNotifySettings(query));
  try {
    const result = await fn(settings, payload);
    if (result?.skipped) {
      const label = fn?.name || 'notification';
      console.warn(`Admin email skipped (${label}): ${result.reason}`);
    }
    return result;
  } catch (err) {
    console.error('Admin email notify failed:', err);
    return { ok: false, error: err.message };
  }
}

function fireAdminEmail(query, fn, payload) {
  return dispatchAdminEmail(query, fn, payload);
}

async function notifyNewOrder(settings, order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items
    .map(
      (i) =>
        `- ${i.name} × ${i.qty} = ${formatPrice(Number(i.lineTotal ?? i.price * i.qty))}`
    )
    .join('\n');

  const text = [
    `New order on ${siteLabel(settings)}`,
    '',
    `Order ID: ${order.orderNumber}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    order.customerEmail ? `Email: ${order.customerEmail}` : null,
    `District: ${order.district}`,
    `Address: ${order.address}`,
    `Payment: ${order.paymentMethod}`,
    '',
    'Items:',
    itemLines || '(none)',
    '',
    `Subtotal: ${formatPrice(order.subtotal)}`,
    `Delivery: ${formatPrice(order.delivery)}`,
    Number(order.discount) > 0 ? `Coupon discount: -${formatPrice(order.discount)}` : null,
    `Total: ${formatPrice(order.total)}`,
    order.notes ? `\nNotes: ${order.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const itemRows = items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.name)}</td><td>${i.qty}</td><td>${escapeHtml(formatPrice(Number(i.lineTotal ?? i.price * i.qty)))}</td></tr>`
    )
    .join('');

  const discount = Number(order.discount) || 0;
  const summaryRows = [
    `<tr><td style="text-align:right;padding:4px 8px">Subtotal</td><td style="padding:4px 8px">${escapeHtml(formatPrice(order.subtotal))}</td></tr>`,
    `<tr><td style="text-align:right;padding:4px 8px">Delivery</td><td style="padding:4px 8px">${escapeHtml(formatPrice(order.delivery))}</td></tr>`,
  ];
  if (discount > 0) {
    summaryRows.push(
      `<tr><td style="text-align:right;padding:4px 8px">Coupon discount</td><td style="padding:4px 8px">-${escapeHtml(formatPrice(discount))}</td></tr>`
    );
  }
  summaryRows.push(
    `<tr><td style="text-align:right;padding:4px 8px"><strong>Total</strong></td><td style="padding:4px 8px"><strong>${escapeHtml(formatPrice(order.total))}</strong></td></tr>`
  );

  const html = `
    <h2>New order — ${escapeHtml(order.orderNumber)}</h2>
    <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}<br>
    <strong>Phone:</strong> ${escapeHtml(order.customerPhone)}<br>
    ${order.customerEmail ? `<strong>Email:</strong> ${escapeHtml(order.customerEmail)}<br>` : ''}
    <strong>District:</strong> ${escapeHtml(order.district)}<br>
    <strong>Address:</strong> ${escapeHtml(order.address)}<br>
    <strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      <thead><tr><th>Product</th><th>Qty</th><th>Line total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-top:12px;margin-left:auto;border-collapse:collapse">
      <tbody>${summaryRows.join('')}</tbody>
    </table>
    ${order.notes ? `<p><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}`;

  return sendAdminEmail(settings, {
    subject: `[${siteLabel(settings)}] New order ${order.orderNumber}`,
    text,
    html,
  });
}

async function notifyContactMessage(settings, msg) {
  const text = [
    `New contact message on ${siteLabel(settings)}`,
    '',
    `Name: ${msg.customerName}`,
    `Phone: ${msg.customerPhone}`,
    msg.customerEmail ? `Email: ${msg.customerEmail}` : null,
    `Subject: ${msg.subject}`,
    '',
    'Message:',
    msg.message,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <h2>New contact message</h2>
    <p><strong>Name:</strong> ${escapeHtml(msg.customerName)}<br>
    <strong>Phone:</strong> ${escapeHtml(msg.customerPhone)}<br>
    ${msg.customerEmail ? `<strong>Email:</strong> ${escapeHtml(msg.customerEmail)}<br>` : ''}
    <strong>Subject:</strong> ${escapeHtml(msg.subject)}</p>
    <p style="white-space:pre-wrap">${escapeHtml(msg.message)}</p>`;

  return sendAdminEmail(settings, {
    subject: `[${siteLabel(settings)}] Contact: ${msg.subject}`,
    text,
    html,
  });
}

async function notifyAppointment(settings, appt) {
  const text = [
    `New appointment on ${siteLabel(settings)}`,
    '',
    `Reference: ${appt.referenceNumber}`,
    `Name: ${appt.customerName}`,
    `Phone: ${appt.customerPhone}`,
    appt.customerEmail ? `Email: ${appt.customerEmail}` : null,
    `Service: ${appt.serviceLabel || appt.serviceType}`,
    `Date: ${appt.appointmentDate}`,
    `Time: ${appt.appointmentTime}`,
    appt.notes ? `\nNotes: ${appt.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <h2>New appointment — ${escapeHtml(appt.referenceNumber)}</h2>
    <p><strong>Name:</strong> ${escapeHtml(appt.customerName)}<br>
    <strong>Phone:</strong> ${escapeHtml(appt.customerPhone)}<br>
    ${appt.customerEmail ? `<strong>Email:</strong> ${escapeHtml(appt.customerEmail)}<br>` : ''}
    <strong>Service:</strong> ${escapeHtml(appt.serviceLabel || appt.serviceType)}<br>
    <strong>Date:</strong> ${escapeHtml(appt.appointmentDate)}<br>
    <strong>Time:</strong> ${escapeHtml(appt.appointmentTime)}</p>
    ${appt.notes ? `<p><strong>Notes:</strong> ${escapeHtml(appt.notes)}</p>` : ''}`;

  return sendAdminEmail(settings, {
    subject: `[${siteLabel(settings)}] Appointment ${appt.referenceNumber}`,
    text,
    html,
  });
}

module.exports = {
  DEFAULT_NOTIFY_EMAIL,
  emailNotifyEnabled,
  getNotifyRecipient,
  getSmtpConfig,
  getTransporter,
  loadNotifySettings,
  sendAdminEmail,
  dispatchAdminEmail,
  fireAdminEmail,
  notifyNewOrder,
  notifyContactMessage,
  notifyAppointment,
};
