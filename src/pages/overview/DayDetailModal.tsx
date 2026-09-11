import { useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { formatPrice } from '../../lib/format';
import type { Checkout } from '../../lib/types';
import { aggregateDayLines } from './dayDetail';

interface Props {
  /** The day to break down, or null when the modal is closed. */
  day: Date | null;
  /** Every checkout saved on that day, in save order. */
  checkouts: Checkout[];
  onClose: () => void;
}

const dayTitle = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const timeLabel = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * Read-only breakdown of a single day: what was counted per item, then every
 * checkout of that day line by line. All values come from the checkout
 * snapshots, so the numbers match what was charged even after a reprice.
 */
export function DayDetailModal({ day, checkouts, onClose }: Props) {
  const rows = useMemo(() => aggregateDayLines(checkouts), [checkouts]);
  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const dayMoney = checkouts.reduce((sum, c) => sum + c.total, 0);

  return (
    <Modal
      open={day !== null}
      onClose={onClose}
      title={day ? dayTitle(day) : ''}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* ── Per item ───────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 font-display text-[11px] font-bold uppercase tracking-widest text-white/40">
            Per item
          </h3>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-white/8 text-[10px] uppercase tracking-wider text-white/30">
                <th className="py-1.5 text-left font-semibold">Item</th>
                <th className="py-1.5 text-right font-semibold">Qty</th>
                <th className="py-1.5 text-right font-semibold">Unit</th>
                <th className="py-1.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.name} ${row.price}`} className="border-b border-white/5">
                  <td className="py-1.5 pr-2 text-white/70">{row.name}</td>
                  <td className="py-1.5 text-right text-white/60">{row.quantity}</td>
                  <td className="py-1.5 text-right text-white/40">
                    {formatPrice(row.price)}
                  </td>
                  <td
                    className={[
                      'py-1.5 text-right',
                      row.lineTotal < 0 ? 'text-amber-300/70' : 'text-white/70',
                    ].join(' ')}
                  >
                    {formatPrice(row.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/10 font-bold">
                <td className="py-2 text-white/50">Total</td>
                <td className="py-2 text-right text-white/60">{totalQuantity}</td>
                <td />
                <td className="py-2 text-right text-lime-300">{formatPrice(dayMoney)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ── Per checkout ───────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 font-display text-[11px] font-bold uppercase tracking-widest text-white/40">
            Per checkout ({checkouts.length})
          </h3>
          <ul className="space-y-2">
            {checkouts.map((checkout) => (
              <li
                key={checkout.id}
                className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-white/70">
                    {timeLabel(checkout.createdAt.toDate())}
                  </span>
                  <span className="font-bold tabular-nums text-lime-300/80">
                    {formatPrice(checkout.total)}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {checkout.lines.map((line, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 text-xs text-white/60"
                    >
                      <span className="min-w-0 truncate">
                        {line.name}
                        {line.percent !== undefined && (
                          <span className="ml-1.5 text-amber-300/60">
                            −{line.percent}%
                          </span>
                        )}
                        {line.holderName && (
                          <span className="ml-1.5 text-white/35">— {line.holderName}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        <span>×{line.quantity}</span>
                        <span className="text-white/40">@ {formatPrice(line.price)}</span>
                        <span
                          className={[
                            'w-20 text-right',
                            line.price < 0 ? 'text-amber-300/70' : 'text-white/70',
                          ].join(' ')}
                        >
                          {formatPrice(line.price * line.quantity)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
