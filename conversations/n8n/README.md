# RakuShopBD n8n — Conversation Archive

**Last updated:** 2026-07-28 09:40 (+06)  
**Instance:** https://n8n.rakushopbd.com/  
**VPS:** Contabo `root@84.46.254.52` (SSH key: `~/.ssh/vps_contabo`)  
**n8n path:** `/opt/n8n` (Docker compose)  
**Workflows:**  
- `FB auto answer` (ID: `CcvlMVw8yo4CFhzJ`) — Messenger bot  
- `FB daily AI product post` (ID: `FbDailyAiPost01`) — draft + Telegram notify **09:00 & 20:00** Asia/Dhaka  
- `FB Telegram approve/reject` (ID: `FbTgApprove01`) — Approve → FB post; Reject → regenerate  
**Products sheet:** https://docs.google.com/spreadsheets/d/1qxqOHEen1Sg8Kr-62XdWkh40ff9jUpntQ5I56zPzpSg/edit?gid=366447561 (`products_list`)  
**n8n Sheets credential:** `Google Sheets account 2` (id `Si2RPAeccBsiW3hN`)

> **HARD RULE:** FB poster = **real product image** from sheet. Packaging change/swap/fake **forbidden**. Scene only may vary. See `/opt/n8n/locked/REAL_PRODUCT_RULE.md`

---

## How to resume later

1. Open: `Website Project/RakuShopBD/conversations/n8n/`
2. Read **this file** first, then dated notes if needed
3. SSH: `ssh -i ~/.ssh/vps_contabo root@84.46.254.52`
4. n8n UI: https://n8n.rakushopbd.com/
5. Guard: `/opt/n8n/locked/ensure_fb_workflow.py`
6. Golden (Messenger): `/opt/n8n/locked/fb-auto-answer.golden.json`
7. Golden (Daily post): `/opt/n8n/locked/fb-daily-ai-post.golden.json`
8. Golden (TG approve): `/opt/n8n/locked/fb-tg-approve.golden.json`

**Cursor resume line:**
> `conversations/n8n/README.md` পড়ে RakuShopBD n8n কাজ চালিয়ে যাও

---

## Session notes

| File | Topic |
|------|--------|
| `2026-07-12-messenger-image-detect.md` | Image detect / OCR branch |
| `2026-07-15-sheet-softsell-maxiter.md` | Sheet URLs, Hada Labo naming, soft-sell, max-iterations fix |
| `2026-07-28-fb-daily-ai-post.md` | Daily AI Facebook product post workflow |
| `2026-07-28-telegram-approve.md` | Telegram Approve/Reject before FB post |

---

## What we built / fixed

### 1. Instance check
- n8n live on CyberPanel + Cloudflare
- Docker container `n8n` on port `5678`
- Webhook: `/webhook/fb-webhook` (verify token: `rakushopbd`)

### 2. Product image → name + price
User sends product photo on Messenger → bot should reply with matched product name + BDT price.

**Flow:**
```text
Webhook → Respond POST → Dedupe Message → Edit Fields → Has Image?
  ├─ yes → Download FB Image → Analyze Product Image (OCR JSON)
  │         → Build Image Message → Load Memory → ai agent → Save Memory → HTTP Reply
  └─ no  → Guard Text Intent → Load Memory → ai agent → ...
```

**Important bugs fixed (earlier):**
- Text event before image → wrong memory guess — skip text-only “ei product/dam koto” until image
- OpenAI cannot fetch `fbcdn` — download in n8n, vision via base64 (`getBinaryDataBuffer`)
- Workflow Guard soft mode installed

### 3. No-match reply
> ei product ta amader kache ei muhurte available nai, amader product dekhte visit korun https://www.rakushopbd.com/

Do **not** ask to type name / resend photo.

### 4. Coupon howto
Code: `RakuShopBD10` — 10% off website checkout when product total **over ৳1000**  
https://www.rakushopbd.com/

### 5. Quantity
Do **not** ask quantity. Default = **1**.

### 6. Soft Workflow Guard
`/opt/n8n/locked/ensure_fb_workflow.py` — soft mode; cron every minute.

### 7. Products sheet ready (2026-07-15)
- Sheet `products_list` columns: Product Name | Product Slug | Price | Discount % | Product Image URL | Gallery URLs | **FB_Posted** | **FB_Posted_At** | **FB_Post_Id** (added 2026-07-28)
- All image/gallery paths converted to absolute URLs: `https://www.rakushopbd.com/uploads/...`
- Backup: `/opt/n8n/locked/products_list_backup_*.json`

