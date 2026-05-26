#!/bin/bash
# Mac local — RakuShopBD start
cd "$(dirname "$0")/.."
lsof -ti :3000 | xargs kill -9 2>/dev/null
npm run db:setup 2>/dev/null || true
npm run admin:sync
npm start
