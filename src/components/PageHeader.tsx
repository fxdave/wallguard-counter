import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Temporary placeholder used by pages whose feature logic isn't built yet. */
export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
      <p className="font-display text-lg text-white/70">Coming soon</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/40">{note}</p>
    </div>
  );
}
