import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { buildCheckoutCsv } from './csv';
import type { Checkout } from './types';

function checkout(iso: string, lines: Checkout['lines']): Checkout {
  return {
    id: iso,
    createdAt: Timestamp.fromDate(new Date(iso)),
    total: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    lines,
  };
}

describe('buildCheckoutCsv', () => {
  it('emits one row per line as name;quantity;ISO-date', () => {
    const csv = buildCheckoutCsv([
      checkout('2026-01-01T00:00:00.000Z', [
        { itemId: 'a', name: 'apple', price: 1, quantity: 2 },
      ]),
    ]);
    expect(csv).toBe('apple;2;2026-01-01T00:00:00.000Z');
  });

  it('orders rows by checkout date ascending', () => {
    const csv = buildCheckoutCsv([
      checkout('2026-03-01T00:00:00.000Z', [
        { itemId: 'b', name: 'banana', price: 1, quantity: 1 },
      ]),
      checkout('2026-01-01T00:00:00.000Z', [
        { itemId: 'a', name: 'apple', price: 1, quantity: 2 },
      ]),
    ]);
    expect(csv.split('\n')).toEqual([
      'apple;2;2026-01-01T00:00:00.000Z',
      'banana;1;2026-03-01T00:00:00.000Z',
    ]);
  });

  it('quotes fields containing the delimiter', () => {
    const csv = buildCheckoutCsv([
      checkout('2026-01-01T00:00:00.000Z', [
        { itemId: 'c', name: 'apple; green', price: 1, quantity: 1 },
      ]),
    ]);
    expect(csv).toBe('"apple; green";1;2026-01-01T00:00:00.000Z');
  });
});
