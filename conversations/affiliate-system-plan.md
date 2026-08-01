# Affiliate System — Draft Plan

**Status:** Draft (discussion pending)  
**Created:** 2026-08-01  
**Project:** RakuShopBD

---

## 1. Goal

Registered users can become affiliates, share unique product/site links, drive sales, and earn **cash commission** when those orders are successfully delivered.

This is separate from the existing **reward-points referral** system (`/?ref=` signup bonuses). Referral points can stay as-is; affiliate commission is a new cash layer.

---

## 2. User story (happy path)

1. User opens Account → applies to become an affiliate.
2. Admin reviews and approves (or rejects).
3. Affiliate gets a unique link, e.g. `https://rakushopbd.com/?ref=RAKU000123` (reuse existing referral code format).
4. Affiliate shares the link (Facebook, Messenger, WhatsApp, etc.).
5. Customer lands via the link → affiliate attribution is saved (cookie / session, e.g. 30 days).
6. Customer places an order → order is stamped with the affiliate.
7. Admin marks order **delivered** → commission is created as **pending**.
8. Affiliate sees earnings in Account (pending / paid).
9. Admin marks payout as paid (bKash / Nagad / Rocket, manual) → commission becomes **paid**.

```
Apply → Admin approve → Share link → Customer buys → Delivered → Commission pending → Payout
```

---

## 3. Scope

### Phase 1 — MVP (recommended first build)

| Feature | Detail |
|--------|--------|
| Apply + approve | User apply; admin approve / reject |
| Unique link | Reuse `referral_code` / `/?ref=` |
| Cookie tracking | Configurable duration (default proposal: **30 days**) |
| Order attribution | Stamp affiliate on `POST /api/orders` |
| Commission unlock | On order status → **delivered** |
| Flat rate | Site-wide % (default proposal: **5%** of product subtotal, exclude delivery fee) |
| No self-commission | Affiliate cannot earn on their own orders |
| Account dashboard | Copy link, pending / paid totals, commission history |
| Admin panel | Affiliates list, approve, set %, commissions, mark payouts |
| Settings | Commission %, cookie days, min payout (default proposal: **৳500**) |

### Phase 2 — later

- Product / category–wise commission rates  
- Per-affiliate unique coupon codes  
- Click / conversion analytics  
- Auto or semi-auto payouts  
- Affiliate performance leaderboard  
- Multi-level (MLM-style) — **not recommended** unless explicitly wanted  

---

## 4. Open decisions (discuss before build)

| # | Topic | Options | Draft default |
|---|--------|---------|---------------|
| 1 | Commission rate | Flat % vs product/category rates | **5% flat** on product subtotal |
| 2 | Unlock timing | `delivered` vs `confirmed` | **`delivered`** |
| 3 | Self-purchase | Allow / deny commission on own orders | **Deny** |
| 4 | Payout | Min balance + method | **৳500 min**, manual bKash/Nagad/Rocket |
| 5 | Who can join | Open apply vs invite-only | **Open apply** (admin approve) |
| 6 | Cookie / attribution window | 7 / 14 / 30 days | **30 days** |
| 7 | Last-click vs first-click | If multiple affiliates touch same customer | **Last click** (simpler) |
| 8 | Cancel / return | Clawback if order cancelled after commission created | **Void pending** on cancel |

Update this table after discussion.

---

## 5. What already exists (reuse)

| Existing | Location / notes | Reuse as |
|----------|------------------|----------|
| `/?ref=` + localStorage | `public/js/app.js`, `account.js` | Affiliate click capture |
| `users.referral_code`, `referred_by_user_id` | reward points libs | Affiliate identity / link code |
| Session cart / coupon pattern | `routes/api.js` | Persist affiliate in session (survive checkout) |
| Order status → delivered side effects | `routes/admin.js` + reward points | Same hook for commission create |
| Coupons | `coupons` table, admin CRUD | Optional Phase 2 bridge |
| Account UI | `public/js/account.js` | Affiliate dashboard tab |
| Admin UI | `views/admin.ejs`, `public/js/admin.js` | Affiliates + payouts pages |

**Gap today:** referral is signup-points only — **no order-level attribution, no cash commission, no payout flow.**

---

## 6. Proposed data model (draft)

### 6.1 Extend `users` (or small `affiliates` table)

Suggested fields (either on `users` or dedicated `affiliates` row per user):

- `affiliate_status`: `none` | `pending` | `approved` | `rejected` | `suspended`
- `affiliate_applied_at`, `affiliate_approved_at`
- `affiliate_payout_method` (bkash / nagad / rocket)
- `affiliate_payout_number` (phone)
- Optional: `affiliate_notes` (admin)

### 6.2 Extend `orders`

- `affiliate_user_id` (nullable FK → users)
- `affiliate_code` (snapshot of code used at checkout)
- Optional: `affiliate_attributed_at`

