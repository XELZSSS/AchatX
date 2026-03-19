import type { ReactNode } from 'react';
import { TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { fullInputClass, getSearchEngineOptions } from '@/presentation/components/settingsModal/constants';
import { Dropdown, Field, Input } from '@/shared/ui';
import SecretInput from '@/presentation/components/settingsModal/SecretInput';
import {
  getSettingsInputValidationClass,
  SettingsControlGroup,
  SettingsFieldMessages,
} from '@/presentation/components/settingsModal/formParts';
import type { SettingsValidationIssue } from '@/presentation/components/settingsModal/validation';
type SearchTabSharedProps = {
  tavily: TavilyConfig;
  toolCallMaxRounds: string;
  validationIssuesByField: Record<string, SettingsValidationIssue[]>;
  onSetTavilyField: <K extends keyof TavilyConfig>(key: K, value: TavilyConfig[K]) => void;
  onToolCallMaxRoundsChange: (value: string) => void;
  onToolCallMaxRoundsBlur: () => void;
};

type SearchEngineSectionProps = SearchTabSharedProps & {
  activeEngine: 'tavily' | 'exa' | 'searxng';
  showTavilyKey: boolean;
  tavilyKeyLabel: string;
  apiKeyLabel: string;
  onToggleTavilyKeyVisibility: () => void;
};

export const SearchTabLayout = ({ children }: { children: ReactNode }) => (
  <div className="space-y-4">
    <Field label={null}>
      <div className="space-y-5">{children}</div>
    </Field>
  </div>
);

export const SearchEngineSection = ({
  tavily,
  activeEngine,
  showTavilyKey,
  validationIssuesByField,
  tavilyKeyLabel,
  apiKeyLabel,
  onSetTavilyField,
  onToggleTavilyKeyVisibility,
}: SearchEngineSectionProps) => {
  const apiKeyIssues = validationIssuesByField['search.apiKey'];
  const searxngBaseUrlIssues = validationIssuesByField['search.searxngBaseUrl'];
  const searxngBaseUrlClassName = getSettingsInputValidationClass(searxngBaseUrlIssues);
  const hasSearxngBaseUrlError = searxngBaseUrlIssues?.some((issue) => issue.severity === 'error');

  return (
    <div className="space-y-3">
      <SettingsControlGroup label={t('settings.modal.search.engine')}>
        <Dropdown
          value={activeEngine}
          options={getSearchEngineOptions()}
          onChange={(value) =>
            onSetTavilyField('engine', value as import('@/shared/types/chat').SearchEngine)
          }
          widthClassName="w-full"
        />
      </SettingsControlGroup>

      {activeEngine !== 'searxng' ? (
        <SecretInput
          label={apiKeyLabel}
          labelClassName="text-xs text-[var(--ink-3)]"
          value={tavily.apiKey ?? ''}
          onChange={(event) => onSetTavilyField('apiKey', event.target.value)}
          showSecret={showTavilyKey}
          onToggleVisibility={onToggleTavilyKeyVisibility}
          onClear={() => onSetTavilyField('apiKey', '')}
          visibilityLabel={tavilyKeyLabel}
          inputClassName={`${fullInputClass} pr-20`}
          compact
          issues={apiKeyIssues}
        />
      ) : (
        <SettingsControlGroup label={t('settings.modal.search.searxng.baseUrl')}>
          <div className="space-y-2">
            <Input
              type="text"
              value={tavily.searxngBaseUrl ?? ''}
              onChange={(event) => onSetTavilyField('searxngBaseUrl', event.target.value)}
              className={[fullInputClass, searxngBaseUrlClassName].filter(Boolean).join(' ')}
              compact
              autoComplete="off"
              placeholder={t('settings.modal.search.searxng.baseUrl.placeholder')}
              aria-invalid={hasSearxngBaseUrlError || undefined}
            />
            <SettingsFieldMessages issues={searxngBaseUrlIssues} />
          </div>
        </SettingsControlGroup>
      )}
    </div>
  );
};
