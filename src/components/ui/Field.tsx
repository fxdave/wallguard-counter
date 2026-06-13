import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white ' +
  'placeholder:text-white/30 outline-none transition focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20';

function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  className = '',
  ...rest
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label}>
      <input className={`${inputClass} ${className}`} {...rest} />
    </Label>
  );
}

/**
 * Compact icon (emoji) input. Renders a large preview of the current value next
 * to a short text field so members can paste any emoji.
 */
export function IconField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Label label={label}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-2xl">
          {value || '·'}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="🛒"
          maxLength={4}
          className={inputClass}
        />
      </div>
    </Label>
  );
}

export function NumberField({
  label,
  className = '',
  ...rest
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label}>
      <input
        type="number"
        inputMode="decimal"
        className={`${inputClass} ${className}`}
        {...rest}
      />
    </Label>
  );
}

export function CheckboxField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:bg-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-lime-300"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white/80">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-white/40">{description}</span>
        )}
      </span>
    </label>
  );
}

export function SelectField({
  label,
  className = '',
  children,
  ...rest
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label label={label}>
      <select className={`${inputClass} ${className}`} {...rest}>
        {children}
      </select>
    </Label>
  );
}
