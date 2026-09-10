/**
 * Pure aggregation for the Stats page. Everything here reads SNAPSHOTTED
 * checkout line data (`name`, `price`) so historical numbers stay correct after
 * an item is renamed, repriced, or deleted — see the snapshot-on-write rule.
 *
 * The one live lookup is `categoryId`: it is not snapshotted on the line, so
 * items are grouped through the current item list and fall back to "Other".
 */
import type { Category, Checkout, CheckoutLine, Item } from './types';
import { dayKey } from './format';

/** A discount line carries a snapshotted `percent` and a negative price. */
export function isDiscountLine(line: CheckoutLine): boolean {
  return line.percent !== undefined;
}

export interface ItemStat {
  itemId: string;
  name: string;
  icon: string;
  categoryId: string;
  quantity: number;
  revenue: number;
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  icon: string;
  quantity: number;
  revenue: number;
  items: ItemStat[];
}

export interface DiscountStat {
  discountId: string;
  name: string;
  /** Most recently seen snapshotted percent. */
  percent: number;
  /** How many times the discount was applied in the range. */
  applications: number;
  /** Money taken off by this discount, as a positive number. */
  amount: number;
}

export type Granularity = 'day' | 'month';

export interface BucketStat {
  /** `YYYY-MM-DD` for days, `YYYY-MM` for months. */
  key: string;
  label: string;
  start: Date;
  revenue: number;
  checkouts: number;
  quantity: number;
  /** Range revenue accumulated up to and including this bucket. */
  cumulative: number;
}

export interface WeekdayStat {
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  label: string;
  revenue: number;
  checkouts: number;
  quantity: number;
  /** Calendar days of this weekday that had at least one checkout. */
  activeDays: number;
  /** `revenue / activeDays`, or 0 when the weekday never saw a checkout. */
  revenuePerActiveDay: number;
}

