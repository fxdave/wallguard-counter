import type { WeekdayStat } from '../../lib/stats';
import { formatPrice } from '../../lib/format';

/**
 * Which weekdays carry the range. Bars compare income per ACTIVE day, so a
 * month with five Mondays and four Tuesdays doesn't make Monday look busier
 * than it was; the raw totals sit beside each bar.
 */
export function WeekdayChart({ weekdays }: { weekdays: WeekdayStat[] }) {
  const max = Math.max(...weekdays.map((d) => d.revenuePerActiveDay), 0);

  return (
    <div className="space-y-2.5">
      {weekdays.map((day) => {
        const width = max > 0 ? (day.revenuePerActiveDay / max) * 100 : 0;
        const quiet = day.activeDays === 0;

        return (
          <div key={day.weekday} className="flex items-center gap-3">
            <span
              className={[
                'w-9 shrink-0 text-[11px] font-semibold',
                quiet ? 'text-white/25' : 'text-white/60',
              ].join(' ')}
            >
              {day.label}
            </span>

            <div className="h-5 min-w-0 flex-1 rounded-[4px] bg-white/[0.04]">
              <div
                className="h-full rounded-[4px] bg-lime-300/60"
                style={{ width: `${width}%` }}
              />
            </div>

            <div className="w-40 shrink-0 text-right leading-tight">
              {quiet ? (
                <span className="text-[11px] text-white/20">No activity</span>
              ) : (
                <>
                  <span className="text-[12px] font-bold tabular-nums text-white/80">
                    {formatPrice(day.revenuePerActiveDay)}
                  </span>
                  <span className="text-[10px] text-white/30"> / day</span>
                  <div className="text-[10px] tabular-nums text-white/35">
                    {formatPrice(day.revenue)} over {day.activeDays}{' '}
                    {day.activeDays === 1 ? 'day' : 'days'} · {day.quantity} items
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
