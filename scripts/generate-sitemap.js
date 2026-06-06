#!/usr/bin/env node
/**
 * Write public/sitemap.xml from database (run after product/category changes).
 * Usage: node scripts/generate-sitemap.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { buildSitemapXml } = require('../lib/seo');

async function main() {
  const req = {
    protocol: 'https',
    get: (h) => (h === 'host' ? 'rakushopbd.com' : null),
    path: '/',
  };
  if (process.env.SITE_URL) {
    try {
      const u = new URL(process.env.SITE_URL);
      req.get = (h) => {
        if (h === 'host') return u.host;
        if (h === 'x-forwarded-proto') return u.protocol.replace(':', '');
        return null;
      };
    } catch (_) {}
  }
  const xml = await buildSitemapXml(req);
  const out = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(out, xml, 'utf8');
  console.log('Wrote', out);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
