import type { ChangeEvent } from 'react';
import { TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import {
  fullInputClass,
  getExaSearchTypeOptions,
  getSearXNGSafeSearchOptions,
  getSearXNGTimeRangeOptions,
  getTavilySearchDepthOptions,
  getTavilyTopicOptions,
} from '@/presentation/components/settingsModal/constants';
import { Dropdown, Input, Toggle } from '@/shared/ui';
import { DEFAULT_MAX_TOOL_CALL_ROUNDS } from '@/infrastructure/providers/utils';
import { SettingsControlGroup, SettingsFieldMessages } from '@/presentation/components/settingsModal/formParts';
import type { SettingsValidationIssue } from '@/presentation/components/settingsModal/validation';

type SearchTabSharedProps = {
  tavily: TavilyConfig;
  toolCallMaxRounds: string;
  validationIssuesByField: Record<string, SettingsValidationIssue[]>;
  onSetTavilyField: <K extends keyof TavilyConfig>(key: K, value: TavilyConfig[K]) => void;
  onToolCallMaxRoundsChange: (value: string) => void;
  onToolCallMaxRoundsBlur: () => void;
};

const NumericInput = ({
  value,
  issues,
  className,
  hasError,
  onChange,
  onBlur,
}: {
  value: string | number;
  issues?: SettingsValidationIssue[];
  className?: string;
  hasError?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}) => (
  <div className="space-y-2">
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={String(DEFAULT_MAX_TOOL_CALL_ROUNDS)}
      className={[`${fullInputClass} text-xs`, className].filter(Boolean).join(' ')}
      compact
      autoComplete="off"
      aria-invalid={hasError || undefined}
    />
    <SettingsFieldMessages issues={issues} />
  </div>
);

export const TavilyEngineSection = ({
  tavily,
  toolCallMaxRounds,
  validationIssuesByField,
  onSetTavilyField,
  onToolCallMaxRoundsChange,
  onToolCallMaxRoundsBlur,
}: SearchTabSharedProps) => {
  const toolCallRoundsIssues = validationIssuesByField['search.toolCallMaxRounds'];
  const maxResultsIssues = validationIssuesByField['search.maxResults'];

  return (
    <>
      <SettingsControlGroup label={t('settings.modal.tavily.projectId')}>
        <Input
          type="text"
          value={tavily.projectId ?? ''}
          onChange={(event) => onSetTavilyField('projectId', event.target.value)}
          className={fullInputClass}
          compact
          autoComplete="off"
        />
      </SettingsControlGroup>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <SettingsControlGroup label={t('settings.modal.tavily.searchDepth')}>
          <Dropdown
            value={tavily.searchDepth ?? 'basic'}
            options={getTavilySearchDepthOptions()}
            onChange={(value) =>
              onSetTavilyField(
                'searchDepth',
                value as import('@/shared/types/chat').TavilySearchDepth
              )
            }
            widthClassName="w-full"
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.tavily.topic')}>
          <Dropdown
            value={tavily.topic ?? 'general'}
            options={getTavilyTopicOptions()}
            onChange={(value) =>
              onSetTavilyField('topic', value as import('@/shared/types/chat').TavilyTopic)
            }
            widthClassName="w-full"
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.toolCallRounds')}>
          <NumericInput
            value={toolCallMaxRounds}
            issues={toolCallRoundsIssues}
            hasError={toolCallRoundsIssues?.some((issue) => issue.severity === 'error')}
            onChange={(event) => onToolCallMaxRoundsChange(event.target.value.replace(/[^\d]/g, ''))}
            onBlur={onToolCallMaxRoundsBlur}
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.tavily.maxResults')}>
          <NumericInput
            value={tavily.maxResults ?? 5}
            issues={maxResultsIssues}
            hasError={maxResultsIssues?.some((issue) => issue.severity === 'error')}
            onChange={(event) =>
              onSetTavilyField('maxResults', event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </SettingsControlGroup>
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
        <Toggle
          checked={tavily.includeAnswer ?? true}
          onCheckedChange={(checked) => onSetTavilyField('includeAnswer', checked)}
        />
        {t('settings.modal.tavily.includeAnswer')}
      </label>
    </>
  );
};

export const ExaEngineSection = ({
  tavily,
  toolCallMaxRounds,
  validationIssuesByField,
  onSetTavilyField,
  onToolCallMaxRoundsChange,
  onToolCallMaxRoundsBlur,
}: SearchTabSharedProps) => {
  const toolCallRoundsIssues = validationIssuesByField['search.toolCallMaxRounds'];
  const maxResultsIssues = validationIssuesByField['search.maxResults'];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
      <SettingsControlGroup label={t('settings.modal.search.type')}>
      <Dropdown
        value={tavily.exaSearchType ?? 'auto'}
        options={getExaSearchTypeOptions()}
          onChange={(value) =>
            onSetTavilyField('exaSearchType', value as import('@/shared/types/chat').ExaSearchType)
        }
        widthClassName="w-full"
      />
      </SettingsControlGroup>
      <SettingsControlGroup label={t('settings.modal.toolCallRounds')}>
        <NumericInput
          value={toolCallMaxRounds}
          issues={toolCallRoundsIssues}
          hasError={toolCallRoundsIssues?.some((issue) => issue.severity === 'error')}
          onChange={(event) => onToolCallMaxRoundsChange(event.target.value.replace(/[^\d]/g, ''))}
          onBlur={onToolCallMaxRoundsBlur}
        />
      </SettingsControlGroup>
      <SettingsControlGroup label={t('settings.modal.tavily.maxResults')}>
        <NumericInput
          value={tavily.maxResults ?? 5}
          issues={maxResultsIssues}
          hasError={maxResultsIssues?.some((issue) => issue.severity === 'error')}
          onChange={(event) =>
            onSetTavilyField('maxResults', event.target.value ? Number(event.target.value) : undefined)
          }
        />
      </SettingsControlGroup>
    </div>
  );
};

export const SearxngEngineSection = ({
  tavily,
  toolCallMaxRounds,
  validationIssuesByField,
  onSetTavilyField,
  onToolCallMaxRoundsChange,
  onToolCallMaxRoundsBlur,
}: SearchTabSharedProps) => {
  const toolCallRoundsIssues = validationIssuesByField['search.toolCallMaxRounds'];
  const maxResultsIssues = validationIssuesByField['search.maxResults'];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <SettingsControlGroup label={t('settings.modal.search.searxng.safeSearch')}>
          <Dropdown
            value={String(tavily.searxngSafeSearch ?? 1)}
            options={getSearXNGSafeSearchOptions()}
            onChange={(value) =>
              onSetTavilyField(
                'searxngSafeSearch',
                Number(value) as import('@/shared/types/chat').SearXNGSafeSearch
              )
            }
            widthClassName="w-full"
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.search.searxng.timeRange')}>
          <Dropdown
            value={tavily.searxngTimeRange ?? ''}
            options={getSearXNGTimeRangeOptions()}
            onChange={(value) =>
              onSetTavilyField(
                'searxngTimeRange',
                (value || undefined) as import('@/shared/types/chat').SearXNGTimeRange | undefined
              )
            }
            widthClassName="w-full"
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.toolCallRounds')}>
          <NumericInput
            value={toolCallMaxRounds}
            issues={toolCallRoundsIssues}
            hasError={toolCallRoundsIssues?.some((issue) => issue.severity === 'error')}
            onChange={(event) => onToolCallMaxRoundsChange(event.target.value.replace(/[^\d]/g, ''))}
            onBlur={onToolCallMaxRoundsBlur}
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.tavily.maxResults')}>
          <NumericInput
            value={tavily.maxResults ?? 5}
            issues={maxResultsIssues}
            hasError={maxResultsIssues?.some((issue) => issue.severity === 'error')}
            onChange={(event) =>
              onSetTavilyField('maxResults', event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </SettingsControlGroup>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SettingsControlGroup label={t('settings.modal.search.searxng.language')}>
          <Input
            type="text"
            value={tavily.searxngLanguage ?? ''}
            onChange={(event) => onSetTavilyField('searxngLanguage', event.target.value)}
            className={fullInputClass}
            compact
            autoComplete="off"
            placeholder={t('settings.modal.search.searxng.language.placeholder')}
          />
        </SettingsControlGroup>
        <SettingsControlGroup label={t('settings.modal.search.searxng.categories')}>
          <Input
            type="text"
            value={tavily.searxngCategories ?? ''}
            onChange={(event) => onSetTavilyField('searxngCategories', event.target.value)}
            className={fullInputClass}
            compact
            autoComplete="off"
            placeholder={t('settings.modal.search.searxng.categories.placeholder')}
          />
        </SettingsControlGroup>
      </div>
    </>
  );
};