export interface RangeStats {
  /** Net income — what was actually taken, discounts already deducted. */
  revenue: number;
  /** Income before discounts. */
  gross: number;
  /** Total money given away by discounts, as a positive number. */
  discountAmount: number;
  checkoutCount: number;
  /** Units counted across item lines (discount lines excluded). */
  itemQuantity: number;
  discountApplications: number;
  /** Calendar days in the range that had at least one checkout. */
  activeDays: number;
  items: ItemStat[];
  categories: CategoryStat[];
  discounts: DiscountStat[];
  buckets: BucketStat[];
  weekdays: WeekdayStat[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `YYYY-MM` key in local time. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Day buckets up to ~2 months, monthly buckets beyond that. */
export function pickGranularity(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return days <= 62 ? 'day' : 'month';
}

/** Every bucket start in `[from, to)`, so empty days/months still render. */
export function bucketStarts(from: Date, to: Date, granularity: Granularity): Date[] {
  const out: Date[] = [];
  const cursor =
    granularity === 'day'
      ? new Date(from.getFullYear(), from.getMonth(), from.getDate())
      : new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor < to) {
    out.push(new Date(cursor));
    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const monthOnlyLabel = new Intl.DateTimeFormat(undefined, { month: 'short' });
const monthYearLabel = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

function bucketLabel(date: Date, granularity: Granularity, spansYears: boolean): string {
  if (granularity === 'day') return dayLabel.format(date);
  return spansYears ? monthYearLabel.format(date) : monthOnlyLabel.format(date);
}

/** Monday-first weekday index, 1–7. */
export function weekdayIndex(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function weekdayLabels(): string[] {
  // 2024-01-01 was a Monday, so this walks Mon…Sun in the user's locale.
  return Array.from({ length: 7 }, (_, i) =>
    weekdayFormat.format(new Date(2024, 0, 1 + i)),
  );
}

/**
 * Aggregate every number the Stats page shows from one pass over `checkouts`.
 * `from`/`to` are the half-open range the checkouts were fetched for; they only
 * shape the bucket axis, so empty periods still appear.
 */
export function computeRangeStats(
  checkouts: Checkout[],
  items: Item[],
  categories: Category[],
  from: Date,
  to: Date,
  granularity: Granularity = pickGranularity(from, to),
): RangeStats {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const spansYears = from.getFullYear() !== new Date(to.getTime() - 1).getFullYear();

  const buckets = new Map<string, BucketStat>();
  for (const start of bucketStarts(from, to, granularity)) {
    const key = granularity === 'day' ? dayKey(start) : monthKey(start);
    buckets.set(key, {
      key,
      label: bucketLabel(start, granularity, spansYears),
      start,
      revenue: 0,
      checkouts: 0,
      quantity: 0,
      cumulative: 0,
    });
  }

  const itemStats = new Map<string, ItemStat>();
  const discountStats = new Map<string, DiscountStat>();
  const weekdays: WeekdayStat[] = weekdayLabels().map((label, i) => ({
    weekday: i + 1,
    label,
    revenue: 0,
    checkouts: 0,
    quantity: 0,
    activeDays: 0,
    revenuePerActiveDay: 0,
  }));
  const weekdayActiveDays = weekdays.map(() => new Set<string>());
  const activeDays = new Set<string>();

  let revenue = 0;
  let gross = 0;
  let discountAmount = 0;
  let itemQuantity = 0;
  let discountApplications = 0;

  for (const checkout of checkouts) {
    const date = checkout.createdAt.toDate();
    const dk = dayKey(date);
    activeDays.add(dk);

    revenue += checkout.total;

    const bucket = buckets.get(granularity === 'day' ? dk : monthKey(date));
    if (bucket) {
      bucket.revenue += checkout.total;
      bucket.checkouts += 1;
    }

    const weekday = weekdays[weekdayIndex(date) - 1];
    weekday.revenue += checkout.total;
    weekday.checkouts += 1;
    weekdayActiveDays[weekdayIndex(date) - 1].add(dk);

    for (const line of checkout.lines) {
      const amount = line.price * line.quantity;

      if (isDiscountLine(line)) {
        discountAmount += -amount;
        discountApplications += line.quantity;

        const existing = discountStats.get(line.itemId);
        if (existing) {
          existing.applications += line.quantity;
          existing.amount = round2(existing.amount + -amount);
        } else {
          discountStats.set(line.itemId, {
            discountId: line.itemId,
            name: line.name,
            percent: line.percent ?? 0,
            applications: line.quantity,
            amount: round2(-amount),
          });
        }
        continue;
      }

      gross += amount;
      itemQuantity += line.quantity;
      if (bucket) bucket.quantity += line.quantity;
      weekday.quantity += line.quantity;

      const existing = itemStats.get(line.itemId);
      if (existing) {
        existing.quantity += line.quantity;
        existing.revenue = round2(existing.revenue + amount);
      } else {
        const live = itemById.get(line.itemId);
        itemStats.set(line.itemId, {
          itemId: line.itemId,
          name: line.name,
          icon: live?.icon ?? '·',
          categoryId: live?.categoryId ?? UNCATEGORIZED_ID,
          quantity: line.quantity,
          revenue: round2(amount),
        });
      }
    }
  }

  const orderedBuckets = [...buckets.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  let running = 0;
  for (const bucket of orderedBuckets) {
    bucket.revenue = round2(bucket.revenue);
    running = round2(running + bucket.revenue);
    bucket.cumulative = running;
  }

  weekdays.forEach((day, i) => {
    day.revenue = round2(day.revenue);
    day.activeDays = weekdayActiveDays[i].size;
    day.revenuePerActiveDay = day.activeDays
      ? round2(day.revenue / day.activeDays)
      : 0;
  });

  const itemList = [...itemStats.values()].sort(
    (a, b) => b.revenue - a.revenue || b.quantity - a.quantity,
  );

  return {
    revenue: round2(revenue),
    gross: round2(gross),
    discountAmount: round2(discountAmount),
    checkoutCount: checkouts.length,
    itemQuantity,
    discountApplications,
    activeDays: activeDays.size,
    items: itemList,
    categories: groupByCategory(itemList, categories),
    discounts: [...discountStats.values()].sort((a, b) => b.applications - a.applications),
    buckets: orderedBuckets,
    weekdays,
  };
}

/** Bucket for lines whose item no longer exists (so has no category). */
export const UNCATEGORIZED_ID = '__uncategorized__';

function groupByCategory(items: ItemStat[], categories: Category[]): CategoryStat[] {
  const stats = new Map<string, CategoryStat>();

  for (const category of categories) {
    stats.set(category.id, {
      categoryId: category.id,
      name: category.name,
      icon: category.icon,
      quantity: 0,
      revenue: 0,
      items: [],
    });
  }

  for (const item of items) {
    let stat = stats.get(item.categoryId);
    if (!stat) {
      stat = {
        categoryId: item.categoryId,
        name: 'Other',
        icon: '·',
        quantity: 0,
        revenue: 0,
        items: [],
      };
      stats.set(item.categoryId, stat);
    }
    stat.quantity += item.quantity;
    stat.revenue = round2(stat.revenue + item.revenue);
    stat.items.push(item);
  }

  return [...stats.values()]
    .filter((c) => c.items.length > 0)
    .sort((a, b) => b.revenue - a.revenue);
}
