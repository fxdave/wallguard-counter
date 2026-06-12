import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Item } from '../../lib/types';
import { formatPrice } from '../../lib/format';

interface ItemCardProps {
  item: Item;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Optional pill shown next to the name (e.g. "PASS"). */
  badge?: string;
  /**
   * Overrides the price line. `undefined` falls back to the item's unit price;
   * `null` hides it. Used by pass items to show a running subtotal instead.
   */
  priceText?: string | null;
}

export function ItemCard({
  item,
  count,
  onIncrement,
  onDecrement,
  badge,
  priceText,
}: ItemCardProps) {
  const priceDisplay =
    priceText !== undefined
      ? priceText
      : item.price !== 0
        ? formatPrice(item.price)
        : null;
  const active = count > 0;
  // Track direction for count animation
  const [direction, setDirection] = useState<1 | -1>(1);

  function handleIncrement() {
    setDirection(1);
    onIncrement();
  }

  function handleDecrement() {
    if (count === 0) return;
    setDirection(-1);
    onDecrement();
  }

  return (
    <div
      className={[
        'relative flex items-center gap-2.5 rounded-2xl px-3 py-2 transition-all duration-200',
        active
          ? 'border border-lime-300/40 bg-lime-300 text-black shadow-[0_0_20px_rgba(190,242,100,0.25)]'
          : 'border border-white/10 bg-white/[0.03] text-white/80',
      ].join(' ')}
    >
      {/* Floating badge (e.g. "PASS") */}
      {badge && (
        <span
          className={[
            'pointer-events-none absolute right-2 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
            active ? 'bg-black/15 text-black/70' : 'bg-lime-300/15 text-lime-300',
          ].join(' ')}
        >
          {badge}
        </span>
      )}

      {/* Minus button */}
      <motion.button
        aria-label={`Decrease ${item.name}`}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.1 }}
        onClick={handleDecrement}
        disabled={count === 0}
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-all',
          active
            ? 'bg-black/10 text-black/70 hover:bg-black/20 disabled:opacity-30'
            : 'bg-white/5 text-white/30 hover:bg-white/10 disabled:opacity-20',
        ].join(' ')}
      >
        −
      </motion.button>

      {/* Center content */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
        {/* Animated count */}
        <div className="relative h-7 w-full overflow-hidden flex items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={count}
              initial={{ y: direction * 16, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: direction * -16, opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
              className={[
                'font-display text-2xl font-extrabold tabular-nums',
                active ? 'text-black' : 'text-white/40',
              ].join(' ')}
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Item icon + name */}
        <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full">
          {item.icon && <span className="text-base leading-none shrink-0">{item.icon}</span>}
          <span
            className={[
              'min-w-0 break-words text-center text-sm font-semibold leading-tight',
              active ? 'text-black' : 'text-white/70',
            ].join(' ')}
          >
            {item.name}
          </span>
        </div>

        {/* Price / subtotal */}
        {priceDisplay !== null && (
          <span
            className={[
              'text-xs font-medium',
              active ? 'text-black/60' : 'text-white/30',
            ].join(' ')}
          >
            {priceDisplay}
          </span>
        )}
      </div>

      {/* Plus button */}
      <motion.button
        aria-label={`Increase ${item.name}`}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.1 }}
        onClick={handleIncrement}
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-all',
          active
            ? 'bg-black/20 text-black hover:bg-black/30'
            : 'bg-lime-300/15 text-lime-300 hover:bg-lime-300/25',
        ].join(' ')}
      >
        +
      </motion.button>
    </div>
  );
}
