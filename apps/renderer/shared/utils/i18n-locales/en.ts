import { EN_RUNTIME_TRANSLATIONS } from '@/shared/utils/i18n-locales/en-runtime';
import { EN_SETTINGS_TRANSLATIONS } from '@/shared/utils/i18n-locales/en-settings';
import { EN_UI_TRANSLATIONS } from '@/shared/utils/i18n-locales/en-ui';

export const EN_TRANSLATIONS = {
  ...EN_UI_TRANSLATIONS,
  ...EN_SETTINGS_TRANSLATIONS,
  ...EN_RUNTIME_TRANSLATIONS,
} as const;
