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

# Remove previous block if re-running
perl -0777 -i -pe "s/\n?${MARKER}.*?${MARKER}-end\n?/\n/gs" "$VHOST" 2>/dev/null || true

# Quoted heredoc so bash does not interpret <<< as a here-string
cat >> "$VHOST" << EOF

${MARKER}
rewrite  {
  enable                  1
  rules                   <<'END_rules'
RewriteCond %{HTTP_HOST} ^${DOMAIN}\$ [NC]
RewriteRule ^(.*)\$ https://${WWW}\$1 [R=301,L]
END_rules
}
${MARKER}-end
EOF

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
echo "--- Node Host test ---"
curl -sI "http://127.0.0.1:3001/blog" -H "Host: ${DOMAIN}" -H "X-Forwarded-Proto: https" | head -12 || true
echo "--- Public test ---"
curl -sI "https://${DOMAIN}/" | head -12 || true
