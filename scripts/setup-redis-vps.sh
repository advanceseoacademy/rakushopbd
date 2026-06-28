#!/bin/bash
# RakuShopBD — Install Redis on VPS and enable app cache (run as root via SSH)
# Usage:
#   bash scripts/setup-redis-vps.sh
#   APP_DIR=/home/rakushopbd.com/rakushopbd bash scripts/setup-redis-vps.sh
#
# One-liner from GitHub:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/advanceseoacademy/rakushopbd/main/scripts/setup-redis-vps.sh)"

set -e

DOMAIN="${DOMAIN:-rakushopbd.com}"
APP_DIR="${APP_DIR:-/home/${DOMAIN}/rakushopbd}"
PORT="${PORT:-3001}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
REDIS_KEY_PREFIX="${REDIS_KEY_PREFIX:-rakushopbd:}"

echo "=============================================="
echo " RakuShopBD — Redis setup"
echo " App: $APP_DIR"
echo "=============================================="

install_redis() {
  if command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q PONG; then
    echo ">>> Redis already running"
    return 0
  fi

  export DEBIAN_FRONTEND=noninteractive
  if command -v apt-get >/dev/null 2>&1; then
    echo ">>> Installing redis-server (apt)..."
    apt-get update -qq
    apt-get install -y redis-server
    systemctl enable redis-server
    systemctl restart redis-server
  elif command -v dnf >/dev/null 2>&1; then
    echo ">>> Installing redis (dnf)..."
    dnf install -y redis
    systemctl enable redis
    systemctl restart redis
  elif command -v yum >/dev/null 2>&1; then
    echo ">>> Installing redis (yum)..."
    yum install -y redis
    systemctl enable redis
    systemctl start redis
  else
    echo "ERROR: Could not detect apt/dnf/yum. Install Redis manually, then set REDIS_URL in .env"
    exit 1
  fi
}

install_redis

echo -n ">>> Redis ping: "
redis-cli ping

if [ ! -f "$APP_DIR/.env" ]; then
  echo "WARN: $APP_DIR/.env not found — create .env manually with:"
  echo "REDIS_URL=$REDIS_URL"
  echo "REDIS_KEY_PREFIX=$REDIS_KEY_PREFIX"
  exit 0
fi

ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"

if grep -q '^REDIS_URL=' "$ENV_FILE"; then
  sed -i.bak "s|^REDIS_URL=.*|REDIS_URL=$REDIS_URL|" "$ENV_FILE"
else
  printf '\n# Redis shared cache\nREDIS_URL=%s\n' "$REDIS_URL" >> "$ENV_FILE"
fi

if grep -q '^REDIS_KEY_PREFIX=' "$ENV_FILE"; then
  sed -i.bak "s|^REDIS_KEY_PREFIX=.*|REDIS_KEY_PREFIX=$REDIS_KEY_PREFIX|" "$ENV_FILE"
else
  printf 'REDIS_KEY_PREFIX=%s\n' "$REDIS_KEY_PREFIX" >> "$ENV_FILE"
fi

rm -f "${ENV_FILE}.bak"

echo ">>> Updated $ENV_FILE with Redis settings"

if command -v pm2 >/dev/null 2>&1; then
  echo ">>> Restarting PM2 app..."
  pm2 restart rakushopbd 2>/dev/null || pm2 start "$APP_DIR/ecosystem.config.cjs"
  pm2 save 2>/dev/null || true
  sleep 2
fi

echo ""
echo "=== Health check ==="
curl -sf "http://127.0.0.1:${PORT}/api/health" && echo "" || echo "WARN: Node not responding on :$PORT"

echo ""
echo "Expected: {\"cache\":\"redis\",\"redis\":true}"
echo "Public:   curl -s https://${DOMAIN}/api/health"
echo "=============================================="
