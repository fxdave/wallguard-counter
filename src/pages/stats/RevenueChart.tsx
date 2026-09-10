import { useState } from 'react';
import type { BucketStat } from '../../lib/stats';
import { formatPrice } from '../../lib/format';

type Mode = 'period' | 'cumulative';

interface Props {
  buckets: BucketStat[];
  mode: Mode;
  /** Word for one bucket in the tooltip, e.g. "day" or "month". */
  unit: string;
}

const PLOT_HEIGHT = 200;

/**
 * Income over the selected range. One series, one y-axis: the toggle swaps
 * between per-bucket income (bars) and the running total (area + line) rather
 * than drawing both against two different scales.
 */
export function RevenueChart({ buckets, mode, unit }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const values = buckets.map((b) => (mode === 'period' ? b.revenue : b.cumulative));
  const max = Math.max(...values, 0);
  const scale = max > 0 ? (v: number) => (v / max) * 100 : () => 0;

  const active = hover !== null ? buckets[hover] : null;
  const labelStep = Math.ceil(buckets.length / 12);

  return (
    <div>
      {/* Plot */}
      <div className="relative" style={{ height: PLOT_HEIGHT }}>
        {/* Gridlines — recessive, three steps */}
        <div className="absolute inset-0">
          {[0, 0.5, 1].map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-white/[0.06]"
              style={{ top: `${t * 100}%` }}
            >
              <span className="absolute -top-2 right-0 bg-base/60 pl-1 text-[10px] tabular-nums text-white/25">
                {formatPrice(Math.round(max * (1 - t)))}
              </span>
            </div>
          ))}
        </div>

        {mode === 'period' ? (
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {buckets.map((bucket, i) => (
              <div
                key={bucket.key}
                className="flex-1 rounded-t-[4px] transition-colors"
                style={{
                  height: `${Math.max(scale(bucket.revenue), bucket.revenue > 0 ? 1.5 : 0)}%`,
                  backgroundColor:
                    hover === i ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.55)',
                }}
              />
            ))}
          </div>
        ) : (
          <>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon
                points={`0,100 ${areaPoints(values, scale)} 100,100`}
                fill="rgb(var(--accent) / 0.12)"
              />
              <polyline
                points={areaPoints(values, scale)}
                fill="none"
                stroke="rgb(var(--accent))"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {hover !== null && (
              <span
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300 ring-2 ring-base"
                style={{
                  left: `${xPercent(hover, values.length)}%`,
                  top: `${100 - scale(values[hover])}%`,
                }}
              />
            )}
          </>
        )}

        {/* Hover columns — one per bucket, wider than the mark itself */}
        <div className="absolute inset-0 flex">
          {buckets.map((bucket, i) => (
            <button
              key={bucket.key}
              type="button"
              tabIndex={-1}
              aria-label={`${bucket.label}: ${formatPrice(
                mode === 'period' ? bucket.revenue : bucket.cumulative,
              )}`}
              className="h-full flex-1 border-l border-transparent first:border-l-0 hover:border-white/20"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
            />
          ))}
        </div>

        {/* Tooltip */}
        {active && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/10 bg-elevated px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{
              left: `${Math.min(Math.max(xPercent(hover ?? 0, buckets.length), 8), 92)}%`,
            }}
          >
            <span className="font-semibold text-white/90">{active.label}</span>
            <span className="mx-1.5 text-white/20">|</span>
            <span className="font-bold tabular-nums text-lime-300">
              {formatPrice(mode === 'period' ? active.revenue : active.cumulative)}
            </span>
            <span className="ml-1.5 tabular-nums text-white/40">
              {active.checkouts} checkouts · {active.quantity} items
            </span>
          </div>
        )}
      </div>

      {/* X axis */}
      <div className="mt-2 flex border-t border-white/[0.08] pt-1.5">
        {buckets.map((bucket, i) => (
          <span
            key={bucket.key}
            className={[
              'min-w-0 flex-1 text-center text-[9px] tabular-nums',
              hover === i ? 'text-white/80' : 'text-white/30',
            ].join(' ')}
          >
            {i % labelStep === 0 || hover === i ? bucket.label : ''}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-white/30">
        {mode === 'period' ? `Income per ${unit}.` : 'Income accumulated across the range.'}
      </p>
    </div>
  );
}

/** Evenly spaced points across the full width, as `x,y` pairs in viewBox units. */
function areaPoints(values: number[], scale: (v: number) => number): string {
  return values
    .map((v, i) => `${xPercent(i, values.length)},${100 - scale(v)}`)
    .join(' ');
}

function xPercent(index: number, count: number): number {
  return count <= 1 ? 50 : (index / (count - 1)) * 100;
}
