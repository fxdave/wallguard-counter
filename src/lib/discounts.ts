import type { CheckoutLine, Discount } from './types';

/** Round to 2 decimal places (money). */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turn a positive subtotal + the active discounts into snapshotted checkout
 * lines. Discounts stack MULTIPLICATIVELY in `order`: each applies to the
 * running (already-discounted) amount, e.g. 3000 → 10% then 20% → 2160.
 *
 * Each returned line has a NEGATIVE `price` (its own incremental reduction),
 * `quantity` 1, and the snapshotted `percent`. `subtotal + Σ line.price` equals
 * the final discounted total, so the caller can derive the checkout total by
 * summing all line prices.
 */
export function computeDiscountLines(
  subtotal: number,
  discounts: Discount[],
): CheckoutLine[] {
  const ordered = [...discounts].sort((a, b) => a.order - b.order);
  let running = subtotal;
  const lines: CheckoutLine[] = [];

  for (const d of ordered) {
    const cut = round2(running * (d.percent / 100));
    running = round2(running - cut);
    lines.push({
      itemId: d.id,
      name: d.name,
      price: -cut,
      quantity: 1,
      percent: d.percent,
    });
  }

  return lines;
}
