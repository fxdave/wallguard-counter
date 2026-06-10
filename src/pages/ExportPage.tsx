import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useCheckouts } from '../lib/queries';
import { buildCheckoutCsv } from '../lib/csv';
import { toDateInputValue, fromDateInputValue } from '../lib/format';

function startOfDayAfter(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function defaultFrom(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function defaultTo(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export function ExportPage() {
  const [fromValue, setFromValue] = useState(() => toDateInputValue(defaultFrom()));
  const [toValue, setToValue] = useState(() => toDateInputValue(defaultTo()));

  const fromDate = useMemo(() => fromDateInputValue(fromValue), [fromValue]);
  const toDate = useMemo(() => fromDateInputValue(toValue), [toValue]);

  const rangeValid = fromDate <= toDate;

  const exclusiveTo = useMemo(
    () => (rangeValid ? startOfDayAfter(toDate) : toDate),
    [toDate, rangeValid],
  );

  const { data: checkouts, isLoading } = useCheckouts(
    rangeValid ? { from: fromDate, to: exclusiveTo } : undefined,
  );

  const totalRows = useMemo(
    () => (checkouts ?? []).reduce((sum, c) => sum + c.lines.length, 0),
    [checkouts],
  );

  const checkoutCount = checkouts?.length ?? 0;

  function handleExport() {
    if (!checkouts || totalRows === 0) return;
    const csv = buildCheckoutCsv(checkouts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkouts_${fromValue}_${toValue}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const canExport = rangeValid && !isLoading && totalRows > 0;

  return (
    <>
      <PageHeader
        title="Export"
        subtitle="Download checkout lines as CSV."
      />

      <div className="space-y-6">
        {/* Controls card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap gap-6">
            <div className="min-w-[160px] flex-1">
              <TextField
                label="From"
                type="date"
                value={fromValue}
                onChange={(e) => setFromValue(e.target.value)}
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <TextField
                label="To"
                type="date"
                value={toValue}
                onChange={(e) => setToValue(e.target.value)}
              />
            </div>
          </div>

          {!rangeValid && (
            <p className="mt-4 text-sm text-red-300/80">
              "From" date must be on or before "To" date.
            </p>
          )}
        </div>

        {/* Summary + export */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-sm text-white/40">Loading checkouts…</p>
            </motion.div>
          ) : rangeValid ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                {/* Stats */}
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                      Checkouts
                    </p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-white">
                      {checkoutCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                      CSV Rows
                    </p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-lime-300">
                      {totalRows}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                      Range
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      {fromValue} — {toValue}
                    </p>
                  </div>
                </div>

                {/* Export button */}
                <Button
                  variant="primary"
                  disabled={!canExport}
                  onClick={handleExport}
                >
                  {/* Download icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </Button>
              </div>

              {totalRows === 0 && !isLoading && (
                <p className="mt-4 text-sm text-white/40">
                  No checkouts found in this range.
                </p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