### 6.3 New table: `affiliate_commissions`

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `affiliate_user_id` | Who earns |
| `order_id` | Source order (unique — one commission per order) |
| `order_number` | Snapshot for display |
| `order_subtotal` | Base amount used for % |
| `rate_percent` | Rate at time of unlock |
| `amount` | Commission amount (BDT) |
| `status` | `pending` \| `approved` \| `paid` \| `voided` |
| `created_at` | When unlocked (usually on delivered) |
| `paid_at` | When admin marks paid |
| `paid_by_admin_id` | Who paid |
| `payout_ref` | Optional trx id / note |
| `void_reason` | If cancelled / clawed back |

### 6.4 New table (optional MVP): `affiliate_payouts`

Batch payouts if preferred over marking commissions one-by-one:

- `id`, `affiliate_user_id`, `amount`, `method`, `number`, `status`, `admin_id`, `note`, timestamps  
- Link commissions via `payout_id` on `affiliate_commissions`

**MVP shortcut:** skip batch table; mark individual commissions `paid`.

### 6.5 Site settings keys (draft)

- `affiliate_commission_percent` → `5`
- `affiliate_cookie_days` → `30`
- `affiliate_min_payout` → `500`
- `affiliate_enabled` → `1` / `0`

---

## 7. Backend hooks (integration points)

| When | Where | Action |
|------|--------|--------|
| Capture `?ref=` | Storefront JS + session | Save affiliate code (cookie + `req.session`) |
| Apply | `POST /api/auth/affiliate/apply` | Set status `pending` + payout info |
| Register (optional) | Existing referral flow | Keep points; do not auto-approve affiliate |
| Order create | `POST /api/orders` | Resolve session/cookie → set `affiliate_user_id` (block self) |
| Order delivered | `PATCH /api/admin/orders/:id` | Create commission row if attributed + not exists |
| Order cancelled | Same PATCH | Void pending commission if any |
| Account APIs | `/api/auth/affiliate/*` | Summary, history, link |
| Admin APIs | `/api/admin/affiliates/*` | List, approve, commissions, mark paid |

---

## 8. UI sketch

### Customer / Affiliate (Account)

- Tab or section: **Affiliate**
  - If not applied: CTA + apply form (payout method + number)
  - If pending: “Under review”
  - If approved:
    - Shareable link + copy button
    - Stats: pending ৳ / paid ৳ / orders referred
    - Table: order #, date, amount, status
    - Optional: “Request payout” when balance ≥ min

### Admin

- Nav: **Affiliates**
  - Applicants (pending) → Approve / Reject
  - Approved list + payout details
  - Commissions list (filter by status)
  - Mark paid (single or bulk)
  - Settings: %, cookie days, min payout, enable toggle

---

## 9. Commission rules (draft policy)

1. Base = order **product subtotal** (after product discounts if any; **exclude** delivery fee).  
2. Rate = site setting at unlock time (store snapshot on commission row).  
3. Unlock only when order first becomes **delivered**.  
4. One commission per order max.  
5. No commission if buyer is the same user as affiliate.  
6. If order later **cancelled**, void any **pending** commission (paid commissions need manual admin policy — discuss).  
7. Attribution window: last valid affiliate cookie within N days before checkout.

**Discuss later:** coupon discounts — commission on pre-coupon or post-coupon subtotal?

---

## 10. Security & abuse (brief)

- Admin approval gate before earning  
- Self-referral blocked on order  
- Unique commission per `order_id`  
- Rate / amount snapshot (no silent rewrite of history)  
- Suspend status for abusive affiliates  
- Do not expose other affiliates’ payout numbers in public APIs  

---

## 11. Out of scope for MVP

- Payment gateway auto-split  
- Multi-level / MLM commissions  
- Automatic bank transfer  
- Mobile app–only flows  
- Replacing reward-points referral (keep both unless decided otherwise)  

---

## 12. Implementation order (when approved)

1. Schema + ensure migrations (Postgres / MySQL as used)  
2. Session + cookie attribution on storefront + order create  
3. Commission create/void on order status change  
4. Auth APIs + Account UI  
5. Admin APIs + Admin UI + settings  
6. Soft launch: enable setting off → test with 1–2 affiliates → enable  

---

## 13. Discussion notes

_(Fill during next discussion)_

- Final decisions on table in §4:  
- Commission on couponed orders:  
- Paid commission clawback policy:  
- Keep reward points + cash affiliate together?:  
- Target launch date:  

---

## 14. Summary

Build a **simple cash affiliate MVP** on top of existing `?ref=` / referral codes: apply → approve → track → stamp order → unlock on delivered → manual payout. Defer fancy rates, coupons-per-affiliate, and auto-payouts to Phase 2.
