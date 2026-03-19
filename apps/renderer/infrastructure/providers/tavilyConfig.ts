import { TavilyConfig } from '@/shared/types/chat';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';

const clampTavilyMaxResults = (value: number): number =>
  Math.min(Math.max(Math.round(value), 1), 20);

const EXA_SEARCH_TYPES = new Set<TavilyConfig['exaSearchType']>(['auto', 'fast', 'neural', 'deep']);
const SEARXNG_TIME_RANGES = new Set<TavilyConfig['searxngTimeRange']>(['day', 'month', 'year']);
const SEARXNG_SAFE_SEARCH_VALUES = new Set<TavilyConfig['searxngSafeSearch']>([0, 1, 2]);

export const resolveSearchEngine = (config?: TavilyConfig): NonNullable<TavilyConfig['engine']> =>
  config?.engine === 'exa' || config?.engine === 'searxng' ? config.engine : 'tavily';

export const normalizeSearxngBaseUrl = (value?: string): string | undefined => {
  const raw = value?.trim();
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return undefined;
    }
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    if (url.pathname.endsWith('/search')) {
      url.pathname = url.pathname.slice(0, -'/search'.length) || '/';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
};

const parseOptionalBooleanEnv = (value: string | undefined): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

export const buildTavilyPayload = (
  tavilyConfig: TavilyConfig,
  args: {
    query: string;
    search_depth?: TavilyConfig['searchDepth'];
    max_results?: number;
    topic?: TavilyConfig['topic'];
    include_answer?: boolean;
  }
) => ({
  query: args.query,
  search_depth: args.search_depth ?? tavilyConfig.searchDepth ?? 'basic',
  max_results: clampTavilyMaxResults(args.max_results ?? tavilyConfig.maxResults ?? 5),
  topic: args.topic ?? tavilyConfig.topic ?? 'general',
  include_answer: args.include_answer ?? tavilyConfig.includeAnswer ?? true,
});

export const buildExaPayload = (
  tavilyConfig: TavilyConfig,
  args: {
    query: string;
    max_results?: number;
  }
) => ({
  query: args.query,
  type: tavilyConfig.exaSearchType ?? 'auto',
  numResults: clampTavilyMaxResults(args.max_results ?? tavilyConfig.maxResults ?? 5),
});

export const buildSearXNGPayload = (
  tavilyConfig: TavilyConfig,
  args: {
    query: string;
  }
) => ({
  q: args.query,
  format: 'json',
  language: tavilyConfig.searxngLanguage?.trim() || 'all',
  categories: tavilyConfig.searxngCategories?.trim() || 'general',
  time_range: tavilyConfig.searxngTimeRange,
  safesearch: tavilyConfig.searxngSafeSearch ?? 1,
});

export const normalizeExaResponse = (payload: unknown) => {
  const raw = (payload ?? {}) as {
    requestId?: unknown;
    autopromptString?: unknown;
    results?: Array<{
      title?: unknown;
      url?: unknown;
      publishedDate?: unknown;
      author?: unknown;
      text?: unknown;
      summary?: unknown;
      highlights?: unknown;
      score?: unknown;
    }>;
  };

  return {
    engine: 'exa' as const,
    requestId: typeof raw.requestId === 'string' ? raw.requestId : undefined,
    autopromptString: typeof raw.autopromptString === 'string' ? raw.autopromptString : undefined,
    results: Array.isArray(raw.results)
      ? raw.results.map((result) => ({
          title: typeof result?.title === 'string' ? result.title : '',
          url: typeof result?.url === 'string' ? result.url : '',
          publishedDate:
            typeof result?.publishedDate === 'string' ? result.publishedDate : undefined,
          author: typeof result?.author === 'string' ? result.author : undefined,
          text: typeof result?.text === 'string' ? result.text : undefined,
          summary: typeof result?.summary === 'string' ? result.summary : undefined,
          highlights: Array.isArray(result?.highlights)
            ? result.highlights.filter((item): item is string => typeof item === 'string')
            : undefined,
          score: typeof result?.score === 'number' ? result.score : undefined,
        }))
      : [],
  };
};

