#!/bin/bash
# Run ONCE in cPanel Terminal (not on your Mac).
# Copy-paste the whole block after: cd ~/repositories/rakushopbd

set -e
echo "=== RakuShopBD cPanel deploy ==="
pwd
test -f server.js || { echo "ERROR: server.js not found. cd to folder with server.js first."; exit 1; }

echo ">>> git pull..."
git pull origin main

# Node virtualenv — edit path if cPanel shows a different one
VENV="/home/$(whoami)/nodevenv/repositories/rakushopbd/20/bin/activate"
if [ -f "$VENV" ]; then
  # shellcheck disable=SC1090
  source "$VENV"
  echo ">>> Using node: $(which node) $(node -v)"
else
  echo "WARN: virtualenv not found at $VENV"
  echo "      Use Setup Node.js App -> enter virtual environment, then run:"
  echo "      npm install && npm run admin:sync"
fi

if command -v npm >/dev/null 2>&1; then
  npm install
  npm run admin:sync
else
  echo "ERROR: npm not in PATH. In cPanel: Stop app -> Run NPM Install -> then run admin:sync from Node UI or fix VENV path above."
  exit 1
fi

touch tmp/restart.txt 2>/dev/null || mkdir -p tmp && touch tmp/restart.txt

echo ""
echo "=== Done. Now in cPanel: Setup Node.js App -> STOP 10s -> START ==="
echo "Test: https://rakushopbd.com/api/admin/version"
echo "Login: admin@rakushopbd.com + password from env ADMIN_PASSWORD"
