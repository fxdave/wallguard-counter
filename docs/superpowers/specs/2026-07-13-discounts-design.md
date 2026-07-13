# Discounts — design

## Goal

Let users apply named percentage discounts to a Quick Add checkout. A discount is a
`name` + `percent` (e.g. "Internal staff (50%)"). Discounts are toggled on/off in
Quick Add like item cards, managed from a Settings admin tab, and count as items —
visible in checkouts, exports, and Overview statistics.

## Decisions

- **Storage:** a dedicated `discounts` collection (not a flag on `Item`). Cleaner —
  no fake category or unit price.
- **Stacking:** multiple discounts may be active at once. They **compound
  multiplicatively** in display order:
  `total = subtotal × (1 − d1) × (1 − d2) × …`
  e.g. `3000 × 0.9 × 0.8 = 2160`.
- **Recording:** each active discount becomes one **negative checkout line** at Save
  time, snapshotting name, percent, and the reduction amount. This reuses the
  existing snapshot-on-write machinery, so history stays correct after a discount is
  renamed, repriced, or deleted.
- **Snapshot name:** the exported/stored line name is the plain discount name
  (`Internal staff`); the `(50%)` suffix is UI-only (derived from `percent`).

## Data model

New shared top-level collection, shaped like `categories`:

```ts
// discounts/{id}
interface Discount {
  id: string;
  name: string;    // "Internal staff"
  percent: number; // 0–100, e.g. 50
  order: number;   // display + application order, multiples of 1000
}
type DiscountInput = Omit<Discount, 'id'>;
```

`CheckoutLine` gains an optional `percent`, which also marks a line as a discount:

```ts
interface CheckoutLine {
  itemId: string;      // = discount id for discount lines
  name: string;        // "Internal staff" (snapshot)
  price: number;       // NEGATIVE reduction amount (snapshot)
  quantity: number;    // always 1 for discount lines
  percent?: number;    // discount % (snapshot); present ⇒ this is a discount line
  holderName?: string; // (unchanged) pass lines
  holderBirthday?: string;
}
```

## Line-splitting (multiplicative)

Pure helper, testable without Firestore:

```ts
// lib/discounts.ts
function computeDiscountLines(
  subtotal: number,
  discounts: Discount[], // active, sorted by order
): CheckoutLine[]
```

Apply each discount to the running (already-discounted) amount so each line captures
its own incremental cut:

```
running = 3000
staff 10%: cut = 300  → { itemId, name: "Internal staff", price: -300, quantity: 1, percent: 10 }; running = 2700
promo 20%: cut = 540  → { itemId, name: "Promo",          price: -540, quantity: 1, percent: 20 }; running = 2160
checkout.total = 2160  // == sum of ALL line prices (positive + negative)
```

Rounding follows the existing money convention in `lib/format.ts`/`firestore.ts`
(match whatever the item/pass totals already do so `total` stays consistent).

The "subtotal" a discount applies to is the sum of all positive lines: normal item
counts **plus** pass entries.

## Quick Add UI

- A **discount strip** rendered below the category/item sections and above the sticky
  Save bar. Each discount is a toggle chip/card labeled `Internal staff (50%)`, using
  the same selected/unselected visual language as `ItemCard` and a `motion` toggle.
- Multiple discounts can be selected simultaneously (local state, e.g.
  `Set<discountId>`), cleared on Save alongside `counts`/`passEntries`.
- The Save bar **Total** recomputes live through the multiplicative chain.
- A discount alone does not make a checkout saveable: Save still requires ≥1 positive
  line. If no positive lines exist, discounts contribute nothing and Save stays
  disabled (existing `totalQty === 0` guard already covers this).
- On Save, positive lines are built as today, then `computeDiscountLines(subtotal,
  activeDiscounts)` is appended, and `total` is the post-discount running amount.

## Settings → Discounts (new tab)

- Add a 5th tab to `Settings.tsx` between/after the existing ones:
  Categories · Items · Discounts · Checkouts · Members (final ordering a UI detail).
- `pages/settings/DiscountsSection.tsx` mirrors `CategoriesSection`: list with
  reorder (up/down via `order`), add/edit/delete. Fields: `name` (text),
  `percent` (number 0–100).
- Data layer: `useDiscounts()` + `useDiscountMutations()` in `lib/queries.ts`;
  discount CRUD in `lib/firestore.ts`, following the category functions.

## Firestore rules

Add a `match /discounts/{id}` block to `firestore.rules` mirroring the `categories`
block: any member may read/write. Mirror the same in `firestore.dev.rules` if it
enumerates collections (otherwise dev open rules already cover it).

## Overview (statistics)

Discount lines already populate the `itemId → dayKey → quantity` totals map from
checkout lines. Overview renders a **synthetic "Discounts" category group** (icon 💸)
at the bottom of `MonthTable`, whose rows are the discounts (from `useDiscounts()`),
so each cell shows how many times that discount was applied that day — consistent with
item counts. Money is not shown in Overview (it never was). Rows use the discount id
to look up the same totals map. Discounts with zero activity in the month still render
(as item rows do).

## Export

No special handling. Each discount line is emitted as a normal
`name;quantity;ISO-date` row (`Internal staff;1;<date>`), since the CSV already
iterates checkout lines and ignores price. It naturally "counts as an item".

## Testing

- `lib/discounts.test.ts`: unit tests for `computeDiscountLines` — single discount,
  multiplicative stacking (the 3000×0.9×0.8 case), ordering by `order`, empty list,
  and that line prices sum to the expected post-discount reduction / `total`.
- `lib/firestore.test.ts`: discount CRUD against the emulator; rules allow member
  read/write.

## Out of scope

- Fixed-amount (non-percentage) discounts.
- Per-item / per-category targeted discounts (discounts apply to the whole subtotal).
- Configurable combinability rules — stacking is always multiplicative in `order`.
- Showing discount money totals in Overview.
