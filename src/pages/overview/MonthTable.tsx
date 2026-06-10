import type { Category, Item } from '../../lib/types';

interface Props {
  categories: Category[];
  items: Item[];
  days: Date[];
  /** itemId -> dayKey -> quantity total */
  totals: Map<string, Map<string, number>>;
  todayKey: string;
  weekdayLabel: (d: Date) => string;
  isWeekend: (d: Date) => boolean;
  dayKey: (d: Date) => string;
}

export function MonthTable({
  categories,
  items,
  days,
  totals,
  todayKey,
  weekdayLabel,
  isWeekend,
  dayKey,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
      <table
        className="w-full border-collapse text-xs tabular-nums"
        style={{ minWidth: `${200 + days.length * 40}px` }}
      >
        {/* ── Column group: sticky name + day columns ─────────────────────── */}
        <colgroup>
          {/* sticky item name column */}
          <col style={{ width: '200px', minWidth: '200px' }} />
          {days.map((d) => (
            <col key={dayKey(d)} style={{ width: '38px', minWidth: '38px' }} />
          ))}
          {/* row total column */}
          <col style={{ width: '48px', minWidth: '48px' }} />
        </colgroup>

        {/* ── Header: weekday + day number ────────────────────────────────── */}
        <thead>
          <tr className="border-b border-white/8">
            {/* top-left corner — sticky */}
            <th
              className="sticky left-0 z-20 border-r border-white/8 bg-[#0d0d12] px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30"
              scope="col"
            >
              Item
            </th>

            {days.map((d) => {
              const dk = dayKey(d);
              const weekend = isWeekend(d);
              const isToday = dk === todayKey;
              return (
                <th
                  key={dk}
                  scope="col"
                  className={[
                    'border-r border-white/5 py-1.5 text-center align-bottom',
                    weekend ? 'text-white/25' : 'text-white/40',
                    isToday ? 'text-lime-300' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="flex flex-col items-center gap-0.5 leading-none">
                    <span
                      className={[
                        'text-[9px] font-medium uppercase tracking-wider',
                        isToday ? 'text-lime-300/80' : 'text-white/25',
                      ].join(' ')}
                    >
                      {weekdayLabel(d)}
                    </span>
                    <span
                      className={[
                        'text-[11px] font-bold',
                        isToday
                          ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-lime-300 text-black'
                          : weekend
                            ? 'text-white/25'
                            : 'text-white/60',
                      ].join(' ')}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                </th>
              );
            })}

            {/* row total header */}
            <th
              scope="col"
              className="py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white/25"
            >
              Total
            </th>
          </tr>
        </thead>

        {/* ── Body: categories + items ─────────────────────────────────────── */}
        <tbody className="divide-y divide-white/5">
          {categories.map((cat) => {
            const catItems = items.filter((item) => item.categoryId === cat.id);

            return (
              <CategorySection
                key={cat.id}
                category={cat}
                items={catItems}
                days={days}
                totals={totals}
                todayKey={todayKey}
                isWeekend={isWeekend}
                dayKey={dayKey}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

interface CategorySectionProps {
  category: Category;
  items: Item[];
  days: Date[];
  totals: Map<string, Map<string, number>>;
  todayKey: string;
  isWeekend: (d: Date) => boolean;
  dayKey: (d: Date) => string;
}

function CategorySection({
  category,
  items,
  days,
  totals,
  todayKey,
  isWeekend,
  dayKey,
}: CategorySectionProps) {
  return (
    <>
      {/* Category header row */}
      <tr className="border-t-2 border-white/10 bg-white/[0.025]">
        <td
          colSpan={days.length + 2}
          className="sticky left-0 z-10 bg-white/[0.025] px-4 py-1.5"
        >
          <span className="font-display text-[11px] font-bold uppercase tracking-widest text-white/50">
            <span className="mr-1.5 opacity-70">{category.icon}</span>
            {category.name}
          </span>
        </td>
      </tr>

      {/* Item rows */}
      {items.length === 0 ? (
        <tr>
          <td className="sticky left-0 z-10 border-r border-white/5 bg-[#0d0d12] px-4 py-2 text-white/20 italic">
            No items
          </td>
          {days.map((d) => (
            <td key={dayKey(d)} className="border-r border-white/5 px-0.5 py-1.5 text-center" />
          ))}
          <td />
        </tr>
      ) : (
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            days={days}
            dayTotals={totals.get(item.id)}
            todayKey={todayKey}
            isWeekend={isWeekend}
            dayKey={dayKey}
          />
        ))
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

interface ItemRowProps {
  item: Item;
  days: Date[];
  dayTotals: Map<string, number> | undefined;
  todayKey: string;
  isWeekend: (d: Date) => boolean;
  dayKey: (d: Date) => string;
}

function ItemRow({ item, days, dayTotals, todayKey, isWeekend, dayKey }: ItemRowProps) {
  const rowTotal = dayTotals
    ? Array.from(dayTotals.values()).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <tr className="group transition-colors hover:bg-white/[0.015]">
      {/* Sticky item label */}
      <td className="sticky left-0 z-10 border-r border-white/5 bg-[#0d0d12] px-4 py-1.5 group-hover:bg-[#0f0f14]">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="text-[13px] leading-none opacity-80">{item.icon}</span>
          <span className="truncate text-[11px] font-medium text-white/70">{item.name}</span>
        </div>
      </td>

      {/* Day cells */}
      {days.map((d) => {
        const dk = dayKey(d);
        const val = dayTotals?.get(dk) ?? 0;
        const weekend = isWeekend(d);
        const isToday = dk === todayKey;

        return (
          <td
            key={dk}
            className={[
              'border-r border-white/5 px-0.5 py-1.5 text-center leading-none',
              weekend ? 'bg-white/[0.012]' : '',
              isToday ? 'bg-lime-300/[0.03]' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {val === 0 ? (
              <span className="text-[11px] text-white/10">·</span>
            ) : (
              <CellValue value={val} />
            )}
          </td>
        );
      })}

      {/* Row total */}
      <td className="py-1.5 text-center">
        {rowTotal === 0 ? (
          <span className="text-[11px] text-white/15">—</span>
        ) : (
          <span className="text-[11px] font-semibold text-white/50">{rowTotal}</span>
        )}
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

/** Renders a non-zero cell value with lime emphasis for larger counts. */
function CellValue({ value }: { value: number }) {
  if (value >= 10) {
    return (
      <span className="inline-flex items-center justify-center rounded bg-lime-300/10 px-1 text-[11px] font-bold text-lime-300">
        {value}
      </span>
    );
  }
  if (value >= 5) {
    return <span className="text-[11px] font-semibold text-lime-300/70">{value}</span>;
  }
  return <span className="text-[11px] font-medium text-white/75">{value}</span>;
}
