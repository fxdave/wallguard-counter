import type { Checkout } from './types';

/**
 * Build the export CSV body. One row per checkout line, formatted as
 * `name;quantity;ISO-date` using the checkout's creation date. Rows are ordered
 * by checkout date ascending. There is no header row (matches the spec sample).
 */
export function buildCheckoutCsv(checkouts: Checkout[]): string {
  return [...checkouts]
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
    .flatMap((checkout) => {
      const iso = checkout.createdAt.toDate().toISOString();
      return checkout.lines.map(
        (line) => `${escapeField(line.name)};${line.quantity};${iso}`,
      );
    })
    .join('\n');
}

/** Quote fields that contain the delimiter, quotes, or newlines (RFC-4180-ish). */
function escapeField(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
