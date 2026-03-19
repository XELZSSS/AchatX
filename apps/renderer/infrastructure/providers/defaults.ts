import { GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import { PROVIDER_IDS } from '../../../shared/provider-ids';
import { resolveDefaultBaseUrlForProvider } from '@/infrastructure/providers/baseUrl';
import {
  supportsProviderEmbedding,
  supportsProviderRequestMode,
  supportsProviderTavily,
} from '@/infrastructure/providers/capabilities';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import {
  getDefaultChatAgentEnabled,
  getDefaultChatAgentPrompt,
  getDefaultChatAgentPromptParts,
  getDefaultChatAgentSearchEnabled,
  buildChatAgentPromptFromParts,
} from '@/infrastructure/providers/chatAgent';
import { listProviderIds } from '@/infrastructure/providers/registry';
import { getDefaultTavilyConfig } from '@/infrastructure/providers/tavily';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';

export interface ProviderSettings {
  apiKey?: string;
  modelName: string;
  requestMode?: OpenAIRequestMode;
  baseUrl?: string;
  geminiCliProjectId?: string;
  googleCloudProject?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  embedding?: GeminiEmbeddingConfig;
  chatAgentEnabled?: boolean;
  chatAgentPrompt?: string;
  chatAgentPromptParts?: import('@/infrastructure/providers/prompts').ChatAgentPromptParts;
  chatAgentSearchEnabled?: boolean;
}

const envApiKeyResolvers = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = PROVIDER_CONFIGS[id].envApiKeyResolver;
    return acc;
  },
  {} as Record<ProviderId, () => string | undefined>
);

export const getEnvApiKey = (providerId: ProviderId): string | undefined => {
  return envApiKeyResolvers[providerId]();
};

export const getDefaultProviderSettings = (providerId: ProviderId): ProviderSettings => {
  const defaultPromptParts = getDefaultChatAgentPromptParts(providerId);
  const defaultPrompt = buildChatAgentPromptFromParts(providerId, defaultPromptParts);

  return {
    apiKey: getEnvApiKey(providerId),
    modelName: '',
    requestMode: supportsProviderRequestMode(providerId) ? 'chat_completions' : undefined,
    baseUrl: resolveDefaultBaseUrlForProvider(providerId),
    geminiCliProjectId: undefined,
    googleCloudProject: undefined,
    customHeaders: [],
    tavily: supportsProviderTavily(providerId) ? getDefaultTavilyConfig() : undefined,
    embedding: supportsProviderEmbedding(providerId) ? {} : undefined,
    chatAgentEnabled: getDefaultChatAgentEnabled(providerId),
    chatAgentPrompt: defaultPrompt ?? getDefaultChatAgentPrompt(providerId),
    chatAgentPromptParts: defaultPromptParts,
    chatAgentSearchEnabled: getDefaultChatAgentSearchEnabled(providerId),
  };
};

export const buildDefaultProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  const defaults = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    defaults[id] = getDefaultProviderSettings(id);
  }
  return defaults;
};
