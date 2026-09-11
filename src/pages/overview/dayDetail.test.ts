import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { aggregateDayLines } from './dayDetail';
import type { Checkout } from '../../lib/types';

function checkout(local: string, lines: Checkout['lines']): Checkout {
  return {
    id: local,
    createdAt: Timestamp.fromDate(new Date(local)),
    total: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    lines,
  };
}

describe('aggregateDayLines', () => {
  it('sums quantity and money per snapshotted name and price', () => {
    const rows = aggregateDayLines([
      checkout('2026-08-24T19:44', [
        { itemId: 'entry', name: 'Napi Belépő - Felnőtt', price: 3000, quantity: 4 },
      ]),
      checkout('2026-08-24T19:53', [
        { itemId: 'entry', name: 'Napi Belépő - Felnőtt', price: 3000, quantity: 1 },
      ]),
    ]);

    expect(rows).toEqual([
      { name: 'Napi Belépő - Felnőtt', price: 3000, quantity: 5, lineTotal: 15000 },
    ]);
  });

  it('keeps a renamed or repriced item apart instead of merging it', () => {
    const rows = aggregateDayLines([
      checkout('2026-08-24T10:00', [
        { itemId: 'entry', name: 'Day pass', price: 3000, quantity: 1 },
        { itemId: 'entry', name: 'Day pass', price: 3500, quantity: 2 },
      ]),
    ]);

    expect(rows).toEqual([
      { name: 'Day pass', price: 3500, quantity: 2, lineTotal: 7000 },
      { name: 'Day pass', price: 3000, quantity: 1, lineTotal: 3000 },
    ]);
  });

  it('keeps zero-price pass usages as rows', () => {
    const rows = aggregateDayLines([
      checkout('2026-08-24T00:00', [
        {
          itemId: 'pass10',
          name: 'Felnőtt - 10 Alkalmas bérlet',
          price: 0,
          quantity: 1,
          holderName: 'Glattfelder György',
        },
      ]),
    ]);

    expect(rows).toEqual([
      { name: 'Felnőtt - 10 Alkalmas bérlet', price: 0, quantity: 1, lineTotal: 0 },
    ]);
  });

  it('orders rows by line total descending, discount rows last', () => {
    const rows = aggregateDayLines([
      checkout('2026-08-24T12:00', [
        { itemId: 'harness', name: 'Beülő', price: 500, quantity: 2 },
        { itemId: 'entry', name: 'Napi Belépő', price: 3000, quantity: 1 },
        { itemId: 'half', name: 'Half off', price: -500, quantity: 1, percent: 50 },
        { itemId: 'pass', name: 'Falmester', price: 0, quantity: 1 },
      ]),
    ]);

    expect(rows.map((r) => r.name)).toEqual([
      'Napi Belépő',
      'Beülő',
      'Falmester',
      'Half off',
    ]);
  });

  it('returns no rows for a day without checkouts', () => {
    expect(aggregateDayLines([])).toEqual([]);
  });
});
