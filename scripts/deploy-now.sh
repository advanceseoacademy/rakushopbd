#!/bin/bash
# Run from Mac after: ssh root@84.46.254.52 (or set VPS_HOST)
# Usage: bash scripts/deploy-now.sh
set -euo pipefail
HOST="${VPS_HOST:-root@84.46.254.52}"
SSH_OPTS=(-o StrictHostKeyChecking=no)
[[ -f "$HOME/.ssh/vps_contabo" ]] && SSH_OPTS+=(-i "$HOME/.ssh/vps_contabo")

echo "Deploying to $HOST ..."
ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /home/rakushopbd.com/rakushopbd
git pull origin main
npm install
node scripts/seed-messenger-chats.js 2>/dev/null || true
pm2 restart rakushopbd
sleep 3
echo "--- recommended API ---"
curl -s "http://127.0.0.1:3001/api/products/recommended?limit=2"
echo
echo "--- db-check ---"
curl -s "http://127.0.0.1:3001/api/db-check" | head -c 200
echo
pm2 status
REMOTE
echo "Done. Hard-refresh https://rakushopbd.com"
