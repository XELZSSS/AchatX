import { ProviderId } from '@/shared/types/chat';
import type { LanguagePreference } from '@/shared/utils/i18n';
import type { AccentPreference, ThemePreference } from '@/shared/utils/theme';
import { listProviderIds } from '@/infrastructure/providers/registry';
import { readAppStorage, writeAppStorage } from '@/infrastructure/persistence/storageKeys';

const DEFAULT_MAX_TOOL_CALL_ROUNDS = 5;
const MIN_TOOL_CALL_ROUNDS = 1;
const MAX_TOOL_CALL_ROUNDS = 12;

export type AppSettings = {
  defaultProviderId: ProviderId;
  languagePreference: LanguagePreference;
  themePreference: ThemePreference;
  accentPreference: AccentPreference;
  allowHttpTargets: boolean;
  toolCallMaxRounds: string;
};

const canUseAppStorage = (): boolean => typeof window !== 'undefined';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const areAppSettingsEqual = (left: AppSettings, right: AppSettings): boolean => {
  return (
    left.defaultProviderId === right.defaultProviderId &&
    left.languagePreference === right.languagePreference &&
    left.themePreference === right.themePreference &&
    left.accentPreference === right.accentPreference &&
    left.allowHttpTargets === right.allowHttpTargets &&
    left.toolCallMaxRounds === right.toolCallMaxRounds
  );
};

const isLanguagePreference = (value: unknown): value is LanguagePreference => {
  return value === 'system' || value === 'en' || value === 'zh-CN';
};

const isThemePreference = (value: unknown): value is ThemePreference => {
  return value === 'system' || value === 'light' || value === 'dark';
};

const isAccentPreference = (value: unknown): value is AccentPreference => {
  return (
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
    value === 'violet'
  );
};

const isProviderId = (value: unknown): value is ProviderId => {
  return typeof value === 'string' && listProviderIds().includes(value as ProviderId);
};

const clampToolCallRounds = (value: number): string => {
  return String(Math.min(Math.max(value, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS));
};

const normalizeToolCallMaxRounds = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return clampToolCallRounds(parsed);
};

export const getDefaultAppSettings = (): AppSettings => {
  const fallbackProviderId = listProviderIds()[0] ?? 'gemini';

  return {
    defaultProviderId: fallbackProviderId,
    languagePreference: 'system',
    themePreference: 'system',
    accentPreference: 'neutral',
    allowHttpTargets: false,
    toolCallMaxRounds: String(DEFAULT_MAX_TOOL_CALL_ROUNDS),
  };
};

export const normalizeAppSettings = (
  value: unknown,
  fallback: Partial<AppSettings> = {}
): AppSettings => {
  const defaults = getDefaultAppSettings();
  const raw = isPlainObject(value) ? value : {};

  return {
    defaultProviderId: isProviderId(raw.defaultProviderId)
      ? raw.defaultProviderId
      : (fallback.defaultProviderId ?? defaults.defaultProviderId),
    languagePreference: isLanguagePreference(raw.languagePreference)
      ? raw.languagePreference
      : (fallback.languagePreference ?? defaults.languagePreference),
    themePreference: isThemePreference(raw.themePreference)
      ? raw.themePreference
      : (fallback.themePreference ?? defaults.themePreference),
    accentPreference: isAccentPreference(raw.accentPreference)
      ? raw.accentPreference
      : (fallback.accentPreference ?? defaults.accentPreference),
    allowHttpTargets:
      typeof raw.allowHttpTargets === 'boolean'
        ? raw.allowHttpTargets
        : (fallback.allowHttpTargets ?? defaults.allowHttpTargets),
    toolCallMaxRounds:
      normalizeToolCallMaxRounds(raw.toolCallMaxRounds) ??
      fallback.toolCallMaxRounds ??
      defaults.toolCallMaxRounds,
  };
};

export const loadAppSettings = (): AppSettings => {
  const defaults = getDefaultAppSettings();

  if (!canUseAppStorage()) {
    return defaults;
  }

  try {
    const stored = readAppStorage('appSettings');
    if (!stored) {
      return defaults;
    }

    const parsed = JSON.parse(stored) as unknown;
    const normalized = normalizeAppSettings(parsed, defaults);

    if (!isPlainObject(parsed) || !areAppSettingsEqual(normalized, normalizeAppSettings(parsed))) {
      persistAppSettings(normalized);
    }

    return normalized;
  } catch (error) {
    console.error('Failed to load app settings:', error);
    return defaults;
  }
};

export const persistAppSettings = (settings: AppSettings): AppSettings => {
  const normalized = normalizeAppSettings(settings);
  if (!canUseAppStorage()) {
    return normalized;
  }

  try {
    writeAppStorage('appSettings', JSON.stringify(normalized));
  } catch (error) {
    console.error('Failed to persist app settings:', error);
  }

  return normalized;
};

export const updateAppSettings = (updates: Partial<AppSettings>): AppSettings => {
  return persistAppSettings({
    ...loadAppSettings(),
    ...updates,
  });
};

export const loadDefaultProviderId = (): ProviderId => {
  return loadAppSettings().defaultProviderId;
};

export const persistDefaultProviderId = (providerId: ProviderId): void => {
  updateAppSettings({ defaultProviderId: providerId });
};
