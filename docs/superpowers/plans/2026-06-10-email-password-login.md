# Email/Password Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password sign-in as an alternative to Google in the login screen. A "Sign in with email" button above the Google button expands an inline email+password form. Sign-in only — no account creation UI (new users are added via the members allowlist).

**Architecture:** Add `signInWithEmail` to `AuthContext`. `LoginGate` gains local state to show/hide the inline form. Firebase `signInWithEmailAndPassword` is used. No new dependencies.

**Tech Stack:** Firebase Auth (`signInWithEmailAndPassword` from `firebase/auth`), React state.

**Prerequisites:** Email/password sign-in must be enabled in the Firebase console: Authentication → Sign-in method → Email/Password → Enable. This is a manual step — do it before testing.

---

### Task 1: Extend the auth context with signInWithEmail

**Files:**
- Modify: `src/auth/context.ts`
- Modify: `src/auth/AuthContext.tsx`

- [ ] **Step 1: Read the current context.ts**

Read `/home/arch/wallguard-counter/src/auth/context.ts`.

- [ ] **Step 2: Add signInWithEmail to AuthState**

In `src/auth/context.ts`, add `signInWithEmail` to the `AuthState` interface. The full updated file:

```ts
import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signInWithEmail: async () => {},
  logOut: async () => {},
});
```

- [ ] **Step 3: Read current AuthContext.tsx**

Read `/home/arch/wallguard-counter/src/auth/AuthContext.tsx`.

- [ ] **Step 4: Implement signInWithEmail in AuthProvider**

In `src/auth/AuthContext.tsx`, add the import for `signInWithEmailAndPassword` and implement the method. Full updated file:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { AuthContext, type AuthState } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      signInWithEmail: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      logOut: async () => {
        await signOut(auth);
      },
    }),
    [user, loading],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
```

- [ ] **Step 5: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/auth/context.ts src/auth/AuthContext.tsx
git commit -m "feat: add signInWithEmail to AuthContext"
```

---

### Task 2: Add email/password form to LoginGate

**Files:**
- Modify: `src/auth/LoginGate.tsx`

- [ ] **Step 1: Read the current LoginGate.tsx**

Read `/home/arch/wallguard-counter/src/auth/LoginGate.tsx`.

- [ ] **Step 2: Rewrite LoginGate with email/password form**

Replace the full content of `src/auth/LoginGate.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './useAuth';

export function LoginGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signInWithEmail } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleGoogleSignIn = async () => {
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential'
      ) {
        setError('Invalid email or password.');
      } else {
        setError('Sign-in failed. Please try again.');
      }
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

        <div className="mt-8 space-y-3">
          {/* Email/password toggle button or form */}
          <AnimatePresence initial={false}>
            {showEmailForm ? (
              <motion.form
                key="email-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={(e) => void handleEmailSignIn(e)}
                className="overflow-hidden space-y-2"
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowEmailForm(false); setError(null); }}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-60"
                    disabled={busy}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !email.trim() || !password}
                    className="flex-1 rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-lime-200 disabled:opacity-60"
                  >
                    {busy ? 'Signing in…' : 'Sign in'}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.button
                key="email-button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => { setShowEmailForm(true); setError(null); }}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white/80 transition hover:bg-white/10"
              >
                Sign in with email
              </motion.button>
            )}
          </AnimatePresence>

          {/* Google */}
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-medium text-black transition hover:bg-lime-200 disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>

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
```

- [ ] **Step 3: Verify types compile**

```bash
cd /home/arch/wallguard-counter && npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
cd /home/arch/wallguard-counter && npm run test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/auth/LoginGate.tsx
git commit -m "feat: add email/password sign-in option to login screen"
```
