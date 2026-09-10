import type { CategoryStat, DiscountStat, ItemStat } from '../../lib/stats';
import { formatPrice } from '../../lib/format';

/** Income split by category, ordered by what earns most. */
export function CategoryBreakdown({
  categories,
  total,
}: {
  categories: CategoryStat[];
  total: number;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-white/30">Nothing counted in this range.</p>;
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const share = total > 0 ? (category.revenue / total) * 100 : 0;

        return (
          <div key={category.categoryId}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-white/75">
                <span className="mr-1.5 opacity-70">{category.icon}</span>
                {category.name}
              </span>
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-white/85">
                {formatPrice(category.revenue)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-1.5 min-w-0 flex-1 rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-lime-300/70"
                  style={{ width: `${share}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-white/35">
                {category.quantity} items · {Math.round(share)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Every item counted in the range, most valuable first. */
export function ItemTable({ items, total }: { items: ItemStat[]; total: number }) {
  if (items.length === 0) {
    return <p className="text-sm text-white/30">Nothing counted in this range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            <th scope="col" className="py-2 pr-3 font-semibold">Item</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Count</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Income</th>
            <th scope="col" className="w-32 py-2 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item) => {
            const share = total > 0 ? (item.revenue / total) * 100 : 0;

            return (
              <tr key={item.itemId} className="transition-colors hover:bg-white/[0.02]">
                <td className="py-2 pr-3">
                  <span className="mr-1.5 opacity-70">{item.icon}</span>
                  <span className="text-white/75">{item.name}</span>
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-white/70">
                  {item.quantity}
                </td>
                <td className="py-2 pr-3 text-right font-bold text-white/85">
                  {formatPrice(item.revenue)}
                </td>
                <td className="py-2">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-lime-300/50"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] text-white/35">
                      {Math.round(share)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** How often each discount was applied and what it gave away. */
export function DiscountBreakdown({ discounts }: { discounts: DiscountStat[] }) {
  if (discounts.length === 0) {
    return <p className="text-sm text-white/30">No discounts applied in this range.</p>;
  }

  return (
    <ul className="divide-y divide-white/5">
      {discounts.map((discount) => (
        <li
          key={discount.discountId}
          className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
        >
          <span className="truncate text-[13px] text-white/75">
            <span className="mr-1.5 opacity-70">💸</span>
            {discount.name}
            <span className="ml-1.5 text-[11px] text-white/35">{discount.percent}%</span>
          </span>
          <span className="shrink-0 text-right leading-tight">
            <span className="text-[12px] font-bold tabular-nums text-white/85">
              {discount.applications}×
            </span>
            <div className="text-[10px] tabular-nums text-white/35">
              −{formatPrice(discount.amount)}
            </div>
          </span>
        </li>
      ))}
    </ul>
  );
}
