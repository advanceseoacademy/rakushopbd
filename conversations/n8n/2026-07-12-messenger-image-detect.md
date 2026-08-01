# n8n Messenger + Product Image Detect

**Date:** 2026-07-12 → updated 2026-07-13  
**Instance:** https://n8n.rakushopbd.com/  
**VPS:** Contabo (`84.46.254.52`) — n8n Docker at `/opt/n8n`

## Goal

User Messenger-এ product image পাঠালে AI product চিনে **নাম + দাম (BDT)** বলে দেবে।

## Status: WORKING (with later polish)

### Implemented
- Image branch: Download FB Image → Analyze (base64 OCR JSON) → Build Image Message → Agent
- Strict match (no wrong product like Squalane for Skin Life)
- Text-only “ei product” skipped until image event
- No-match reply → visit https://www.rakushopbd.com/
- Coupon howto: `RakuShopBD10` on website checkout over ৳1000
- Quantity: do not ask; default 1
- Canvas layout cleaned
- Soft Workflow Guard (UI Save safe)

### See also
Full resume doc: `./README.md`  
Later session (sheet / soft-sell / max-iter): `./2026-07-15-sheet-softsell-maxiter.md`

### DB / golden backups
- `/opt/n8n/n8n_data/database.sqlite.bak.image-*`
- `/opt/n8n/locked/*.bak*`

## Notes
- Do not store API keys / page tokens in these markdown files.
- Secrets live in `/opt/n8n/docker-compose.yml` on VPS — rotate if exposed.
