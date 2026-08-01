# 2026-07-15 — Sheet URLs, Hada Labo alias, soft-sell, max-iterations

**Date:** 2026-07-15  
**Related resume:** `./README.md`  
**Instance:** https://n8n.rakushopbd.com/  
**Workflow:** `FB auto answer` (`CcvlMVw8yo4CFhzJ`)  
**Sheet:** `products_list` in doc `1qxqOHEen1Sg8Kr-62XdWkh40ff9jUpntQ5I56zPzpSg`

---

## 1) Products sheet — Product Image URL ready

**Problem / request:** Make sheet Product Image URL column ready.

**Done:**
- Read/fixed `products_list` via Google Sheets API (n8n OAuth credential)
- Absolute URLs: `https://www.rakushopbd.com/uploads/...` for Image + Gallery
- Backup on VPS: `/opt/n8n/locked/products_list_backup_*.json`
- ~59 products verified (0 bad image columns after fix)

---

## 2) Photo said “unavailable” but product “in sheet”

**Symptom:** User sent blue Hada Labo bottle photo → bot:
> ei product ta amader kache ei muhurte available nai...

**Root cause (exec ~396/400):**
- OCR correct: brand Hada Labo, **Shirojyun Premium**, 乳液 / 白潤
- Sheet/website listing name: **Hada Labo Gokujun Medicinal Firming Emulsion 140 ml**
- Same catalog image file also shows Shirojyun text on bottle (mislabeled vs Japanese line name)
- Strict match correctly refused Gokujun ≠ Shirojyun

**User decision:** Official full name stays  
`Hada Labo Gokujun Medicinal Firming Emulsion` (with 140 ml in sheet).

**Fix:** Alias in ai agent text + systemMessage + Build Image Message:  
OCR Shirojyun/白潤/薬用浸透美白乳液 → strong match to that Gokujun Firming Emulsion row.

Temporary wrong rename to “Shirojyun Premium Whitening…” was **reverted**.

---

## 3) Soft-sell (sales without annoying)

**Request:** After image match, don’t only dump `Name 1250 Tk`; sell gently.

**Done:** Sales Goal + soft-sell examples in prompts. Pattern:
confirm → name → price → optional one benefit → one soft order invite (name/phone/address).

User confirmed image match works (e.g. LUCIDO-L → priced).

---

## 4) Error: Max iterations — “dam kom rakha jabe?”

**Error (exec #409):**  
`Problem in node 'ai agent'. Max iterations (10) reached...`  
→ no Messenger SMS/reply.

**Cause:** Agent looped `products` tool many times on bargain question (~1m40s fail).

**Fixes:**
- Tool Call Discipline: products ≤1 per message, then final answer
- Bargain / dam kom rules: memory + fixed retail + optional RakuShopBD10; no product-tool loop
- `options.maxIterations = 6`
- Removed unused Wait node from workflow nodes
- products toolDescription: “Call at most ONCE…”

Also patch **active published** `workflow_history` + entity + golden (n8n won’t pick draft-only edits).

---

## 5) Catalog + coupon → always share website / product link (2026-07-15 ~09:55)

**Request:**
- “ar ki ki product ache?” → answer + website link
- Coupon kothay / ki vabe use → howto + website link; if a product was discussed, also product page link

**Done in agent prompts (active + golden):**
- Homepage always: `https://www.rakushopbd.com/`
- Product URL: `https://www.rakushopbd.com/product/{Product Slug}`
- Catalog asks: short answer, ≤2–3 examples, never full dump, always homepage link
- Coupon howto: always homepage; plus product link when slug known from last product

## 6) Dual reply: unavailable + available (2026-07-23)

Exec 652 = image → Daiso Deep C available; Exec 653 ≈6s later text `"প্রাইজ কত"` → Bangla not-in-catalog.
Fixed Dedupe/Guard/agent (Bangla price patterns + skip text after recent image). Golden bak: `fb-auto-answer.golden.json.bak.dualreply-*`

## Open / optional next

- Website product display name still can say Gokujun (intentional); only fix site if user wants copy sync
- More packaging aliases if other misnamed bottles appear
- Re-test: photo + প্রাইজ কত should get ONE sell reply only; catalog ask; coupon; dam kom

---

## Resume for next Cursor chat

```text
conversations/n8n/README.md পড়ে RakuShopBD n8n কাজ চালিয়ে যাও
```
