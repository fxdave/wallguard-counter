import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/', label: 'Quick Add', end: true },
  { to: '/overview', label: 'Overview', end: false },
  { to: '/export', label: 'Export', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Layout() {
  const { user, logOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-base text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-base/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 px-4 py-3">
          {/* Logo */}
          <span className="order-1 font-display text-lg font-extrabold tracking-tight">
            <span className="text-lime-300">▮</span> Counter
          </span>

          {/* Actions: top-right on mobile, far right on desktop */}
          <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
              <ThemeToggle />
              <a
                href="https://github.com/fxdave/wallguard-counter"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub repository"
                className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => void logOut()}
                title={user?.email ?? undefined}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                Sign out
              </button>
          </div>

          {/* Nav: own row on mobile (wraps), inline between logo and actions on desktop */}
          <nav className="order-3 flex w-full gap-1 overflow-x-auto pt-2 scrollbar-none md:order-2 md:w-auto md:flex-1 md:pt-0">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
