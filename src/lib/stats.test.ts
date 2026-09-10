import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  bucketStarts,
  computeRangeStats,
  pickGranularity,
  weekdayIndex,
} from './stats';
import type { Category, Checkout, Item } from './types';

function checkout(local: string, lines: Checkout['lines']): Checkout {
  return {
    id: local,
    createdAt: Timestamp.fromDate(new Date(local)),
    total: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    lines,
  };
}

const items: Item[] = [
  { id: 'beer', name: 'Beer', icon: '🍺', price: 500, categoryId: 'drinks', order: 1000 },
  { id: 'chips', name: 'Chips', icon: '🍟', price: 300, categoryId: 'snacks', order: 1000 },
];

const categories: Category[] = [
  { id: 'drinks', name: 'Drinks', icon: '🥤', order: 1000 },
  { id: 'snacks', name: 'Snacks', icon: '🍿', order: 2000 },
];

const from = new Date(2026, 8, 1);
const to = new Date(2026, 9, 1);

describe('computeRangeStats', () => {
  it('sums net revenue, gross, and discount amount separately', () => {
    const stats = computeRangeStats(
      [
        checkout('2026-09-02T10:00', [
          { itemId: 'beer', name: 'Beer', price: 500, quantity: 2 },
          { itemId: 'half', name: 'Half off', price: -500, quantity: 1, percent: 50 },
        ]),
      ],
      items,
      categories,
      from,
      to,
    );

    expect(stats.gross).toBe(1000);
    expect(stats.discountAmount).toBe(500);
    expect(stats.revenue).toBe(500);
    expect(stats.checkoutCount).toBe(1);
    expect(stats.itemQuantity).toBe(2);
  });

  it('counts discount applications per discount', () => {
    const stats = computeRangeStats(
      [
        checkout('2026-09-02T10:00', [
          { itemId: 'beer', name: 'Beer', price: 500, quantity: 1 },
          { itemId: 'half', name: 'Half off', price: -250, quantity: 1, percent: 50 },
        ]),
        checkout('2026-09-03T10:00', [
          { itemId: 'beer', name: 'Beer', price: 500, quantity: 1 },
          { itemId: 'half', name: 'Half off', price: -250, quantity: 1, percent: 50 },
        ]),
      ],
      items,
      categories,
      from,
      to,
    );

    expect(stats.discountApplications).toBe(2);
    expect(stats.discounts).toEqual([
      { discountId: 'half', name: 'Half off', percent: 50, applications: 2, amount: 500 },
    ]);
  });

  it('uses the snapshotted line name, not the current item name', () => {
    const stats = computeRangeStats(
      [
        checkout('2026-09-02T10:00', [
          { itemId: 'beer', name: 'Old Beer Name', price: 400, quantity: 1 },
        ]),
      ],
      items,
      categories,
      from,
      to,
    );

    expect(stats.items[0]).toMatchObject({ name: 'Old Beer Name', revenue: 400 });
  });

  it('groups items into categories and drops empty ones', () => {
    const stats = computeRangeStats(
      [
        checkout('2026-09-02T10:00', [
          { itemId: 'beer', name: 'Beer', price: 500, quantity: 2 },
          { itemId: 'chips', name: 'Chips', price: 300, quantity: 1 },
        ]),
      ],
      items,
      categories,
      from,
      to,
    );

    expect(stats.categories.map((c) => [c.name, c.revenue, c.quantity])).toEqual([
      ['Drinks', 1000, 2],
      ['Snacks', 300, 1],
    ]);
  });

  it('files lines from deleted items under Other', () => {
    const stats = computeRangeStats(
      [checkout('2026-09-02T10:00', [{ itemId: 'gone', name: 'Gone', price: 100, quantity: 1 }])],
      items,
      categories,
      from,
      to,
    );

    expect(stats.categories).toHaveLength(1);
    expect(stats.categories[0].name).toBe('Other');
  });

  it('keeps empty buckets and accumulates a running total', () => {
    const stats = computeRangeStats(
      [
        checkout('2026-09-01T10:00', [{ itemId: 'beer', name: 'Beer', price: 500, quantity: 1 }]),
        checkout('2026-09-03T10:00', [{ itemId: 'beer', name: 'Beer', price: 200, quantity: 1 }]),
      ],
      items,
      categories,
      from,
      to,
      'day',
    );

    expect(stats.buckets).toHaveLength(30);
    expect(stats.buckets.slice(0, 3).map((b) => [b.revenue, b.cumulative])).toEqual([
      [500, 500],
      [0, 500],
      [200, 700],
    ]);
    expect(stats.buckets.at(-1)?.cumulative).toBe(700);
  });

  it('accumulates weekdays and counts active days once per calendar day', () => {
    const stats = computeRangeStats(
      [
        // Both on Tuesday 2026-09-01.
        checkout('2026-09-01T10:00', [{ itemId: 'beer', name: 'Beer', price: 500, quantity: 1 }]),
        checkout('2026-09-01T18:00', [{ itemId: 'beer', name: 'Beer', price: 300, quantity: 2 }]),
        // Tuesday a week later.
        checkout('2026-09-08T10:00', [{ itemId: 'beer', name: 'Beer', price: 200, quantity: 1 }]),
      ],
      items,
      categories,
      from,
      to,
    );

    const tuesday = stats.weekdays[1];
    expect(tuesday.weekday).toBe(2);
    expect(tuesday.revenue).toBe(1300);
    expect(tuesday.checkouts).toBe(3);
    expect(tuesday.quantity).toBe(4);
    expect(tuesday.activeDays).toBe(2);
    expect(tuesday.revenuePerActiveDay).toBe(650);
    expect(stats.activeDays).toBe(2);
    expect(stats.weekdays[0].revenuePerActiveDay).toBe(0);
  });

  it('buckets by month over a long range', () => {
    const stats = computeRangeStats(
      [
        checkout('2026-01-15T10:00', [{ itemId: 'beer', name: 'Beer', price: 500, quantity: 1 }]),
        checkout('2026-03-02T10:00', [{ itemId: 'beer', name: 'Beer', price: 100, quantity: 1 }]),
      ],
      items,
      categories,
      new Date(2026, 0, 1),
      new Date(2027, 0, 1),
    );

    expect(stats.buckets).toHaveLength(12);
    expect(stats.buckets[0].key).toBe('2026-01');
    expect(stats.buckets[2].revenue).toBe(100);
    expect(stats.buckets.at(-1)?.cumulative).toBe(600);
  });
});

describe('pickGranularity', () => {
  it('uses days up to two months and months beyond', () => {
    expect(pickGranularity(new Date(2026, 8, 1), new Date(2026, 9, 1))).toBe('day');
    expect(pickGranularity(new Date(2026, 0, 1), new Date(2027, 0, 1))).toBe('month');
  });
});

describe('bucketStarts', () => {
  it('is half-open on the end date', () => {
    const days = bucketStarts(new Date(2026, 8, 1), new Date(2026, 8, 4), 'day');
    expect(days.map((d) => d.getDate())).toEqual([1, 2, 3]);
  });
});

describe('weekdayIndex', () => {
  it('is Monday-first', () => {
    expect(weekdayIndex(new Date(2026, 8, 7))).toBe(1);
    expect(weekdayIndex(new Date(2026, 8, 13))).toBe(7);
  });
});
