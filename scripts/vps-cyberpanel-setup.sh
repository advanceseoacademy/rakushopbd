#!/bin/bash
# RakuShopBD — CyberPanel VPS first-time setup (run on VPS as root or site user)
# Usage: bash scripts/vps-cyberpanel-setup.sh /home/rakushopbd.com/rakushopbd

set -e
APP_DIR="${1:-/home/rakushopbd.com/rakushopbd}"
REPO="${2:-https://github.com/advanceseoacademy/rakushopbd.git}"

echo "=== RakuShopBD CyberPanel VPS setup ==="
echo "App directory: $APP_DIR"

command -v node >/dev/null || {
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

command -v pm2 >/dev/null || npm install -g pm2

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO" "$APP_DIR"
else
  cd "$APP_DIR" && git pull origin main
fi

cd "$APP_DIR"
npm install --production

if [ ! -f .env ]; then
  echo "⚠️  Copy .env from env-for-cpanel-supabase.txt (DATABASE_URL + ADMIN_*)"
  cp env.supabase.example.txt .env 2>/dev/null || cp env.vps.example.txt .env 2>/dev/null || true
fi

pm2 delete rakushopbd 2>/dev/null || true
PORT=3001 pm2 start ecosystem.config.cjs
pm2 save
pm2 startup | tail -1 | bash || true

echo ""
echo "✅ App running on port 3001"
echo "Next: CyberPanel → OpenLiteSpeed → reverse proxy to 127.0.0.1:3001"
echo "Test: curl -s http://127.0.0.1:3001/api/db-check"
