import { loadAppSettings, updateAppSettings } from '@/infrastructure/persistence/appSettingsStore';

export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || isTheme(value);

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

let currentThemePreference: ThemePreference =
  getStoredThemePreference() ?? DEFAULT_THEME_PREFERENCE;
let currentTheme: Theme = resolveThemePreference(currentThemePreference);

export const getTheme = (): Theme => currentTheme;

export const getThemePreference = (): ThemePreference => currentThemePreference;

const syncThemeToElectron = (): void => {
  if (typeof window === 'undefined') return;
  const syncTask = window.axchat?.setTheme?.(currentThemePreference);
  if (syncTask && typeof syncTask.catch === 'function') {
    void syncTask.catch(() => {
      // Ignore Electron IPC errors so web previews continue to work.
    });
  }
};

export const applyThemeToDocument = (): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = currentTheme;
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
