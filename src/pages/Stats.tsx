import { useMemo, useState, type ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useCategories, useCheckouts, useItems } from '../lib/queries';
import { computeRangeStats, pickGranularity } from '../lib/stats';
import { formatPrice } from '../lib/format';
import { useStatsRange, previousRange } from './stats/range';
import { ModeSwitch, RangeControls } from './stats/RangeControls';
import { RevenueChart } from './stats/RevenueChart';
import { WeekdayChart } from './stats/WeekdayChart';
import { CategoryBreakdown, DiscountBreakdown, ItemTable } from './stats/Breakdown';

export function Stats() {
  const range = useStatsRange();
  const [chartMode, setChartMode] = useState<'period' | 'cumulative'>('period');

  const { data: categories = [] } = useCategories();
  const { data: items = [] } = useItems();
  const { data: checkouts = [], isLoading } = useCheckouts(
    range.valid ? range.range : undefined,
  );

  const previous = useMemo(
    () => previousRange(range.range, range.mode),
    [range.range, range.mode],
  );
  const { data: previousCheckouts = [] } = useCheckouts(range.valid ? previous : undefined);

  const granularity = pickGranularity(range.range.from, range.range.to);

  const stats = useMemo(
    () =>
      computeRangeStats(
        checkouts,
        items,
        categories,
        range.range.from,
        range.range.to,
        granularity,
      ),
    [checkouts, items, categories, range.range, granularity],
  );

  const previousRevenue = useMemo(
    () => previousCheckouts.reduce((sum, c) => sum + c.total, 0),
    [previousCheckouts],
  );

  return (
    <>
      <PageHeader title="Stats" subtitle="Income, counts, and rhythm over a range.">
        <ModeSwitch mode={range.mode} setMode={range.setMode} />
      </PageHeader>

      <div className="space-y-5">
        <RangeControls range={range} />

        {!range.valid ? null : isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-white/30">
            Loading…
          </div>
        ) : (
          <>
            {/* Headline: what the range earned, and how that compares */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs font-medium text-white/40">Income · {range.label}</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-4xl font-extrabold tabular-nums text-lime-300">
                      {formatPrice(stats.revenue)}
                    </span>
                    <Delta current={stats.revenue} previous={previousRevenue} mode={range.mode} />
                  </div>
                </div>

                <dl className="flex flex-wrap gap-x-8 gap-y-4">
                  <Stat label="Checkouts" value={String(stats.checkoutCount)} />
                  <Stat label="Items counted" value={String(stats.itemQuantity)} />
                  <Stat
                    label="Discounts applied"
                    value={String(stats.discountApplications)}
                    note={`−${formatPrice(stats.discountAmount)} off ${formatPrice(stats.gross)}`}
                  />
                  <Stat
                    label="Active days"
                    value={String(stats.activeDays)}
                    note={
                      stats.activeDays > 0
                        ? `${formatPrice(stats.revenue / stats.activeDays)} / day`
                        : undefined
                    }
                  />
                </dl>
              </div>
            </div>

            {stats.checkoutCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
                <p className="font-display text-lg text-white/70">Nothing counted yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                  No checkouts fall in {range.label}. Pick another range, or count something
                  on Quick Add.
                </p>
              </div>
            ) : (
              <>
                <Card
                  title="Income over time"
                  action={
                    <div className="flex gap-1 rounded-lg border border-white/10 p-0.5">
                      {(['period', 'cumulative'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setChartMode(option)}
                          aria-pressed={chartMode === option}
                          className={[
                            'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                            chartMode === option
                              ? 'bg-white/10 text-white'
                              : 'text-white/40 hover:text-white/70',
                          ].join(' ')}
                        >
                          {option === 'period'
                            ? `Per ${granularity}`
                            : 'Running total'}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <RevenueChart
                    buckets={stats.buckets}
                    mode={chartMode}
                    unit={granularity}
                  />
                </Card>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card title="Weekday rhythm">
                    <WeekdayChart weekdays={stats.weekdays} />
                  </Card>

                  <div className="space-y-5">
                    <Card title="Categories">
                      <CategoryBreakdown
                        categories={stats.categories}
                        total={stats.gross}
                      />
                    </Card>
                    <Card title="Discounts">
                      <DiscountBreakdown discounts={stats.discounts} />
                    </Card>
                  </div>
                </div>

                <Card title="Items">
                  <ItemTable items={stats.items} total={stats.gross} />
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-bold text-white/80">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-white/40">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-bold tabular-nums text-white/90">
        {value}
      </dd>
      {note && <p className="text-[10px] tabular-nums text-white/30">{note}</p>}
    </div>
  );
}

const PREVIOUS_LABEL: Record<string, string> = {
  month: 'vs previous month',
  year: 'vs previous year',
  custom: 'vs preceding period',
};

/** Growth against the same-length window right before this one. */
function Delta({
  current,
  previous,
  mode,
}: {
  current: number;
  previous: number;
  mode: string;
}) {
  if (previous === 0) {
    return (
      <span className="text-[11px] text-white/30">
        No income in the {PREVIOUS_LABEL[mode].replace('vs ', '')}
      </span>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;

  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={[
          'rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
          up ? 'bg-lime-300/15 text-lime-300' : 'bg-red-400/15 text-red-300',
        ].join(' ')}
      >
        {up ? '▲' : '▼'} {Math.abs(Math.round(change))}%
      </span>
      <span className="text-[11px] text-white/30">
        {PREVIOUS_LABEL[mode]} ({formatPrice(previous)})
      </span>
    </span>
  );
}