### 7b. FB daily AI product post + Telegram approve (2026-07-28) — PRODUCTION
- `FbDailyAiPost01` — **09:00 & 20:00 Asia/Dhaka** → AI draft → Telegram ask approve (no direct FB post); **skips website Pre-order / stock 0**
- `FbTgApprove01` — Telegram callback → Approve posts to Page / Reject regenerates same product
- Image: `gpt-image-1` edits from real product image; Caption Bangla + English names (no URL in caption; URL in FB comment)
- Draft files: `/home/node/.n8n-files/fb-drafts`; sheets: `fb-pending`, `fb-post`
- Manual Test (UI) for on-demand draft; **test webhook removed**
- Details: `2026-07-28-fb-daily-ai-post.md`, `2026-07-28-telegram-approve.md`

### 8. Hada Labo image mismatch (2026-07-15) — IMPORTANT
Customer photo / catalog image bottle text = **Shirojyun Premium (白潤)** emulsion.  
User’s **official catalog name** must remain:

**`Hada Labo Gokujun Medicinal Firming Emulsion 140 ml`**

Slug: `hada-labo-gokujun-medicinal-firming-emulsion-140-ml`  
Image: `https://www.rakushopbd.com/uploads/1781339817092-2-_Hada-Labo-Gokujun-Medicinal-Firming-Emulsion-140-ml--Phot.webp`

**Why bot said unavailable before:** OCR reads `Shirojyun` / `白潤`, sheet said only `Gokujun` → strict match failed (correct behaviour for anti-wrong-match).

**Fix applied:** packaging alias in agent text + system + Build Image Message:
- Catalog Gokujun Medicinal Firming Emulsion ↔ OCR Shirojyun Premium / 白潤 / 薬用浸透美白乳液

**Do not rename** this sheet row to Shirojyun unless user explicitly asks (they want Gokujun as full name).  
Website admin may still show old Gokujun title (same intentional name).

### 9. Soft-sell replies (2026-07-15)
Agent goal = **sell gently**, not dry facts only.

- Bad dry: `LUCIDO-L ... 1250 Tk`
- Good: warm confirm + name + price + optional 1 short benefit + **one** soft order CTA (name/phone/address)
- No hard push; if customer says later/no, stop pushing
- Coupon only when relevant
- Still: one line, no emoji, no markdown

Verified working example: LUCIDO-L Designing Aqua Airy Curl Lotion photo → matched + priced.

### 10g. Text without image still answered (2026-07-24)
**Rule refined:** Only *vague photo-intent* is blocked (`Eita ache/hobe`, bare `প্রাইজ কত`, “ei product” with no name).
**Allowed without photo:** named product questions (`Skin Life dam koto`), catalog (`ki ki product`), coupon/delivery/website.
**Still blocked after photo:** vague follow-ups only (prevents dual wrong memory reply).

### 10f. Dual reply: Eita hobe + wrong memory product (2026-07-24)
**Bug:** Photo of Deve cleansing oil → correct Kumano reply, plus second reply offering old memory product (Daiso Deep C) for `"Eita hobe"`.
**Cause:** FB text `"Eita hobe"` not in skip list; ran text path using previous Daiso memory ~7s after image.
**Fix:** Dedupe treats eita/aita/hobe/lagbe/এটা… as photo-intent; after recent image (3 min) drop vague/short text; 90s reply lock per sender; agent told one-photo-one-reply.

### 10e. No SMS replies — guard restart loop (2026-07-23)
**Bug:** Replies stopped; webhook 502; executions timed out (`Task request timed out`).
**Cause:** Soft guard cron every minute flagged sticker-aware Dedupe as `missing image support` (needed exact `type === 'image'`), restored golden + **restarted n8n in a loop**, killing in-flight replies.
**Fix:** Dedupe kept sticker skip + exact `type === 'image'` token; golden updated; guard check relaxed; restart loop stopped. Webhook healthy again.

### 10d. Stickers/emoji treated as products (2026-07-23)
**Bug:** Messenger sticker (thumbs-up) → OCR empty → “এই প্রোডাক্টটি… অ্যাভেইলেবল নেই”.
**Cause:** Sticker attachments include `sticker_id` / CDN `t39.1997-*` but were still run through image→unavailable path.
**Fix:** Dedupe skips stickers (type/sticker_id/CDN); Build Image Message drops blank OCR (confidence≈0, no text) so no unavailable spam.

