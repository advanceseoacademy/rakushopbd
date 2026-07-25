#!/bin/bash
# Ensure LiteSpeed/CyberPanel vhost 301-redirects apex → www for rakushopbd.com
# Usage (on VPS as root): bash scripts/vps-force-www.sh
set -euo pipefail

DOMAIN="${DOMAIN:-rakushopbd.com}"
WWW="www.${DOMAIN}"
VHOST="${VHOST:-/usr/local/lsws/conf/vhosts/${DOMAIN}/vhost.conf}"
MARKER="# raku-force-www"

if [ ! -f "$VHOST" ]; then
  echo "ERROR: vhost not found: $VHOST"
  exit 1
fi

cp -a "$VHOST" "${VHOST}.bak.www.$(date +%Y%m%d%H%M%S)"

perl -0777 -i -pe "s/\n?${MARKER}.*?${MARKER}-end\n?/\n/gs" "$VHOST" 2>/dev/null || true

# Use Python so bash never eats OpenLiteSpeed's <<< heredoc syntax
python3 - "$VHOST" "$DOMAIN" "$WWW" "$MARKER" <<'PY'
import sys
path, domain, www, marker = sys.argv[1:5]
block = f"""
{marker}
rewrite  {{
  enable                  1
  rules                   <<<END_rules
RewriteCond %{{HTTP_HOST}} ^{domain}$ [NC]
RewriteRule ^(.*)$ https://{www}$1 [R=301,L]
END_rules
}}
{marker}-end
"""
with open(path, "a", encoding="utf-8") as f:
    f.write(block)
print(f"Appended www redirect block to {path}")
PY

ENV_FILE="/home/${DOMAIN}/rakushopbd/.env"
if [ -f "$ENV_FILE" ]; then
  if grep -q '^SITE_URL=' "$ENV_FILE"; then
    sed -i "s|^SITE_URL=.*|SITE_URL=https://${WWW}|" "$ENV_FILE"
  else
    echo "SITE_URL=https://${WWW}" >> "$ENV_FILE"
  fi
  if grep -q '^FORCE_WWW=' "$ENV_FILE"; then
    sed -i 's|^FORCE_WWW=.*|FORCE_WWW=1|' "$ENV_FILE"
  else
    echo "FORCE_WWW=1" >> "$ENV_FILE"
  fi
fi

/usr/local/lsws/bin/lswsctrl restart 2>/dev/null || systemctl restart lsws 2>/dev/null || true
sleep 2
cd "/home/${DOMAIN}/rakushopbd" 2>/dev/null && pm2 restart rakushopbd --update-env 2>/dev/null || true
sleep 2

echo "Applied apex → https://${WWW} 301 redirect"
curl -sI "http://127.0.0.1:3001/" -H "Host: ${DOMAIN}" -H "X-Forwarded-Proto: https" | head -10 || true
curl -sI "https://${DOMAIN}/" | head -10 || true
