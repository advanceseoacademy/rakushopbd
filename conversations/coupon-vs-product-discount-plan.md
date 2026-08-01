# Coupon vs Product Discount — Draft Plan

**Status:** Built (2026-08-01) — ready for QA  
**Created:** 2026-08-01  
**Project:** RakuShopBD

---

## 1. Goal

Products that **already have a sale/discount** must **not** get extra discount from coupon codes.

Coupon codes apply **only** to products that have **no** existing product discount.

---

## 2. Current behavior (problem)

Today:

- Product sale price uses `price` (+ optional `old_price` / `discount_percent` for MRP badge).
- Coupon (`percent` or `fixed`) applies to the **full cart subtotal** of sale prices.
- Already-discounted (sale) products still get coupon on top → **double discount**.

Cart lines currently store only `price` — not whether the product was on sale.

---

## 3. Desired rule (simple)

| Product state | Coupon applies? |
|---------------|-----------------|
| No product discount (regular price only) | **Yes** — eligible |
| Has product discount / sale (`old_price` + `discount_percent`) | **No** — excluded |

Coupon math uses **eligible subtotal only** = sum of `(price × qty)` for non-sale items.

---

## 4. Example

Cart:

| Product | Regular / sale | Line total | Coupon eligible? |
|---------|----------------|------------|------------------|
| A | Sale: ৳800 (was ৳1000, 20% off) | ৳800 | No |
| B | No discount: ৳500 | ৳500 | Yes |
| C | No discount: ৳300 | ৳300 | Yes |

- Full cart subtotal = ৳1600  
- **Eligible subtotal** = ৳500 + ৳300 = **৳800**  
- Coupon `10%` → discount = 10% of **৳800** = **৳80** (not ৳160)  
- Coupon fixed `৳100` → discount = min(100, eligible) = **৳100** (capped by eligible subtotal)

If cart has **only** sale items → eligible = 0 → coupon **cannot apply** (clear message to user).

---

## 5. Open decisions (discuss before build)

| # | Topic | Options | Draft default |
|---|--------|---------|---------------|
| 1 | How to detect “already discounted” | `discount_percent > 0` **or** `old_price > price` | **Either** (match admin `normalizeProductDiscount`) |
| 2 | `min_order` check against | Full cart subtotal vs eligible-only | **Eligible subtotal** |
| 3 | Fixed coupon when eligible < coupon value | Cap to eligible / reject coupon | **Cap to eligible** |
| 4 | Cart = only sale items | Reject with message | **Reject**: “Coupon does not apply to discounted products” |
| 5 | Mixed cart UX | Silent exclude vs show which lines excluded | **Show short note** under coupon: “Applied only to non-discounted items” |
| 6 | Admin toggle | Always-on rule vs per-coupon “exclude sale items” | **Always-on** (simpler; one global rule) |
| 7 | Recompute on cart change | Snapshot at apply vs recompute on add/qty/remove | **Recompute** whenever cart changes (fix stale amounts) |

Update this table after discussion.

---

## 6. Proposed implementation

### 6.1 Define eligibility helper

```js
function isProductDiscounted(p) {
  const disc = Number(p.discount_percent) || 0;
  const oldP = Number(p.old_price) || 0;
  const price = Number(p.price) || 0;
  return disc > 0 || (oldP > 0 && oldP > price);
}

function eligibleCouponSubtotal(cart) {
  return cart.reduce((s, i) => {
    if (i.couponEligible === false) return s;
    return s + Number(i.price) * Number(i.qty);
  }, 0);
}
```

### 6.2 Persist flag on cart line

On `POST /cart/add` (and when refreshing prices from DB if that exists), store:

- `couponEligible: boolean` (or `discountPercent` / `oldPrice`)

So coupon math does not need a DB hit every time.

### 6.3 Change coupon calculate (both paths)

Hook points in `routes/api.js`:

1. `POST /api/cart/coupon` — live apply  
2. `POST /api/coupons/validate` — preview  

Use `eligibleSubtotal` for:

- percent: `eligible * value / 100`  
- fixed: `min(value, eligible)`  
- `min_order` (if decided: against eligible)  
- reject if `eligible <= 0`

### 6.4 Recompute session discount

When cart add / qty patch / remove:

- If a coupon is in session → recompute `couponDiscount` from current eligible subtotal  
- Or clear coupon if eligible becomes 0  

(Today discount is snapshotted and can go stale — this fixes that too.)

### 6.5 Storefront copy

- Success: “Coupon applied (non-discounted items only)”  
- Fail (all sale): “This coupon cannot be used on already discounted products”  
- Optional line under coupon field when mixed cart

### 6.6 Admin (optional MVP)

- Short help text on Coupons page: “Coupons never stack with product sale prices.”  
- Phase 2: per-coupon checkbox only if you need exceptions.

---

## 7. Files to touch (when building)

| File | Change |
|------|--------|
| `routes/api.js` | Cart line flag; eligible subtotal; coupon apply + validate; recompute on cart mutations |
| `public/js/api.js` | Show eligibility message / refreshed discount |
| `views/index.ejs` (if needed) | Small helper text near coupon input |
| `views/admin.ejs` / `admin.js` (optional) | Note on Coupons page |

No new DB table required for MVP (rule is global).

---

## 8. Edge cases

| Case | Handling |
|------|----------|
| Product discount removed after already in cart | Ideal: refresh eligibility from DB on coupon apply / checkout; MVP: use flag stored at add-to-cart |
| Product discount added after in cart | Same as above |
| Free delivery + coupon | Unchanged; coupon still only from eligible product subtotal |
| Coupon + delivery fee | Keep current cap behavior, but base %/fixed on eligible product subtotal only |
| Guest vs logged-in | Same session cart logic |

---

## 9. Out of scope (MVP)

- Category / product allowlists for coupons  
- “Stackable with sale” admin override (unless decided in §5)  
- Changing how `old_price` / `discount_percent` are set in admin  

---

## 10. Implementation order (when approved)

1. Helper: `isProductDiscounted` + `eligibleCouponSubtotal`  
2. Store `couponEligible` on cart add  
3. Update `/cart/coupon` + `/coupons/validate`  
4. Recompute on cart change  
5. User-facing messages  
6. Quick test cases: all sale / all regular / mixed / fixed / percent / min_order  

---

## 11. Discussion notes

_(Fill during next discussion)_

- Final decisions on §5:  
- Message copy (Bangla / English):  
- Ship together with affiliate plan or separately?:  

---

## 12. Summary

**Rule:** coupon stacks only on non-sale products.  
**Math base:** eligible subtotal only.  
**UX:** clear message when sale items are excluded or when nothing is eligible.  
**Tech:** small change in `routes/api.js` cart + coupon paths; no new tables for MVP.
