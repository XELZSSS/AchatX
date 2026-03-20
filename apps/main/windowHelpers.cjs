/* global Buffer */
const path = require('path');

const DEFAULT_WINDOW_STATE = { width: 1200, height: 760 };
const MIN_WINDOW_SIZE = { width: 1024, height: 700 };
const DEFAULT_THEME_PREFERENCE = 'system';
const WINDOW_BG_BY_THEME = {
  dark: '#09090b',
  light: '#f5f7fb',
};
const WINDOW_SHOW_TIMEOUT_MS = {
  dev: 15000,
  prod: 8000,
};
const APP_STORAGE_BOOTSTRAP_KEYS = [
  'providerSettings',
  'appSettings',
  'searchEnabled',
  'reasoningEnabled',
  'inputDraft',
  'recentEmojis',
  'appVersion',
  'updaterStatus',
];

const persistJsonFile = (fs, filePath, payload) => {
  void fs.promises.writeFile(filePath, JSON.stringify(payload)).catch(() => {});
};

const isTheme = (value) => value === 'dark' || value === 'light';
const isThemePreference = (value) => value === 'system' || isTheme(value);

const getSystemTheme = (nativeTheme) => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
const getSystemLanguage = (app) => app.getPreferredSystemLanguages?.()?.[0] ?? app.getLocale();

const getWindowBackgroundColor = (theme) =>
  theme === 'light' ? WINDOW_BG_BY_THEME.light : WINDOW_BG_BY_THEME.dark;

const readThemePreferenceFromAppSettings = (readAppStorageValue) => {
  try {
    const storedSettings = readAppStorageValue('appSettings');
    if (!storedSettings) {
      return null;
    }
    const parsed = JSON.parse(storedSettings);
    return isThemePreference(parsed?.themePreference) ? parsed.themePreference : null;
  } catch {
    return null;
  }
};

const loadThemeState = ({ readAppStorageValue }) => {
  const storedThemePreference = readThemePreferenceFromAppSettings(readAppStorageValue);
  return storedThemePreference ?? DEFAULT_THEME_PREFERENCE;
};

const loadWindowState = async ({ fs, windowStateFile }) => {
  try {
    const raw = await fs.promises.readFile(windowStateFile, 'utf-8');
    return { ...DEFAULT_WINDOW_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }
};

const getWindowIcon = (app, platform) => {
  const root = app.getAppPath();
  return path.join(root, 'assets', 'icons', platform === 'win32' ? 'app.ico' : 'app.png');
};

const encodeAppStorageBootstrap = (listAppStorageValues) => {
  const snapshot = listAppStorageValues(APP_STORAGE_BOOTSTRAP_KEYS);
  return Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64url');
};

module.exports = {
  APP_STORAGE_BOOTSTRAP_KEYS,
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_WINDOW_STATE,
  MIN_WINDOW_SIZE,
  WINDOW_SHOW_TIMEOUT_MS,
  encodeAppStorageBootstrap,
  getSystemLanguage,
  getSystemTheme,
  getWindowBackgroundColor,
  getWindowIcon,
  isThemePreference,
  loadThemeState,
  loadWindowState,
  persistJsonFile,
};
