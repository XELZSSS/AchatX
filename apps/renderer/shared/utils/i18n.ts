import { EN_TRANSLATIONS } from '@/shared/utils/i18n-locales/en';
import { ZH_CN_TRANSLATIONS } from '@/shared/utils/i18n-locales/zh-CN';
import { loadAppSettings, updateAppSettings } from '@/infrastructure/persistence/appSettingsStore';

export type Language = 'en' | 'zh-CN';
export type LanguagePreference = Language | 'system';

const DEFAULT_LANGUAGE: Language = 'en';
const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'system';

const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'zh-CN';

const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === 'system' || isLanguage(value);

export const resolveLanguageCode = (languageCode: string | null | undefined): Language => {
  const normalized = String(languageCode ?? '')
    .trim()
    .toLowerCase();
  return normalized.startsWith('zh') ? 'zh-CN' : 'en';
};

const resolveSystemLanguage = (): Language => {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  return resolveLanguageCode(navigator.language);
};

const resolveLanguagePreference = (language: LanguagePreference): Language =>
  language === 'system' ? resolveSystemLanguage() : language;

const getStoredLanguagePreference = (): LanguagePreference | null => {
  const stored = loadAppSettings().languagePreference;
  return isLanguagePreference(stored) ? stored : null;
};

let currentLanguagePreference: LanguagePreference =
  getStoredLanguagePreference() ?? DEFAULT_LANGUAGE_PREFERENCE;
let currentLanguage: Language = resolveLanguagePreference(currentLanguagePreference);

export const getLanguage = (): Language => currentLanguage;

export const getLanguagePreference = (): LanguagePreference => currentLanguagePreference;

export const applyLanguageToDocument = (): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
  }
};

export const setLanguagePreference = (language: LanguagePreference): Language => {
  currentLanguagePreference = isLanguagePreference(language)
    ? language
    : DEFAULT_LANGUAGE_PREFERENCE;
  currentLanguage = resolveLanguagePreference(currentLanguagePreference);
  updateAppSettings({ languagePreference: currentLanguagePreference });
  applyLanguageToDocument();
  return currentLanguage;
};

export const refreshSystemLanguage = (): Language | null => {
  if (currentLanguagePreference !== 'system') {
    return null;
  }

  const nextLanguage = resolveSystemLanguage();
  if (nextLanguage === currentLanguage) {
    return null;
  }

  currentLanguage = nextLanguage;
  applyLanguageToDocument();
  return currentLanguage;
};

export const syncExternalSystemLanguage = (
  languageCode: string | null | undefined
): Language | null => {
  if (currentLanguagePreference !== 'system') {
    return null;
  }

  const nextLanguage = resolveLanguageCode(languageCode);
  if (nextLanguage === currentLanguage) {
    return null;
  }

  currentLanguage = nextLanguage;
  applyLanguageToDocument();
  return currentLanguage;
};

export const DEFAULT_SESSION_TITLES = {
  en: 'New Chat',
  'zh-CN': '新对话',
} as const;

export const isDefaultSessionTitle = (title?: string | null): boolean => {
  if (!title) return true;
  return Object.values(DEFAULT_SESSION_TITLES).includes(
    title as (typeof DEFAULT_SESSION_TITLES)[Language]
  );
};

const translations: Record<Language, Record<string, string>> = {
  en: EN_TRANSLATIONS as unknown as Record<string, string>,
  'zh-CN': ZH_CN_TRANSLATIONS as unknown as Record<string, string>,
};

export const t = (key: string): string =>
  translations[currentLanguage][key] ?? translations.en[key] ?? key;
