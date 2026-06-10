import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

const NAV = [
  { to: '/', label: 'Quick Add', end: true },
  { to: '/overview', label: 'Overview', end: false },
  { to: '/export', label: 'Export', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Layout() {
  const { user, logOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0b0f] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0b0f]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="font-display text-lg font-extrabold tracking-tight">
            <span className="text-lime-300">▮</span> Counter
          </span>

          <nav className="ml-auto flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
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

          <button
            type="button"
            onClick={() => void logOut()}
            title={user?.email ?? undefined}
            className="ml-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
