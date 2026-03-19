import { ZH_CN_RUNTIME_TRANSLATIONS } from '@/shared/utils/i18n-locales/zh-CN-runtime';
import { ZH_CN_SETTINGS_TRANSLATIONS } from '@/shared/utils/i18n-locales/zh-CN-settings';
import { ZH_CN_UI_TRANSLATIONS } from '@/shared/utils/i18n-locales/zh-CN-ui';

export const ZH_CN_TRANSLATIONS = {
  ...ZH_CN_UI_TRANSLATIONS,
  ...ZH_CN_SETTINGS_TRANSLATIONS,
  ...ZH_CN_RUNTIME_TRANSLATIONS,
} as const;
