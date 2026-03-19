import { GeminiEmbeddingTaskType, ProviderId } from '@/shared/types/chat';
import { PROVIDER_IDS } from '../../../../shared/provider-ids';
import { PROVIDER_CAPABILITIES } from '@/infrastructure/providers/capabilities';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import {
  resolveBaseUrlForProvider as resolveProviderBaseUrl,
  resolveBaseUrlForRegion as resolveProviderRegionalBaseUrl,
} from '@/infrastructure/providers/baseUrl';
import { t } from '@/shared/utils/i18n';
import type { DropdownOption } from '@/shared/ui';

export const resolveBaseUrlForProvider = (
  providerId: ProviderId,
  override?: string
): string | undefined => {
  return resolveProviderBaseUrl(providerId, override);
};

export const resolveBaseUrlForRegion = (providerId: ProviderId, region: 'intl' | 'cn'): string => {
  return resolveProviderRegionalBaseUrl(providerId, region);
};

export const providerMeta = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = {
      label: PROVIDER_CONFIGS[id].label,
      ...PROVIDER_CAPABILITIES[id],
      isOfficialProvider: PROVIDER_CONFIGS[id].isOfficialProvider,
    };
    return acc;
  },
  {} as Record<
    ProviderId,
    {
      label: string;
      supportsTavily?: boolean;
      supportsBaseUrl?: boolean;
      supportsCustomHeaders?: boolean;
      supportsRegion?: boolean;
      supportsChatAgent?: boolean;
      supportsRequestMode?: boolean;
      supportsEmbedding?: boolean;
      isOfficialProvider?: boolean;
    }
  >
);

const assertProviderMappingCompleteness = (mapping: Record<ProviderId, unknown>, label: string) => {
  const missing = PROVIDER_IDS.filter((id) => !(id in mapping));
  if (missing.length > 0) {
    throw new Error(`Provider mapping "${label}" is missing: ${missing.join(', ')}`);
  }
};

assertProviderMappingCompleteness(providerMeta, 'providerMeta');

export const getTavilySearchDepthOptions = (): DropdownOption[] => [
  { value: 'basic', label: t('settings.modal.tavily.searchDepth.basic') },
  { value: 'advanced', label: t('settings.modal.tavily.searchDepth.advanced') },
  { value: 'fast', label: t('settings.modal.tavily.searchDepth.fast') },
  { value: 'ultra-fast', label: t('settings.modal.tavily.searchDepth.ultraFast') },
];

export const getSearchEngineOptions = (): DropdownOption[] => [
  { value: 'tavily', label: t('settings.modal.search.engine.tavily') },
  { value: 'exa', label: t('settings.modal.search.engine.exa') },
  { value: 'searxng', label: t('settings.modal.search.engine.searxng') },
];

export const getExaSearchTypeOptions = (): DropdownOption[] => [
  { value: 'auto', label: t('settings.modal.search.type.auto') },
  { value: 'fast', label: t('settings.modal.search.type.fast') },
  { value: 'neural', label: t('settings.modal.search.type.neural') },
  { value: 'deep', label: t('settings.modal.search.type.deep') },
];

export const getSearXNGTimeRangeOptions = (): DropdownOption[] => [
  { value: '', label: t('settings.modal.search.searxng.timeRange.any') },
  { value: 'day', label: t('settings.modal.search.searxng.timeRange.day') },
  { value: 'month', label: t('settings.modal.search.searxng.timeRange.month') },
  { value: 'year', label: t('settings.modal.search.searxng.timeRange.year') },
];

export const getSearXNGSafeSearchOptions = (): DropdownOption[] => [
  { value: '0', label: t('settings.modal.search.searxng.safeSearch.off') },
  { value: '1', label: t('settings.modal.search.searxng.safeSearch.moderate') },
  { value: '2', label: t('settings.modal.search.searxng.safeSearch.strict') },
];

export const getTavilyTopicOptions = (): DropdownOption[] => [
  { value: 'general', label: t('settings.modal.tavily.topic.general') },
  { value: 'news', label: t('settings.modal.tavily.topic.news') },
  { value: 'finance', label: t('settings.modal.tavily.topic.finance') },
];

export const getGeminiEmbeddingTaskOptions = (): Array<{
  value: GeminiEmbeddingTaskType;
  label: string;
}> => [
  {
    value: 'RETRIEVAL_DOCUMENT',
    label: t('settings.modal.embedding.taskType.retrievalDocument'),
  },
  {
    value: 'RETRIEVAL_QUERY',
    label: t('settings.modal.embedding.taskType.retrievalQuery'),
  },
  {
    value: 'SEMANTIC_SIMILARITY',
    label: t('settings.modal.embedding.taskType.semanticSimilarity'),
  },
  {
    value: 'CLASSIFICATION',
    label: t('settings.modal.embedding.taskType.classification'),
  },
  {
    value: 'CLUSTERING',
    label: t('settings.modal.embedding.taskType.clustering'),
  },
  {
    value: 'QUESTION_ANSWERING',
    label: t('settings.modal.embedding.taskType.questionAnswering'),
  },
  {
    value: 'FACT_VERIFICATION',
    label: t('settings.modal.embedding.taskType.factVerification'),
  },
];

const inputBaseClass =
  'rounded-lg bg-[var(--bg-2)] text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[var(--action-interactive)] placeholder:text-[var(--ink-3)]';

const textareaBaseClass =
  'px-3 py-2 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-shadow duration-160 ease-out focus:ring-2 focus:ring-[var(--action-interactive)]';

export const fullInputClass = `w-full ${inputBaseClass}`;
export const smInputClass = `w-full sm:w-64 ${inputBaseClass}`;
export const textareaClass = `w-full resize-none ${inputBaseClass} ${textareaBaseClass}`;
export const settingsCardClass = 'rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)]/40 p-4';
export const settingsSectionLabelClass = 'text-xs font-medium text-[var(--ink-2)]';
export const settingsSubLabelClass = 'text-xs text-[var(--ink-3)]';
export const settingsHintClass = 'text-[11px] leading-5 text-[var(--ink-3)]';
export const settingsToggleRowClass = 'flex items-start gap-3 text-xs text-[var(--ink-3)]';
