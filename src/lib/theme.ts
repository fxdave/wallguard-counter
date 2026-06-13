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

/** Cycle order for the header toggle. */
const ORDER: Theme[] = ['system', 'light', 'dark'];

export function nextTheme(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
}

export function useTheme(): readonly [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(getStoredTheme);
  const update = (t: Theme) => {
    setTheme(t);
    set(t);
  };
  return [theme, update] as const;
}
