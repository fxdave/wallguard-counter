import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-lime-300 text-black hover:bg-lime-200 focus-visible:ring-lime-300/50',
  ghost:
    'border border-white/10 text-white/80 hover:bg-white/5 hover:text-white focus-visible:ring-white/20',
  danger:
    'border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200 focus-visible:ring-red-500/40',
  subtle: 'text-white/50 hover:text-white focus-visible:ring-white/20',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold',
        'transition focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
