import { useMemo, useState } from 'react';
import { toDateInputValue, fromDateInputValue, monthLabel } from '../../lib/format';

export type RangeMode = 'month' | 'year' | 'custom';

export interface DateRange {
  /** Inclusive start. */
  from: Date;
  /** Exclusive end — matches how checkouts are queried. */
  to: Date;
}

/** The window of the same length ending where `range` begins. */
export function previousRange(range: DateRange, mode: RangeMode): DateRange {
  if (mode === 'month') {
    return {
      from: new Date(range.from.getFullYear(), range.from.getMonth() - 1, 1),
      to: range.from,
    };
  }
  if (mode === 'year') {
    return { from: new Date(range.from.getFullYear() - 1, 0, 1), to: range.from };
  }
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: range.from };
}

/** Start of the day after `date` — turns an inclusive picker into a half-open range. */
function startOfDayAfter(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/**
 * Range selection for the Stats page: a whole month, a whole year, or two
 * dates. Month and year step with the arrows; custom uses the date fields.
 */
export function useStatsRange() {
  const [mode, setMode] = useState<RangeMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [customFrom, setCustomFrom] = useState(() =>
    toDateInputValue(new Date(new Date().getFullYear(), 0, 1)),
  );
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));

  const customFromDate = useMemo(() => fromDateInputValue(customFrom), [customFrom]);
  const customToDate = useMemo(() => fromDateInputValue(customTo), [customTo]);
  const customValid = customFromDate <= customToDate;

  const range = useMemo<DateRange>(() => {
    if (mode === 'month') {
      return {
        from: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
        to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1),
      };
    }
    if (mode === 'year') {
      return {
        from: new Date(anchor.getFullYear(), 0, 1),
        to: new Date(anchor.getFullYear() + 1, 0, 1),
      };
    }
    return { from: customFromDate, to: startOfDayAfter(customToDate) };
  }, [mode, anchor, customFromDate, customToDate]);

  const label = useMemo(() => {
    if (mode === 'month') return monthLabel(anchor);
    if (mode === 'year') return String(anchor.getFullYear());
    return `${customFrom} — ${customTo}`;
  }, [mode, anchor, customFrom, customTo]);

  function shift(delta: number) {
    setAnchor((prev) =>
      mode === 'year'
        ? new Date(prev.getFullYear() + delta, 0, 1)
        : new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  return {
    mode,
    setMode,
    shift,
    range,
    label,
    valid: mode !== 'custom' || customValid,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
  };
}

export type StatsRangeState = ReturnType<typeof useStatsRange>;
