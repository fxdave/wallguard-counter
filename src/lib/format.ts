/** Formatting + date helpers shared across pages. */

const priceFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format a price as a plain localized number (currency-neutral). */
export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

/** `YYYY-MM-DD` key in LOCAL time — used to bucket checkouts by calendar day. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** First instant of the given month (local time). */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/** First instant of the NEXT month (exclusive upper bound for range queries). */
export function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

/** Every Date (local midnight) in the month containing `date`. */
export function daysInMonth(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short weekday label, e.g. "Mon". */
export function weekdayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

/** True for Saturday / Sunday — used to tint weekend columns. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** "June 2026" style month + year label. */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** `YYYY-MM-DD` for <input type="date"> values. */
export function toDateInputValue(date: Date): string {
  return dayKey(date);
}

/** Parse a `YYYY-MM-DD` input value into a local Date at midnight. */
export function fromDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
