#!/bin/bash
# RakuShopBD — Fix EVERYTHING on CyberPanel VPS (run as root via SSH)
# bash -c "$(curl -fsSL https://raw.githubusercontent.com/advanceseoacademy/rakushopbd/main/scripts/vps-fix-everything.sh)"

set -e
DOMAIN="${DOMAIN:-rakushopbd.com}"
APP_DIR="${APP_DIR:-/home/${DOMAIN}/rakushopbd}"
REPO="https://github.com/advanceseoacademy/rakushopbd.git"
PORT=3001
VHOST="/usr/local/lsws/conf/vhosts/${DOMAIN}/vhost.conf"

echo "=============================================="
echo " RakuShopBD — VPS fix everything"
echo " Domain: $DOMAIN | App: $APP_DIR | Port: $PORT"
echo "=============================================="

export DEBIAN_FRONTEND=noninteractive
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs git
fi
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

mkdir -p "/home/${DOMAIN}/public_html"
mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch origin main || true
git clean -fd public/uploads/ 2>/dev/null || true
git reset --hard origin/main || git pull origin main || true
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

mkdir -p "$APP_DIR/public/uploads"
chmod -R 755 "$APP_DIR/public/uploads"

rm -f "/home/${DOMAIN}/public_html/index.html" "/home/${DOMAIN}/public_html/index.php" 2>/dev/null || true

pm2 delete rakushopbd 2>/dev/null || true
cd "$APP_DIR"
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo ">>> Waiting for Node on :$PORT ..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:${PORT}/api/db-check" | grep -q '"ok":true'; then
    echo "    Node OK"
    break
  fi
  sleep 1
  if [ "$i" -eq 10 ]; then
    echo "    ERROR: Node not responding on :$PORT"
    pm2 logs rakushopbd --lines 40 --nostream || true
    exit 1
  fi
done

if [ ! -f "$VHOST" ]; then
  echo "ERROR: vhost not found: $VHOST"
  echo "Create website $DOMAIN in CyberPanel first."
  exit 1
fi

cp -a "$VHOST" "${VHOST}.bak.$(date +%Y%m%d%H%M%S)"
echo ">>> Fixing vHost (backup saved)"

# Remove broken rewrite [P] proxy and bad lsphp context from old deploy script
perl -0777 -i -pe '
  s/rewrite\s*\{[^}]*127\.0\.0\.1:\d+[^}]*\}//gs;
  s/context\s*\/\s*\{[^}]*handler\s+lsphp[^}]*\}//gs;
' "$VHOST" 2>/dev/null || true

# Remove duplicate extprocessor/context if re-running
perl -0777 -i -pe '
  s/extprocessor\s+rakushopbd_node\s*\{[^}]*\}//gs;
  s/context\s*\/\s*\{[^}]*handler\s+rakushopbd_node[^}]*\}//gs;
' "$VHOST" 2>/dev/null || true

cat >> "$VHOST" << EOF

extprocessor rakushopbd_node {
  type                    proxy
  address                 127.0.0.1:${PORT}
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 rakushopbd_node
  addDefaultCharset       off
}
EOF

/usr/local/lsws/bin/lswsctrl restart 2>/dev/null || systemctl restart lsws 2>/dev/null || true
sleep 3

echo ""
echo "=== TEST RESULTS ==="
echo -n "Local Node:  "
curl -sf "http://127.0.0.1:${PORT}/api/db-check" || echo "FAILED"
echo ""
echo -n "Domain HTTP: "
curl -sf "http://${DOMAIN}/api/db-check" || curl -s "http://${DOMAIN}/api/db-check" | head -c 200
echo ""
echo ""
pm2 status
echo ""
echo "=============================================="
echo " Browser: https://${DOMAIN}/api/db-check"
echo " Admin:   https://${DOMAIN}/admin"
echo "=============================================="
