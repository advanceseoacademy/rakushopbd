# Telegram approve/reject for FB posts (2026-07-28)

## Status
**Production active** (2026-07-28). Test webhook removed. Schedule runs automatically.

## Flow
```text
09:00 / 20:00 Asia/Dhaka
  → if Status=pending exists in fb-pending: stop
  → pick product → AI caption + product-image edit (gpt-image-1)
  → save draft (/home/node/.n8n-files/fb-drafts + fb-pending)
  → Telegram photo + ✅ Approve / ❌ Reject
      ✅ → clear buttons immediately → FB post → comment URL
         → products_list mark → fb-post log → mark draft approved
      ❌ → clear buttons → mark rejected → regenerate SAME product → new Telegram
```

## Workflows
| ID | Name | Trigger |
|----|------|---------|
| `FbDailyAiPost01` | FB daily AI product post | Schedule 09:00 & 20:00 + Manual Test (UI only) |
| `FbTgApprove01` | FB Telegram approve/reject | `POST /webhook/fb-tg-callback` |

## Sheets
- `fb-pending` — drafts (`pending` / `approved` / `rejected`)
- `fb-post` — published post links
- `products_list` — `FB_Posted` / `FB_Posted_At` / `FB_Post_Id` on approve

## Ops notes
- n8n runs **`activeVersionId`** from `workflow_history` — DB `nodes` edits alone are ignored until `activeVersionId` is updated.
- Draft images: `/home/node/.n8n-files/fb-drafts` (allowlisted by `N8N_RESTRICT_FILE_ACCESS_TO`)
- Telegram: `@RakuShopBD_bot` → admin chat via `TELEGRAM_ADMIN_CHAT_ID`
- Golden: `/opt/n8n/locked/fb-daily-ai-post.golden.json`, `/opt/n8n/locked/fb-tg-approve.golden.json`

## Creative brief (image + caption) — live
**Image (1:1) — HARD RULE:** Product packaging from sheet photo must stay **exact/real** (never redesign/swap). Inputs: **#1 product** + **#2 logo** only (`input_fidelity=high`). Vary background/mood; keep brand kit. English-primary poster text.

**Caption:** unique hook → name/benefits/why-buy/usage → BN+EN mix + emoji → social proof → CTA → hashtags. **No product URL** in caption (URL in FB comment).

Assets: `/opt/n8n/n8n_files/brand/` → `/home/node/.n8n-files/brand/`

Do **not** paste bot/page tokens in chat — keep them in VPS compose / env only.
