import { useState, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { useCategories } from '../lib/queries';
import { useItems } from '../lib/queries';
import { useDiscounts } from '../lib/queries';
import { useCheckouts } from '../lib/queries';
import type { Category, Item } from '../lib/types';
import {
  startOfMonth,
  startOfNextMonth,
  daysInMonth,
  weekdayLabel,
  isWeekend,
  monthLabel,
  dayKey,
} from '../lib/format';
import { MonthTable } from './overview/MonthTable';

export function Overview() {
  const [month, setMonth] = useState<Date>(() => new Date());

  const from = useMemo(() => startOfMonth(month), [month]);
  const to = useMemo(() => startOfNextMonth(month), [month]);

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { data: items = [] } = useItems();
  const { data: discounts = [] } = useDiscounts();
  const { data: checkouts = [], isLoading: checkoutsLoading } = useCheckouts({ from, to });

  const days = useMemo(() => daysInMonth(month), [month]);

  // Discounts render as a synthetic "Discounts" category group at the bottom,
  // reusing the item-row rendering. Each discount line's `itemId` is its id, so
  // the totals map already counts applications per day.
  const DISCOUNTS_CATEGORY_ID = '__discounts__';
  const rowCategories = useMemo<Category[]>(() => {
    if (discounts.length === 0) return categories;
    return [
      ...categories,
      { id: DISCOUNTS_CATEGORY_ID, name: 'Discounts', icon: '💸', order: Infinity },
    ];
  }, [categories, discounts.length]);

  const rowItems = useMemo<Item[]>(() => {
    if (discounts.length === 0) return items;
    const discountRows: Item[] = discounts.map((d) => ({
      id: d.id,
      name: `${d.name} (${d.percent}%)`,
      icon: '💸',
      price: 0,
      categoryId: DISCOUNTS_CATEGORY_ID,
      order: d.order,
    }));
    return [...items, ...discountRows];
  }, [items, discounts]);

  /** itemId -> dayKey -> total quantity */
  const totals = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const checkout of checkouts) {
      const dk = dayKey(checkout.createdAt.toDate());
      for (const line of checkout.lines) {
        let dayMap = map.get(line.itemId);
        if (!dayMap) {
          dayMap = new Map<string, number>();
          map.set(line.itemId, dayMap);
        }
        dayMap.set(dk, (dayMap.get(dk) ?? 0) + line.quantity);
      }
    }
    return map;
  }, [checkouts]);

  const isLoading = catsLoading || checkoutsLoading;

  function shiftMonth(delta: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const todayKey = dayKey(new Date());

  return (
    <>
      <PageHeader title="Overview" subtitle="Items by category — one column per day.">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </Button>
          <span className="min-w-[9rem] text-center font-display text-sm font-semibold text-white/90">
            {monthLabel(month)}
          </span>
          <Button variant="ghost" onClick={() => shiftMonth(1)} aria-label="Next month">
            ›
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-sm text-white/30">
          Loading…
        </div>
      ) : categories.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-white/30">
          No categories yet.
        </div>
      ) : (
        <MonthTable
          categories={rowCategories}
          items={rowItems}
          days={days}
          totals={totals}
          todayKey={todayKey}
          weekdayLabel={weekdayLabel}
          isWeekend={isWeekend}
          dayKey={dayKey}
        />
      )}
    </>
  );
}
