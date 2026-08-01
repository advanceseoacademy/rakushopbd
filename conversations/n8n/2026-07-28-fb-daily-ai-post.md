# FB daily AI product post (2026-07-28)

**Instance:** https://n8n.rakushopbd.com/  
**Workflow:** `FB daily AI product post` (ID: `FbDailyAiPost01`) — **active**  
**Separate from:** Messenger `FB auto answer` (`CcvlMVw8yo4CFhzJ`)  
**Sheet:** `products_list` in Products spreadsheet  
**Timezone:** `Asia/Dhaka` (n8n `GENERIC_TIMEZONE` / `TZ`)

---

## What it does

**Twice daily** at **09:00** and **20:00** Bangladesh time (2 different products per day):

1. Read `products_list`
2. Pick next product (`FB_Posted` ≠ YES; after full cycle, rotate) — each run posts a **different** next product
3. AI caption — **Bangla primary + English product names**, price, soft CTA — **no product URL in caption**
4. Download catalog **Product Image URL** → AI `images/edits` (`gpt-image-1`, high input fidelity) so the creative **uses the real product photo**
5. Post photo + caption to Facebook Page
6. **Comment** on that post with the product URL (`https://www.rakushopbd.com/product/{slug}`)
7. Mark sheet: `FB_Posted=YES`, `FB_Posted_At`, `FB_Post_Id`

```text
Twice Daily 9am & 8pm BD / Manual Test
  → Read Products → Pick Next → Generate Caption → Parse Caption
  → Download Product Image → Merge → Generate Image (edits)
  → Parse Image → Post to Facebook → Prepare Comment
  → Mark Posted → Log FB Post Link (`fb-post` sheet) → Comment Product URL
```

**`fb-post` sheet columns:** Posted At | Product Name | Product Slug | Product URL | FB Post Link | FB Post Id

**Note (2026-07-28):** `Mark Posted` runs **before** the comment step, so the sheet updates even if commenting fails. Each successful post also **appends** a row to tab `fb-post` with the Facebook post link.

---

## Sheet columns added

| Column | Purpose |
|--------|---------|
| `FB_Posted` | `YES` after successful post |
| `FB_Posted_At` | Dhaka local timestamp |
| `FB_Post_Id` | Facebook photo/post id |

Match key for updates: **`Product Slug`**

---

## User choices (confirmed)

1. **Image: B** — AI generate  
2. **Time:** **09:00** and **20:00** `Asia/Dhaka` (2 posts / day, different products)  
3. **Caption:** Bangla + English product names  

---

## Files on VPS

| Path | Role |
|------|------|
| `/opt/n8n/locked/install_fb_daily_post.py` | Install / re-upsert workflow + ensure sheet headers |
| `/opt/n8n/locked/fb-daily-ai-post.golden.json` | Golden workflow snapshot |
| `/opt/n8n/locked/install_fb_daily_post.py` | uses env `OPENAI_API_KEY` + `FB_PAGE_ACCESS_TOKEN` (compose) |

Local mirror: `conversations/n8n/scripts/install_fb_daily_post.py`

---

## How to test

1. Open https://n8n.rakushopbd.com/ (hard refresh if needed)
2. Open **FB daily AI product post**
3. Click **Manual Test** / Execute workflow  
4. Check Facebook Page + sheet `FB_Posted` row

**If missing from UI:** workflow must be in `shared_workflow` for project `Te1MVzpY1VpLdrJJ` (installer does this since 2026-07-28).

Do **not** paste Page tokens or App secrets into chat.

---

## Notes / risks

- Page token must include `pages_manage_posts` + `pages_read_engagement` for posting.
- **Product URL comment** also needs `pages_manage_engagement`. Without it, post still succeeds; comment node continues on fail.
- Short-lived tokens expire — refresh in Meta and update compose only on VPS (not in chat).
- Image step uses catalog **Product Image URL** via OpenAI `/images/edits` (`input_fidelity=high`).
- Messenger bot workflow is unchanged; soft guard still applies only to `FB auto answer`.

### Add comment permission (Graph API Explorer)
1. Get User token with: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, **`pages_manage_engagement`**
2. `GET me/accounts` → copy Raku Shop BD Page token
3. Update VPS `FB_PAGE_ACCESS_TOKEN` (do not paste token in chat)
4. `cd /opt/n8n && docker compose up -d`
