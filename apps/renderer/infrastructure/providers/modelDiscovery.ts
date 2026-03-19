import { GoogleGenAI, type Model as GeminiModel } from '@google/genai';
import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import { PROVIDER_IDS } from '../../../shared/provider-ids';
import { t } from '@/shared/utils/i18n';

type DiscoverProviderModelsOptions = {
  providerId: ProviderId;
  apiKey?: string;
  baseUrl?: string;
};

const OPENAI_MODELS_BASE_URL = process.env.OPENAI_BASE_URL;
const NVIDIA_MODELS_BASE_URL = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const XAI_MODELS_BASE_URL = process.env.XAI_BASE_URL ?? 'https://api.x.ai/v1';
const DEEPSEEK_MODELS_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const XIAOMI_MIMO_MODELS_BASE_URL =
  process.env.XIAOMI_MIMO_BASE_URL ?? process.env.XIAOMIMIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1';
const LONGCAT_MODELS_BASE_URL = process.env.LONGCAT_BASE_URL ?? 'https://api.longcat.chat/openai';
const MODEL_DISCOVERY_PROVIDERS: ProviderId[] = [
  'openai',
  'gemini',
  'nvidia',
  'xai',
  'deepseek',
  'xiaomi-mimo',
  'longcat',
];

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const ensureV1BaseUrl = (baseUrl: string): string => {
  const normalized = trimTrailingSlash(baseUrl.trim());
  return /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
};

const assertProviderSubset = (subset: ProviderId[], label: string) => {
  const invalid = subset.filter((id) => !PROVIDER_IDS.includes(id));
  if (invalid.length > 0) {
    throw new Error(`Provider list "${label}" has unknown ids: ${invalid.join(', ')}`);
  }
};

assertProviderSubset(MODEL_DISCOVERY_PROVIDERS, 'MODEL_DISCOVERY_PROVIDERS');

const sortModels = (models: string[]): string[] => {
  return [...models].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  );
};

const dedupeModels = (models: string[]): string[] => {
  return sortModels(Array.from(new Set(models.map((model) => model.trim()).filter(Boolean))));
};

const fetchOpenAICompatibleModels = async (
  apiKey: string,
  baseURL: string | undefined,
  filter: (modelId: string) => boolean
): Promise<string[]> => {
  const client = new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });
  const response = await client.models.list();
  return dedupeModels(response.data.map((model) => model.id).filter(filter));
};

const fetchXaiModels = async (apiKey: string, baseURL: string): Promise<string[]> => {
  const response = await fetch(`${ensureV1BaseUrl(baseURL)}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `xAI model discovery failed: ${response.status}${errorText.trim() ? ` ${errorText.trim()}` : ''}`
    );
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return dedupeModels((payload.data ?? []).map((model) => model.id ?? '').filter(isGrokModel));
};

const isOpenAIChatModel = (modelId: string): boolean => {
  return /^(gpt|chatgpt|o\d|o1|o3|o4|codex|computer-use)/i.test(modelId);
};

const isGrokModel = (modelId: string): boolean => modelId.toLowerCase().startsWith('grok');

const isDeepSeekModel = (modelId: string): boolean => modelId.toLowerCase().startsWith('deepseek');

const isXiaomiMimoModel = (modelId: string): boolean => modelId.toLowerCase().startsWith('mimo-');

const isLongcatModel = (modelId: string): boolean => modelId.toLowerCase().startsWith('longcat');

const isGeminiGenerateModel = (model: GeminiModel): boolean => {
  const modelName = model.name?.replace(/^models\//, '') ?? '';
  if (!modelName.startsWith('gemini')) return false;

  const supportedActions = model.supportedActions ?? [];
  return supportedActions.includes('generateContent');
};

const fetchGeminiModels = async (apiKey: string): Promise<string[]> => {
  const client = new GoogleGenAI({ apiKey });
  const pager = await client.models.list();
  const models: string[] = [];

  for await (const model of pager) {
    if (!isGeminiGenerateModel(model)) continue;
    if (!model.name) continue;
    models.push(model.name.replace(/^models\//, ''));
  }

  return dedupeModels(models);
};

export const supportsProviderModelDiscovery = (providerId: ProviderId): boolean => {
  return MODEL_DISCOVERY_PROVIDERS.includes(providerId);
};

export const isModelDiscoveryApiKeyRequired = (providerId: ProviderId): boolean => {
  return supportsProviderModelDiscovery(providerId);
};

export const discoverProviderModels = async ({
  providerId,
  apiKey,
  baseUrl,
}: DiscoverProviderModelsOptions): Promise<string[]> => {
  const normalizedApiKey = apiKey?.trim() ?? '';

  if (isModelDiscoveryApiKeyRequired(providerId) && !normalizedApiKey) {
    throw new Error(t('settings.modelDiscovery.error.missingApiKey'));
  }

  switch (providerId) {
    case 'openai':
      return fetchOpenAICompatibleModels(
        normalizedApiKey,
        OPENAI_MODELS_BASE_URL,
        isOpenAIChatModel
      );
    case 'xai':
      return fetchXaiModels(normalizedApiKey, XAI_MODELS_BASE_URL);
    case 'nvidia':
      return fetchOpenAICompatibleModels(normalizedApiKey, NVIDIA_MODELS_BASE_URL, () => true);
    case 'deepseek':
      return fetchOpenAICompatibleModels(
        normalizedApiKey,
        DEEPSEEK_MODELS_BASE_URL,
        isDeepSeekModel
      );
    case 'xiaomi-mimo':
      return fetchOpenAICompatibleModels(
        normalizedApiKey,
        baseUrl?.trim() || XIAOMI_MIMO_MODELS_BASE_URL,
        isXiaomiMimoModel
      );
    case 'longcat':
      return fetchOpenAICompatibleModels(
        normalizedApiKey,
        baseUrl?.trim() || LONGCAT_MODELS_BASE_URL,
        isLongcatModel
      );
    case 'gemini':
      return fetchGeminiModels(normalizedApiKey);
    default:
      throw new Error(t('settings.modelDiscovery.error.unsupportedProvider'));
  }
};
