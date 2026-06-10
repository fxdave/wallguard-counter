import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useAuth } from './useAuth';

/**
 * Wraps the entire app. Renders a login wall until a user is signed in. Note:
 * the *real* access control is the email allowlist in firestore.rules — signing
 * in with a non-allowlisted account succeeds here but every data read/write is
 * denied by the rules.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0b0b0f]">
        <motion.div
          aria-label="Loading"
          className="size-10 rounded-full border-2 border-white/10 border-t-lime-300"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        />
      </div>
    );
  }

  if (user) return <>{children}</>;

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#0b0b0f] px-6">
      {/* Atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-40 -top-40 size-[28rem] rounded-full bg-lime-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-32 size-[26rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl"
      >
        <p className="font-display text-xs uppercase tracking-[0.35em] text-lime-300/80">
          Wallguard
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight">
          Counter
        </h1>
        <p className="mt-3 text-sm text-white/50">
          Tally the household. Sign in to continue.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-medium text-black transition hover:bg-lime-200 disabled:opacity-60"
        >
          <GoogleMark />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}
      </motion.div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
