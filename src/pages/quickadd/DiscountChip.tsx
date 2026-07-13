import { motion } from 'motion/react';
import type { Discount } from '../../lib/types';

interface DiscountChipProps {
  discount: Discount;
  active: boolean;
  onToggle: () => void;
}

/** A toggle chip for a percentage discount, mirroring ItemCard's active styling. */
export function DiscountChip({ discount, active, onToggle }: DiscountChipProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      aria-pressed={active}
      className={[
        'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200',
        active
          ? 'border border-lime-300/40 bg-lime-300 text-black shadow-[0_0_20px_rgb(var(--accent)/0.25)]'
          : 'border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]',
      ].join(' ')}
    >
      <span>{discount.name}</span>
      <span
        className={[
          'rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums',
          active ? 'bg-black/15 text-black/70' : 'bg-lime-300/15 text-lime-300',
        ].join(' ')}
      >
        −{discount.percent}%
      </span>
    </motion.button>
  );
}
