import type { TavilySearchDepth, TavilyTopic } from '@/shared/types/chat';

export type AdaptiveToolRequest = {
  query?: string;
  search_depth?: TavilySearchDepth;
  max_results?: number;
  topic?: TavilyTopic;
  include_answer?: boolean;
};

export type RequestPolicyMode = 'serial' | 'balanced' | 'aggressive';

export type RequestPolicy = {
  mode: RequestPolicyMode;
  toolParallelism: number;
  retryBudget: number;
  downgradeOnFailure: boolean;
  reason: string;
};

const MAX_ADAPTIVE_TOOL_PARALLELISM = 3;
const LONG_QUERY_THRESHOLD = 80;
const REQUEST_POLICY_DEBUG_STORAGE_KEY = 'orlinx_debug_request_policy';
const SEARCH_INTENT_PATTERN =
  /最新|搜索|查一下|查证|对比|新闻|资料|来源|联网|web|search|latest|news|compare|source|research/i;

const clampParallelism = (value: number, requestCount: number): number => {
  return Math.max(1, Math.min(value, requestCount, MAX_ADAPTIVE_TOOL_PARALLELISM));
};

const buildRequestPolicy = (
  mode: RequestPolicyMode,
  toolParallelism: number,
  reason: string
): RequestPolicy => ({
  mode,
  toolParallelism,
  retryBudget: 1,
  downgradeOnFailure: true,
  reason,
});

export const decideAdaptiveToolParallelism = (requests: AdaptiveToolRequest[]): number => {
  if (requests.length <= 1) return 1;

  const hasComplexIntent = requests.some((request) => {
    const queryLength = request.query?.trim().length ?? 0;
    return (
      queryLength >= LONG_QUERY_THRESHOLD ||
      request.search_depth === 'advanced' ||
      request.search_depth === 'ultra-fast' ||
      (request.max_results ?? 0) >= 8 ||
      request.topic === 'news' ||
      request.topic === 'finance' ||
      request.include_answer === true
    );
  });

  const desired = hasComplexIntent || requests.length >= 3 ? 3 : 2;
  return clampParallelism(desired, requests.length);
};

export const decideRequestPolicyFromPrompt = (message: string): RequestPolicy => {
  const normalized = message.trim();
  const length = normalized.length;
  const hasSearchIntent = SEARCH_INTENT_PATTERN.test(normalized);
  const isComplexTask = length >= 120 || /\n|-\s|\d+\.|；|;/.test(normalized);

  if (hasSearchIntent && isComplexTask) {
    return buildRequestPolicy('aggressive', 3, 'search-intent-and-complex-task');
  }

  if (hasSearchIntent || length >= LONG_QUERY_THRESHOLD) {
    return buildRequestPolicy('balanced', 2, hasSearchIntent ? 'search-intent' : 'long-query');
  }

  return buildRequestPolicy('serial', 1, 'default');
};

export const downgradeRequestPolicy = (policy: RequestPolicy): RequestPolicy => {
  if (!policy.downgradeOnFailure) return policy;

  if (policy.mode === 'aggressive') {
    return {
      ...policy,
      mode: 'balanced',
      toolParallelism: 2,
      reason: `${policy.reason}:downgraded-to-balanced`,
    };
  }

  return {
    ...policy,
    mode: 'serial',
    toolParallelism: 1,
    reason: `${policy.reason}:downgraded-to-serial`,
  };
};

export const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (items.length === 0) return [];

  const normalizedConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = [];
  results.length = items.length;
  let nextIndex = 0;

  const runner = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: normalizedConcurrency }, () => runner()));
  return results;
};

const shouldDebugRequestPolicy = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(REQUEST_POLICY_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const debugLogRequestPolicy = (providerId: string, policy: RequestPolicy): void => {
  if (typeof __APP_ENV__ !== 'undefined' && __APP_ENV__ === 'production') return;
  if (!shouldDebugRequestPolicy()) return;
  console.warn('[request-policy]', {
    providerId,
    mode: policy.mode,
    toolParallelism: policy.toolParallelism,
    retryBudget: policy.retryBudget,
    reason: policy.reason,
  });
};

