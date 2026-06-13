import { useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'theme';

/** Read the persisted preference; absent/invalid means follow the OS. */
export function getStoredTheme(): Theme {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Reflect the choice onto <html>; 'system' clears the override so the
 *  prefers-color-scheme media query in index.css takes over. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

/** The actually-rendered theme: resolves 'system' against the OS preference. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  const dark =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'dark' : 'light';
}

/**
 * Header toggle: exposes the effective light/dark mode and a flip to the
 * opposite. Defaults to following the OS until the user flips it once.
 */
export function useTheme(): readonly ['light' | 'dark', () => void] {
  const [theme, set] = useState<Theme>(getStoredTheme);
  const effective = resolveTheme(theme);
  const toggle = () => {
    const next: Theme = effective === 'dark' ? 'light' : 'dark';
    setTheme(next);
    set(next);
  };
  return [effective, toggle] as const;
}
