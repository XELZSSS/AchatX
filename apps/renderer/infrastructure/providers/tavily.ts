import type OpenAI from 'openai';
import { TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { buildProxyUrl, getProxyAuthHeadersForTarget } from '@/infrastructure/providers/proxy';
import * as proxyConfig from '../../../shared/proxy-config';
import {
  buildExaPayload,
  buildSearXNGPayload,
  buildTavilyPayload,
  getDefaultTavilyConfig,
  normalizeExaResponse,
  normalizeTavilyConfig,
  resolveSearchEngine,
} from '@/infrastructure/providers/tavilyConfig';

export { getDefaultTavilyConfig, normalizeTavilyConfig } from '@/infrastructure/providers/tavilyConfig';

export const hasSearchConfig = (config?: TavilyConfig): boolean => {
  if (!config) return false;

  switch (resolveSearchEngine(config)) {
    case 'exa':
      return Boolean(config.apiKey);
    case 'searxng':
      return Boolean(config.searxngBaseUrl);
    case 'tavily':
    default:
      return Boolean(config.apiKey);
  }
};

export const buildOpenAITavilyTools = (
  tavilyConfig?: TavilyConfig
): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined => {
  if (!hasSearchConfig(tavilyConfig)) return undefined;
  return [
    {
      type: 'function' as const,
      function: {
        name: 'tavily_search',
        description:
          'Search the web for up-to-date information and return relevant results with sources.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            search_depth: {
              type: 'string',
              enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
              description: 'Search depth',
            },
            max_results: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              description: 'Number of results to return',
            },
            topic: {
              type: 'string',
              enum: ['general', 'news', 'finance'],
              description: 'Search topic',
            },
            include_answer: { type: 'boolean', description: 'Include answer summary' },
          },
          required: ['query'],
        },
      },
    },
  ];
};

export const callTavilySearch = async (
  tavilyConfig: TavilyConfig | undefined,
  args: {
    query: string;
    search_depth?: TavilyConfig['searchDepth'];
    max_results?: number;
    topic?: TavilyConfig['topic'];
    include_answer?: boolean;
  }
): Promise<unknown> => {
  if (!hasSearchConfig(tavilyConfig)) {
    throw new Error(t('settings.search.error.missingApiKey'));
  }
  const engine = resolveSearchEngine(tavilyConfig);
  const payload =
    engine === 'exa'
      ? buildExaPayload(tavilyConfig, {
          query: args.query,
          max_results: args.max_results,
        })
      : engine === 'searxng'
        ? buildSearXNGPayload(tavilyConfig, {
            query: args.query,
          })
        : buildTavilyPayload(tavilyConfig, args);
  const proxyUrl = buildProxyUrl(
    `${
      engine === 'exa'
        ? proxyConfig.PROXY_ROUTES.exa
        : engine === 'searxng'
          ? proxyConfig.PROXY_ROUTES.searxng
          : proxyConfig.PROXY_ROUTES.tavily
    }/search`
  );
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(engine === 'exa'
        ? { 'x-api-key': tavilyConfig.apiKey }
        : engine === 'searxng'
          ? { 'x-searxng-base-url': tavilyConfig.searxngBaseUrl ?? '' }
          : { Authorization: `Bearer ${tavilyConfig.apiKey}` }),
      ...getProxyAuthHeadersForTarget(proxyUrl),
      ...(engine === 'tavily' && tavilyConfig.projectId
        ? { 'X-Project-ID': tavilyConfig.projectId }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${t('settings.search.error.requestFailed')}: ${response.status}`);
  }
  const json = (await response.json()) as unknown;
  return engine === 'exa' ? normalizeExaResponse(json) : json;
};
