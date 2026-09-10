import { describe, expect, it } from 'vitest';
import { formatPrice, formatPriceCompact } from './format';

const NBSP = '\u00A0';

describe('formatPrice', () => {
  it('appends the forint unit after a non-breaking space', () => {
    expect(formatPrice(500)).toBe(`500${NBSP}Ft`);
  });

  it('keeps the sign on negative amounts', () => {
    expect(formatPrice(-250)).toBe(`-250${NBSP}Ft`);
  });

  it('rounds to at most two decimals', () => {
    expect(formatPrice(1.005)).toBe(`1.01${NBSP}Ft`);
    expect(formatPrice(1.25)).toBe(`1.25${NBSP}Ft`);
  });
});

describe('formatPriceCompact', () => {
  it('leaves amounts under a thousand alone', () => {
    expect(formatPriceCompact(999)).toBe('999');
  });

  it('floors thousands instead of rounding', () => {
    expect(formatPriceCompact(130_999)).toBe('130k');
    expect(formatPriceCompact(1000)).toBe('1k');
  });

  it('keeps the sign', () => {
    expect(formatPriceCompact(-2500)).toBe('-2k');
  });

  it('omits the unit — the column header carries it', () => {
    expect(formatPriceCompact(130_000)).not.toContain('Ft');
  });
});
