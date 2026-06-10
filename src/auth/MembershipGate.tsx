import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useAuth } from './useAuth';
import { useAccess } from '../lib/queries';

/**
 * Sits inside the login wall. A signed-in user who is not on the allowlist
 * (no `members` document and not the owner) gets a "request access" screen
 * instead of broken, permission-denied pages. The real enforcement is in
 * firestore.rules; this is just UX.
 */
export function MembershipGate({ children }: { children: ReactNode }) {
  const { user, logOut } = useAuth();
  const { data: allowed, isLoading, isError, refetch } = useAccess(user?.email);

  if (isLoading) {
    return (
      <Centered>
        <motion.div
          aria-label="Checking access"
          className="size-10 rounded-full border-2 border-white/10 border-t-lime-300"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        />
      </Centered>
    );
  }

  if (isError) {
    return (
      <Centered>
        <Panel
          title="Something went wrong"
          body="We couldn't verify your access. Check your connection and try again."
        >
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-lime-200"
          >
            Retry
          </button>
        </Panel>
      </Centered>
    );
  }

  if (!allowed) {
    return (
      <Centered>
        <Panel
          title="Access pending"
          body={`You're signed in as ${user?.email ?? 'your account'}, but you're not on the allowlist yet. Ask someone who already has access to add your email in Settings → Members.`}
        >
          <button
            type="button"
            onClick={() => void logOut()}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </Panel>
      </Centered>
    );
  }

  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0b0b0f] px-6">
      {children}
    </div>
  );
}

function Panel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl"
    >
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/50">{body}</p>
      <div className="mt-6 flex justify-center">{children}</div>
    </motion.div>
  );
}