export const normalizeTavilyConfig = (value?: TavilyConfig): TavilyConfig | undefined => {
  if (!value) return undefined;
  const engine = resolveSearchEngine(value);
  const apiKey = sanitizeApiKey(value.apiKey);
  const projectId = value.projectId?.trim() || undefined;
  const searchDepth = value.searchDepth;
  const maxResults =
    typeof value.maxResults === 'number' && Number.isFinite(value.maxResults)
      ? clampTavilyMaxResults(value.maxResults)
      : undefined;
  const topic = value.topic;
  const includeAnswer = value.includeAnswer ?? undefined;
  const exaSearchType = EXA_SEARCH_TYPES.has(value.exaSearchType) ? value.exaSearchType : undefined;
  const searxngBaseUrl = normalizeSearxngBaseUrl(value.searxngBaseUrl);
  const searxngCategories = value.searxngCategories?.trim() || undefined;
  const searxngLanguage = value.searxngLanguage?.trim() || undefined;
  const searxngTimeRange = SEARXNG_TIME_RANGES.has(value.searxngTimeRange)
    ? value.searxngTimeRange
    : undefined;
  const searxngSafeSearch = SEARXNG_SAFE_SEARCH_VALUES.has(value.searxngSafeSearch)
    ? value.searxngSafeSearch
    : undefined;
  if (
    !apiKey &&
    !projectId &&
    !searchDepth &&
    !maxResults &&
    !topic &&
    includeAnswer === undefined &&
    !exaSearchType &&
    !searxngBaseUrl &&
    !searxngCategories &&
    !searxngLanguage &&
    !searxngTimeRange &&
    searxngSafeSearch === undefined
  ) {
    return undefined;
  }
  return {
    engine,
    apiKey,
    projectId,
    searchDepth,
    maxResults,
    topic,
    includeAnswer,
    exaSearchType,
    searxngBaseUrl,
    searxngCategories,
    searxngLanguage,
    searxngTimeRange,
    searxngSafeSearch,
  };
};

export const getDefaultTavilyConfig = (): TavilyConfig | undefined => {
  const apiKey = sanitizeApiKey(process.env.TAVILY_API_KEY);
  const exaApiKey = sanitizeApiKey(process.env.EXA_API_KEY);
  const searxngBaseUrl = normalizeSearxngBaseUrl(process.env.SEARXNG_BASE_URL);

  if (apiKey) {
    const maxResults = process.env.TAVILY_MAX_RESULTS
      ? Number.parseInt(process.env.TAVILY_MAX_RESULTS, 10)
      : undefined;
    return normalizeTavilyConfig({
      engine: 'tavily',
      apiKey,
      projectId: process.env.TAVILY_PROJECT_ID,
      searchDepth: process.env.TAVILY_SEARCH_DEPTH as TavilyConfig['searchDepth'],
      maxResults,
      topic: process.env.TAVILY_TOPIC as TavilyConfig['topic'],
      includeAnswer: parseOptionalBooleanEnv(process.env.TAVILY_INCLUDE_ANSWER),
    });
  }

  if (exaApiKey) {
    return normalizeTavilyConfig({
      engine: 'exa',
      apiKey: exaApiKey,
      maxResults: process.env.EXA_MAX_RESULTS
        ? Number.parseInt(process.env.EXA_MAX_RESULTS, 10)
        : undefined,
      exaSearchType: process.env.EXA_SEARCH_TYPE as TavilyConfig['exaSearchType'],
    });
  }

  if (searxngBaseUrl) {
    return normalizeTavilyConfig({
      engine: 'searxng',
      searxngBaseUrl,
      searxngCategories: process.env.SEARXNG_CATEGORIES,
      searxngLanguage: process.env.SEARXNG_LANGUAGE,
      searxngTimeRange: process.env.SEARXNG_TIME_RANGE as TavilyConfig['searxngTimeRange'],
      searxngSafeSearch: process.env.SEARXNG_SAFE_SEARCH
        ? (Number.parseInt(process.env.SEARXNG_SAFE_SEARCH, 10) as TavilyConfig['searxngSafeSearch'])
        : undefined,
    });
  }

  return undefined;
};
