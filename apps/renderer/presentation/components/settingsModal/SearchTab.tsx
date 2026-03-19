import { useMemo } from 'react';
import { TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import type { SettingsValidationIssue } from '@/presentation/components/settingsModal/validation';
import { SearchEngineSection, SearchTabLayout } from '@/presentation/components/settingsModal/SearchTabSections';
import {
  ExaEngineSection,
  SearxngEngineSection,
  TavilyEngineSection,
} from '@/presentation/components/settingsModal/SearchTabEngineSections';

type SearchTabProps = {
  tavily: TavilyConfig;
  showTavilyKey: boolean;
  toolCallMaxRounds: string;
  validationIssuesByField: Record<string, SettingsValidationIssue[]>;
  onSetTavilyField: <K extends keyof TavilyConfig>(key: K, value: TavilyConfig[K]) => void;
  onToggleTavilyKeyVisibility: () => void;
  onToolCallMaxRoundsChange: (value: string) => void;
  onToolCallMaxRoundsBlur: () => void;
};

const SearchTab = ({
  tavily,
  showTavilyKey,
  toolCallMaxRounds,
  validationIssuesByField,
  onSetTavilyField,
  onToggleTavilyKeyVisibility,
  onToolCallMaxRoundsChange,
  onToolCallMaxRoundsBlur,
}: SearchTabProps) => {
  const activeEngine =
    tavily.engine === 'exa' || tavily.engine === 'searxng' ? tavily.engine : 'tavily';
  const tavilyKeyLabel = useMemo(
    () => (showTavilyKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')),
    [showTavilyKey]
  );
  const apiKeyLabel = useMemo(
    () =>
      activeEngine === 'exa'
        ? t('settings.modal.search.apiKey.exa')
        : t('settings.modal.search.apiKey.tavily'),
    [activeEngine]
  );

  const sharedProps = {
    tavily,
    toolCallMaxRounds,
    validationIssuesByField,
    onSetTavilyField,
    onToolCallMaxRoundsChange,
    onToolCallMaxRoundsBlur,
  };

  return (
    <SearchTabLayout>
      <SearchEngineSection
        {...sharedProps}
        activeEngine={activeEngine}
        showTavilyKey={showTavilyKey}
        tavilyKeyLabel={tavilyKeyLabel}
        apiKeyLabel={apiKeyLabel}
        onToggleTavilyKeyVisibility={onToggleTavilyKeyVisibility}
      />

      <div className="space-y-3">
        {activeEngine === 'tavily' ? <TavilyEngineSection {...sharedProps} /> : null}
        {activeEngine === 'exa' ? <ExaEngineSection {...sharedProps} /> : null}
        {activeEngine === 'searxng' ? <SearxngEngineSection {...sharedProps} /> : null}
      </div>
    </SearchTabLayout>
  );
};

export default SearchTab;
