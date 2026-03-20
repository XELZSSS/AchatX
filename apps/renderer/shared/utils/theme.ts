import { loadAppSettings, updateAppSettings } from '@/infrastructure/persistence/appSettingsStore';

export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';
export type AccentPreference =
  | 'neutral'
  | 'blue'
  | 'sky'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'lime'
  | 'amber'
  | 'orange'
  | 'rose'
  | 'red'
  | 'violet';

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
const DEFAULT_ACCENT_PREFERENCE: AccentPreference = 'neutral';

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || isTheme(value);

const isAccentPreference = (value: unknown): value is AccentPreference =>
  value === 'neutral' ||
  value === 'blue' ||
  value === 'sky' ||
  value === 'cyan' ||
  value === 'teal' ||
  value === 'green' ||
  value === 'lime' ||
  value === 'amber' ||
  value === 'orange' ||
  value === 'rose' ||
  value === 'red' ||
  value === 'violet';

const resolveSystemTheme = (): Theme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveThemePreference = (theme: ThemePreference): Theme =>
  theme === 'system' ? resolveSystemTheme() : theme;

const getStoredThemePreference = (): ThemePreference | null => {
  const stored = loadAppSettings().themePreference;
  return isThemePreference(stored) ? stored : null;
};

const getStoredAccentPreference = (): AccentPreference | null => {
  const stored = loadAppSettings().accentPreference;
  return isAccentPreference(stored) ? stored : null;
};

let currentThemePreference: ThemePreference =
  getStoredThemePreference() ?? DEFAULT_THEME_PREFERENCE;
let currentTheme: Theme = resolveThemePreference(currentThemePreference);
let currentAccentPreference: AccentPreference =
  getStoredAccentPreference() ?? DEFAULT_ACCENT_PREFERENCE;

export const getTheme = (): Theme => currentTheme;

export const getThemePreference = (): ThemePreference => currentThemePreference;

export const getAccentPreference = (): AccentPreference => currentAccentPreference;

const syncThemeToElectron = (): void => {
  if (typeof window === 'undefined') return;
  const syncTask = window.orlinx?.setTheme?.(currentThemePreference);
  if (syncTask && typeof syncTask.catch === 'function') {
    void syncTask.catch(() => {
      // Ignore Electron IPC errors so web previews continue to work.
    });
  }
};

export const applyThemeToDocument = (): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = currentTheme;
  document.documentElement.dataset.accent = currentAccentPreference;
  document.documentElement.style.colorScheme = currentTheme;
  syncThemeToElectron();
};

export const setThemePreference = (theme: ThemePreference): Theme => {
  currentThemePreference = isThemePreference(theme) ? theme : DEFAULT_THEME_PREFERENCE;
  currentTheme = resolveThemePreference(currentThemePreference);
  updateAppSettings({ themePreference: currentThemePreference });
  applyThemeToDocument();
  return currentTheme;
};

export const setAccentPreference = (accent: AccentPreference): AccentPreference => {
  currentAccentPreference = isAccentPreference(accent) ? accent : DEFAULT_ACCENT_PREFERENCE;
  updateAppSettings({ accentPreference: currentAccentPreference });
  applyThemeToDocument();
  return currentAccentPreference;
};

export const refreshSystemTheme = (): Theme | null => {
  if (currentThemePreference !== 'system') {
    return null;
  }

  const nextTheme = resolveSystemTheme();
  if (nextTheme === currentTheme) {
    return null;
  }

  currentTheme = nextTheme;
  applyThemeToDocument();
  return currentTheme;
};

