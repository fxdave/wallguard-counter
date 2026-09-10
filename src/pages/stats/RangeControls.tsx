import { TextField } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import type { RangeMode, StatsRangeState } from './range';

const MODES: { value: RangeMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

export function ModeSwitch({ mode, setMode }: Pick<StatsRangeState, 'mode' | 'setMode'>) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {MODES.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setMode(option.value)}
          aria-pressed={mode === option.value}
          className={[
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            mode === option.value
              ? 'bg-lime-300 text-black'
              : 'text-white/50 hover:text-white',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function RangeControls({ range }: { range: StatsRangeState }) {
  if (range.mode === 'custom') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[160px] flex-1">
            <TextField
              label="From"
              type="date"
              value={range.customFrom}
              onChange={(e) => range.setCustomFrom(e.target.value)}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <TextField
              label="To"
              type="date"
              value={range.customTo}
              onChange={(e) => range.setCustomTo(e.target.value)}
            />
          </div>
        </div>
        {!range.valid && (
          <p className="mt-3 text-sm text-red-300/80">
            "From" date must be on or before "To" date.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        onClick={() => range.shift(-1)}
        aria-label={range.mode === 'year' ? 'Previous year' : 'Previous month'}
      >
        ‹
      </Button>
      <span className="min-w-[9rem] text-center font-display text-sm font-semibold text-white/90">
        {range.label}
      </span>
      <Button
        variant="ghost"
        onClick={() => range.shift(1)}
        aria-label={range.mode === 'year' ? 'Next year' : 'Next month'}
      >
        ›
      </Button>
    </div>
  );
}