### 10c. Dual contradictory replies after photo (2026-07-23)
**Bug:** Image matched (e.g. Daiso Deep C → “Good news… available”) but a second text event `"প্রাইজ কত"` replied “ক্যাটালগে পাওয়া যাচ্ছে না”.
**Cause:** FB sends image + text as separate webhooks; Bangla `প্রাইজ কত` was not in the old skip regex (`price koto` only).
**Fix:** Dedupe skips Bangla/EN price+product refs; after a recent image (3 min) suppress follow-up bare price text; Guard/agent never say “not in catalog” without OCR no-match.

### 10b. Catalog + coupon replies must include website links (2026-07-15)
- Ask “ar ki ki product ache?” / what products: short soft answer + **always** `https://www.rakushopbd.com/` (do not dump full sheet; max 2–3 examples).
- Ask coupon kothay / ki vabe use / RakuShopBD10: **always** include `https://www.rakushopbd.com/` + checkout howto; if last product slug known also share `https://www.rakushopbd.com/product/{slug}`.

### 10. Max iterations error on “dam kom rakha jabe?” (2026-07-15)
- Error: `Max iterations (10) reached` on `ai agent` → **no Messenger reply**
- Cause: agent looped calling `products` tool many times on bargain question
- Fixes:
  - Tool discipline: products at most **once**, then final answer
  - Bargain rules: use memory + coupon; do not re-call products in a loop
  - `maxIterations` set to **6**
  - Orphan **Wait** node removed from workflow
  - products `toolDescription` updated (call once)

### 11. Editing workflow on VPS (for next agent)
n8n uses **published/active** version separately from draft:

- `workflow_entity.activeVersionId` (live) + matching `workflow_history.nodes`
- Also update `workflow_entity.nodes` and `versionId` history
- Always update `/opt/n8n/locked/fb-auto-answer.golden.json` after prompt/node changes
- Restart: `cd /opt/n8n && docker compose restart n8n`

Sheets API edits use decrypted n8n Google OAuth (do **not** store tokens in this markdown). Temp files under `/tmp/google_oauth.json` must be deleted after use.

---

## Key files on VPS

| Path | Purpose |
|------|---------|
| `/opt/n8n/docker-compose.yml` | n8n env (HOST, WEBHOOK_URL, OPENAI/FB tokens) |
| `/opt/n8n/n8n_data/database.sqlite` | workflows/executions |
| `/opt/n8n/locked/fb-auto-answer.golden.json` | protected Messenger workflow snapshot |
| `/opt/n8n/locked/fb-daily-ai-post.golden.json` | daily AI post workflow snapshot |
| `/opt/n8n/locked/install_fb_daily_post.py` | install/re-upsert daily post workflow |
| `/opt/n8n/locked/ensure_fb_workflow.py` | soft guard (Messenger only) |
| `/opt/n8n/locked/products_list_backup_*.json` | sheet backups |
| `/var/log/n8n-workflow-guard.log` | guard logs |

**Backups:** `fb-auto-answer.golden.json.bak.softsell-*`, `bak.maxiter-*`, `bak.rename-*`, older image/guard backups.

---

## Agent tools wired
- OpenAI Chat Model (vision analyze uses `gpt-4o-mini`)
- Google Sheets `products` (read) — call ≤1× per message
- Google Sheets `order` (append)
- Calculator (only if needed)
- Simple Memory + Load/Save Memory
- ~~Wait~~ removed (caused/confused agent loops)

---

## Do / Don’t for future edits

**OK:** prompt tweaks, layout, soft-sell wording, sheet product rows/prices/images  

**Avoid deleting:** Webhook / Respond POST / Dedupe / Has Image / Download / Analyze / Build / Load-Save Memory / ai agent  

**Avoid:** re-adding Wait as agent tool; forcing “always call products” without once-limit; renaming Hada Labo Gokujun Firming Emulsion to Shirojyun unless user asks  

**Big changes:** patch active `workflow_history` + entity + golden together, then restart n8n  

---

## Security notes
- Do not commit API keys / page tokens / OAuth into git markdown
- `docker-compose.yml` has secrets in plain env — rotate if exposed
- Conversations folder is notes only

---

## Status checklist
- [x] Messenger bot live
- [x] Image detect + strict product match
- [x] No-match → website link
- [x] Coupon howto
- [x] No quantity ask (default 1)
- [x] Soft guard
- [x] Sheet Product Image URLs absolute
- [x] Hada Labo Gokujun name kept + Shirojyun OCR alias
- [x] Soft-sell reply style
- [x] Max-iterations / products-loop + dam kom handling
- [x] Catalog + coupon answers include website / product links
- [x] FB daily AI product post workflow (09:00 & 20:00 BD, 2 products/day)
- [x] Sheet FB_Posted / FB_Posted_At / FB_Post_Id columns
- [x] Conversation archive updated (this session)
