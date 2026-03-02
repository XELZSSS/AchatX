import { ProviderId } from '../../types';
import { PROVIDER_CAPABILITIES } from '../../services/providers/capabilities';
import {
  resolveBaseUrlForProvider as resolveProviderBaseUrl,
  resolveBaseUrlForRegion as resolveProviderRegionalBaseUrl,
} from '../../services/providers/baseUrl';
import { t } from '../../utils/i18n';
import { DropdownOption } from '../settings/Dropdown';

export const resolveBaseUrlForProvider = (
  providerId: ProviderId,
  override?: string
): string | undefined => {
  return resolveProviderBaseUrl(providerId, override);
};

export const resolveBaseUrlForRegion = (providerId: ProviderId, region: 'intl' | 'cn'): string => {
  return resolveProviderRegionalBaseUrl(providerId, region);
};

export const providerMeta: Record<
  ProviderId,
  {
    label: string;
    supportsTavily?: boolean;
    supportsBaseUrl?: boolean;
    supportsCustomHeaders?: boolean;
    supportsRegion?: boolean;
  }
> = {
  openai: { label: 'OpenAI', ...PROVIDER_CAPABILITIES.openai },
  'openai-compatible': {
    label: 'OpenAI-Compatible',
    ...PROVIDER_CAPABILITIES['openai-compatible'],
  },
  openrouter: { label: 'OpenRouter', ...PROVIDER_CAPABILITIES.openrouter },
  ollama: { label: 'Ollama', ...PROVIDER_CAPABILITIES.ollama },
  xai: { label: 'xAI', ...PROVIDER_CAPABILITIES.xai },
  gemini: { label: 'Gemini', ...PROVIDER_CAPABILITIES.gemini },
  deepseek: { label: 'DeepSeek', ...PROVIDER_CAPABILITIES.deepseek },
  glm: { label: 'GLM', ...PROVIDER_CAPABILITIES.glm },
  minimax: { label: 'MiniMax', ...PROVIDER_CAPABILITIES.minimax },
  moonshot: { label: 'Moonshot', ...PROVIDER_CAPABILITIES.moonshot },
  iflow: { label: 'iFlow', ...PROVIDER_CAPABILITIES.iflow },
};

export const getTavilySearchDepthOptions = (): DropdownOption[] => [
  { value: 'basic', label: t('settings.modal.tavily.searchDepth.basic') },
  { value: 'advanced', label: t('settings.modal.tavily.searchDepth.advanced') },
  { value: 'fast', label: t('settings.modal.tavily.searchDepth.fast') },
  { value: 'ultra-fast', label: t('settings.modal.tavily.searchDepth.ultraFast') },
];

export const getTavilyTopicOptions = (): DropdownOption[] => [
  { value: 'general', label: t('settings.modal.tavily.topic.general') },
  { value: 'news', label: t('settings.modal.tavily.topic.news') },
  { value: 'finance', label: t('settings.modal.tavily.topic.finance') },
];

const inputBaseClass =
  'rounded-lg bg-[var(--bg-2)] text-[var(--ink-1)] outline-none ring-1 ring-[var(--line-1)] focus:ring-[var(--line-1)] placeholder:text-[var(--ink-3)]';

export const fullInputClass = `w-full ${inputBaseClass}`;
export const smInputClass = `w-full sm:w-64 ${inputBaseClass}`;