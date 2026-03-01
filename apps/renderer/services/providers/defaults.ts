import { ProviderId, TavilyConfig } from '../../types';
import { resolveDefaultBaseUrlForProvider } from './baseUrl';
import { supportsProviderTavily } from './capabilities';
import { getProviderDefaultModel, listProviderIds } from './registry';
import { getDefaultTavilyConfig } from './tavily';
import { sanitizeApiKey } from './utils';

export interface ProviderSettings {
  apiKey?: string;
  modelName: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
}

const getDefaultCustomHeaders = (providerId: ProviderId): Array<{ key: string; value: string }> => {
  if (providerId !== 'openrouter') return [];

  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim();
  const appName = process.env.OPENROUTER_APP_NAME?.trim();
  const headers: Array<{ key: string; value: string }> = [];

  if (siteUrl && siteUrl !== 'undefined') {
    headers.push({ key: 'HTTP-Referer', value: siteUrl });
  }
  if (appName && appName !== 'undefined') {
    headers.push({ key: 'X-Title', value: appName });
  }

  return headers;
};

const envApiKeyResolvers: Record<ProviderId, () => string | undefined> = {
  openai: () => sanitizeApiKey(process.env.OPENAI_API_KEY),
  'openai-compatible': () => sanitizeApiKey(process.env.OPENAI_COMPATIBLE_API_KEY),
  openrouter: () => sanitizeApiKey(process.env.OPENROUTER_API_KEY),
  ollama: () => sanitizeApiKey(process.env.OLLAMA_API_KEY),
  xai: () => sanitizeApiKey(process.env.XAI_API_KEY),
  deepseek: () => sanitizeApiKey(process.env.DEEPSEEK_API_KEY),
  glm: () => sanitizeApiKey(process.env.GLM_API_KEY),
  minimax: () => sanitizeApiKey(process.env.MINIMAX_API_KEY),
  moonshot: () => sanitizeApiKey(process.env.MOONSHOT_API_KEY),
  iflow: () => sanitizeApiKey(process.env.IFLOW_API_KEY),
  gemini: () => sanitizeApiKey(process.env.GEMINI_API_KEY ?? process.env.API_KEY),
};

export const getEnvApiKey = (providerId: ProviderId): string | undefined => {
  return envApiKeyResolvers[providerId]();
};

export const getDefaultProviderSettings = (providerId: ProviderId): ProviderSettings => ({
  apiKey: getEnvApiKey(providerId),
  modelName: getProviderDefaultModel(providerId),
  baseUrl: resolveDefaultBaseUrlForProvider(providerId),
  customHeaders: getDefaultCustomHeaders(providerId),
  tavily: supportsProviderTavily(providerId) ? getDefaultTavilyConfig() : undefined,
});

export const buildDefaultProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  const defaults = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    defaults[id] = getDefaultProviderSettings(id);
  }
  return defaults;
};
