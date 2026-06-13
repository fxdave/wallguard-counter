import { useTheme, nextTheme, type Theme } from '../lib/theme';

const LABEL: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const ICON: Record<Theme, string> = {
  system: '🖥️',
  light: '☀️',
  dark: '🌙',
};

/** Cycles System → Light → Dark. System follows the OS preference. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(theme))}
      aria-label={`Theme: ${LABEL[theme]} (click to change)`}
      title={`Theme: ${LABEL[theme]}`}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/40 transition hover:bg-white/5 hover:text-white"
    >
      <span className="text-base leading-none">{ICON[theme]}</span>
      <span className="hidden sm:inline">{LABEL[theme]}</span>
    </button>
  );
}
