import { describe, it, expect } from 'vitest';
import { computeDiscountLines } from './discounts';
import type { Discount } from './types';

const disc = (id: string, percent: number, order: number): Discount => ({
  id,
  name: `D${id}`,
  percent,
  order,
});

/** Final total = subtotal + sum of all discount line prices. */
const totalFrom = (subtotal: number, lines: { price: number }[]) =>
  subtotal + lines.reduce((s, l) => s + l.price, 0);

describe('computeDiscountLines', () => {
  it('returns no lines when there are no discounts', () => {
    expect(computeDiscountLines(3000, [])).toEqual([]);
  });

  it('applies a single discount as a negative line', () => {
    const lines = computeDiscountLines(3000, [disc('a', 50, 1000)]);
    expect(lines).toEqual([
      { itemId: 'a', name: 'Da', price: -1500, quantity: 1, percent: 50 },
    ]);
    expect(totalFrom(3000, lines)).toBe(1500);
  });

  it('stacks multiplicatively in order (3000 → 10% → 20% = 2160)', () => {
    const lines = computeDiscountLines(3000, [
      disc('staff', 10, 1000),
      disc('promo', 20, 2000),
    ]);
    expect(lines.map((l) => l.price)).toEqual([-300, -540]);
    expect(totalFrom(3000, lines)).toBe(2160);
  });

  it('applies discounts by `order`, not array position', () => {
    const byPosition = computeDiscountLines(1000, [
      disc('b', 20, 2000),
      disc('a', 10, 1000),
    ]);
    // 'a' (order 1000) applies first: 1000 → -100 → 900 → -180 → 720
    expect(byPosition.map((l) => [l.itemId, l.price])).toEqual([
      ['a', -100],
      ['b', -180],
    ]);
    expect(totalFrom(1000, byPosition)).toBe(720);
  });

  it('rounds each reduction to 2 decimals', () => {
    const lines = computeDiscountLines(10.99, [disc('a', 33, 1000)]);
    expect(lines[0].price).toBe(-3.63); // round2(10.99 * 0.33) = 3.6267 → 3.63
  });
});
