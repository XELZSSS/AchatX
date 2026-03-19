import { ProviderId } from '@/shared/types/chat';
import { buildProxyUrl } from '@/infrastructure/providers/proxy';
import * as proxyConfig from '../../../shared/proxy-config';

export type ProviderRegion = 'intl' | 'cn';

const MINIMAX_BASE_URLS = {
  intl: buildProxyUrl(proxyConfig.PROXY_ROUTES.minimaxIntl),
  cn: buildProxyUrl(proxyConfig.PROXY_ROUTES.minimaxCn),
} as const;

const MOONSHOT_BASE_URLS = {
  intl: buildProxyUrl(proxyConfig.PROXY_ROUTES.moonshotIntl),
  cn: buildProxyUrl(proxyConfig.PROXY_ROUTES.moonshotCn),
} as const;

const GLM_BASE_URLS = {
  intl: buildProxyUrl(proxyConfig.PROXY_ROUTES.glmIntl),
  cn: buildProxyUrl(proxyConfig.PROXY_ROUTES.glmCn),
} as const;

const normalizeGlmBaseUrl = (value: string): string => {
  return resolveBaseUrl(value).replace(/\/responses\/?$/i, '');
};

export const normalizeBaseUrlForProvider = (providerId: ProviderId, value: string): string => {
  if (providerId === 'glm') {
    return normalizeGlmBaseUrl(value);
  }
  return resolveBaseUrl(value);
};

const normalizeEnvBaseUrl = (
  providerId: ProviderId | undefined,
  value?: string
): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'undefined') return undefined;
  if (!providerId) return resolveBaseUrl(trimmed);
  return normalizeBaseUrlForProvider(providerId, trimmed);
};

const prefersChinaEndpoint = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const lang = navigator.language?.toLowerCase() ?? '';
  return lang.startsWith('zh');
};

export const resolveBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (typeof window !== 'undefined') {
    return new URL(trimmed, window.location.origin).toString();
  }
  return trimmed;
};

const resolveRegionalDefaultBaseUrl = (
  providerId: ProviderId,
  envOverride: string | undefined,
  urls: { intl: string; cn: string }
): string => {
  const resolvedOverride = normalizeEnvBaseUrl(providerId, envOverride);
  if (resolvedOverride) return resolvedOverride;
  if (prefersChinaEndpoint()) return normalizeBaseUrlForProvider(providerId, urls.cn);
  return normalizeBaseUrlForProvider(providerId, urls.intl);
};

export const getMinimaxBaseUrlForRegion = (region: ProviderRegion): string => {
  return resolveBaseUrl(region === 'cn' ? MINIMAX_BASE_URLS.cn : MINIMAX_BASE_URLS.intl);
};

export const getDefaultMinimaxBaseUrl = (): string => {
  return resolveRegionalDefaultBaseUrl('minimax', process.env.MINIMAX_BASE_URL, MINIMAX_BASE_URLS);
};

export const getMoonshotBaseUrlForRegion = (region: ProviderRegion): string => {
  return resolveBaseUrl(region === 'cn' ? MOONSHOT_BASE_URLS.cn : MOONSHOT_BASE_URLS.intl);
};

export const getDefaultMoonshotBaseUrl = (): string => {
  return resolveRegionalDefaultBaseUrl(
    'moonshot',
    process.env.MOONSHOT_BASE_URL,
    MOONSHOT_BASE_URLS
  );
};

export const getGlmBaseUrlForRegion = (region: ProviderRegion): string => {
  return normalizeBaseUrlForProvider(
    'glm',
    region === 'cn' ? GLM_BASE_URLS.cn : GLM_BASE_URLS.intl
  );
};

export const getDefaultGlmBaseUrl = (): string => {
  return resolveRegionalDefaultBaseUrl('glm', process.env.GLM_BASE_URL, GLM_BASE_URLS);
};

export const getDefaultOpenAICompatibleBaseUrl = (): string | undefined => {
  return normalizeEnvBaseUrl('openai-compatible', process.env.OPENAI_COMPATIBLE_BASE_URL);
};

export const getDefaultLongcatBaseUrl = (): string => {
  return (
    normalizeEnvBaseUrl('longcat', process.env.LONGCAT_BASE_URL) ??
    'https://api.longcat.chat/openai'
  );
};

export const getDefaultXiaomiMimoBaseUrl = (): string => {
  return (
    normalizeEnvBaseUrl(
      'xiaomi-mimo',
      process.env.XIAOMI_MIMO_BASE_URL ?? process.env.XIAOMIMIMO_BASE_URL
    ) ?? 'https://api.xiaomimimo.com/v1'
  );
};

const providerDefaultBaseUrlResolvers: Partial<Record<ProviderId, () => string | undefined>> = {
  minimax: getDefaultMinimaxBaseUrl,
  moonshot: getDefaultMoonshotBaseUrl,
  glm: getDefaultGlmBaseUrl,
  'openai-compatible': getDefaultOpenAICompatibleBaseUrl,
  'xiaomi-mimo': getDefaultXiaomiMimoBaseUrl,
  longcat: getDefaultLongcatBaseUrl,
};

const providerRegionalBaseUrlResolvers: Partial<Record<ProviderId, (r: ProviderRegion) => string>> =
  {
    moonshot: getMoonshotBaseUrlForRegion,
    glm: getGlmBaseUrlForRegion,
    minimax: getMinimaxBaseUrlForRegion,
  };

export const resolveDefaultBaseUrlForProvider = (providerId: ProviderId): string | undefined => {
  return providerDefaultBaseUrlResolvers[providerId]?.();
};

export const resolveBaseUrlForProvider = (
  providerId: ProviderId,
  override?: string
): string | undefined => {
  const nextUrl = override?.trim();
  if (nextUrl) return normalizeBaseUrlForProvider(providerId, nextUrl);
  return resolveDefaultBaseUrlForProvider(providerId);
};

export const resolveBaseUrlForRegion = (providerId: ProviderId, region: ProviderRegion): string => {
  return (providerRegionalBaseUrlResolvers[providerId] ?? getMinimaxBaseUrlForRegion)(region);
};
