#!/bin/bash
# RakuShopBD — CyberPanel VPS full deploy (run as root on VPS)
# Paste in SSH: bash -c "$(curl -fsSL https://raw.githubusercontent.com/advanceseoacademy/rakushopbd/main/scripts/vps-deploy-all.sh)"
# Or after git clone: bash scripts/vps-deploy-all.sh

set -e
DOMAIN="${DOMAIN:-rakushopbd.com}"
APP_DIR="${APP_DIR:-/home/${DOMAIN}/rakushopbd}"
REPO="https://github.com/advanceseoacademy/rakushopbd.git"
PORT=3001

echo "=== RakuShopBD VPS Deploy ==="
echo "Domain: $DOMAIN | App: $APP_DIR | Port: $PORT"

export DEBIAN_FRONTEND=noninteractive
if ! command -v node >/dev/null; then
  echo ">>> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs git
fi

command -v pm2 >/dev/null || npm install -g pm2

mkdir -p "$(dirname "$APP_DIR")"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
else
  cd "$APP_DIR" && git pull origin main
fi

cd "$APP_DIR"
git pull origin main
npm install

cat > "$APP_DIR/.env" << 'ENVFILE'
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://postgres.dymliuodmmmgvwjbonjn:RakuShopBd_Supabase_2026_Xk9@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://dymliuodmmmgvwjbonjn.supabase.co
SESSION_SECRET=rakushopbd-live-secret-8f3a9c2e1b7d4f6a
ADMIN_USERNAME=admin@rakushopbd.com
ADMIN_EMAIL=admin@rakushopbd.com
ADMIN_PASSWORD=BDRakuadmin2026%%
ENVFILE

pm2 delete rakushopbd 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# Remove static index that blocks Node
rm -f "/home/${DOMAIN}/public_html/index.html" 2>/dev/null || true
rm -f "/home/${DOMAIN}/public_html/index.php" 2>/dev/null || true

mkdir -p "$APP_DIR/public/uploads"
chmod 755 "$APP_DIR/public/uploads"

# OpenLiteSpeed reverse proxy (CyberPanel)
VHOST="/usr/local/lsws/conf/vhosts/${DOMAIN}/vhost.conf"
if [ -f "$VHOST" ]; then
  if ! grep -q "127.0.0.1:${PORT}" "$VHOST" 2>/dev/null; then
    echo ">>> Adding reverse proxy to $VHOST"
    cat >> "$VHOST" << PROXY

context / {
  type                    proxy
  handler                 lsphp
  addDefaultCharset       off
}

rewrite  {
  enable                  1
  rules                   <<<END_rules
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:${PORT}/\$1 [P,L]
END_rules
}
PROXY
    /usr/local/lsws/bin/lswsctrl restart 2>/dev/null || systemctl restart lsws 2>/dev/null || true
  fi
else
  echo "⚠️  vhost not found at $VHOST — set reverse proxy manually in CyberPanel"
fi

echo ""
echo "=== Local test ==="
sleep 2
curl -s "http://127.0.0.1:${PORT}/api/db-check" || echo "(curl failed — check pm2 logs)"
echo ""
pm2 status
echo ""
echo "=== Done ==="
echo "Browser: https://${DOMAIN}/api/db-check"
echo "Admin:   https://${DOMAIN}/admin"
echo "Logs:    pm2 logs rakushopbd"
