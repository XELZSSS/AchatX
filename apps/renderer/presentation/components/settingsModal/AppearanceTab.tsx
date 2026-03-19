import { useMemo } from 'react';
import type { Language, LanguagePreference } from '@/shared/utils/i18n';
import type { Theme, ThemePreference } from '@/shared/utils/theme';
import { t } from '@/shared/utils/i18n';
import { Dropdown, Field } from '@/shared/ui';
import { settingsSectionLabelClass } from '@/presentation/components/settingsModal/constants';
import {
  SettingsCard,
  SettingsControlGroup,
} from '@/presentation/components/settingsModal/formParts';

type AppearanceTabProps = {
  language: Language;
  languagePreference: LanguagePreference;
  theme: Theme;
  themePreference: ThemePreference;
  onLanguagePreferenceChange: (value: LanguagePreference) => void;
  onThemePreferenceChange: (value: ThemePreference) => void;
};

const AppearanceTab = ({
  language,
  languagePreference,
  theme,
  themePreference,
  onLanguagePreferenceChange,
  onThemePreferenceChange,
}: AppearanceTabProps) => {
  const languageOptions = useMemo(
    () => [
      {
        value: 'system',
        label: `${t('language.system')} (${language === 'en' ? t('language.en') : t('language.zhCN')})`,
      },
      { value: 'en', label: t('language.en') },
      { value: 'zh-CN', label: t('language.zhCN') },
    ],
    [language]
  );

  const themeOptions = useMemo(
    () => [
      {
        value: 'system',
        label: `${t('theme.system')} (${theme === 'dark' ? t('theme.dark') : t('theme.light')})`,
      },
      { value: 'light', label: t('theme.light') },
      { value: 'dark', label: t('theme.dark') },
    ],
    [theme]
  );

  return (
    <div className="space-y-5">
      <Field label={null}>
        <SettingsCard className="space-y-4">
          <SettingsControlGroup
            label={t('settings.appearance.language.label')}
            labelClassName={settingsSectionLabelClass}
          >
            <Dropdown
              value={languagePreference}
              options={languageOptions}
              onChange={(value) => onLanguagePreferenceChange(value as LanguagePreference)}
              widthClassName="w-full"
            />
          </SettingsControlGroup>

          <SettingsControlGroup
            label={t('settings.appearance.theme.label')}
            labelClassName={settingsSectionLabelClass}
          >
            <Dropdown
              value={themePreference}
              options={themeOptions}
              onChange={(value) => onThemePreferenceChange(value as ThemePreference)}
              widthClassName="w-full"
            />
          </SettingsControlGroup>
        </SettingsCard>
      </Field>
    </div>
  );
};

export default AppearanceTab;
