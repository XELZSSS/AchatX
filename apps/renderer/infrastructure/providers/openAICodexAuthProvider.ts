import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { t } from '@/shared/utils/i18n';
import { getOpenAICodexAuthSession } from '@/infrastructure/auth/openAICodexAuth';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { OpenAIResponsesProviderBase } from '@/infrastructure/providers/openaiResponsesProviderBase';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { ResponseFunctionCallItem } from '@/infrastructure/providers/responsesShared';
import { ProviderChat } from '@/infrastructure/providers/types';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';

export const OPENAI_CODEX_AUTH_PROVIDER_ID: ProviderId = 'openai-codex-auth';
const { defaultModel: DEFAULT_OPENAI_CODEX_AUTH_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[OPENAI_CODEX_AUTH_PROVIDER_ID].modelSpec
);

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api';
const DUMMY_API_KEY = 'chatgpt-oauth';

const normalizeCodexModel = (modelName: string): string => {
  const normalized = modelName.trim().toLowerCase();
  const directMap: Record<string, string> = {
    'gpt-5': 'gpt-5.1',
    'gpt-5-codex': 'gpt-5.1-codex',
    'gpt-5-codex-mini': 'gpt-5.1-codex-mini',
    'codex-mini-latest': 'gpt-5.1-codex-mini',
  };

  if (directMap[normalized]) {
    return directMap[normalized];
  }

  const suffixes = ['-none', '-low', '-medium', '-high', '-xhigh'];
  const matchedSuffix = suffixes.find((suffix) => normalized.endsWith(suffix));
  if (!matchedSuffix) {
    return normalized || DEFAULT_OPENAI_CODEX_AUTH_MODEL;
  }

  const stripped = normalized.slice(0, -matchedSuffix.length);
  if (stripped === 'gpt-5.4') return stripped;
  if (stripped === 'gpt-5.3-codex') return stripped;
  if (stripped === 'gpt-5.2' || stripped === 'gpt-5.2-codex') return stripped;
  if (stripped === 'gpt-5.1' || stripped === 'gpt-5.1-codex') return stripped;
  if (stripped === 'gpt-5.1-codex-max') return stripped;
  if (stripped === 'gpt-5.1-codex-mini') return stripped;
  return directMap[stripped] ?? stripped;
};

const normalizeReasoningEffort = (modelName: string, effort?: string): string | undefined => {
  if (!effort) return undefined;

  const normalizedModel = normalizeCodexModel(modelName);
  const isCodexMini = normalizedModel === 'gpt-5.1-codex-mini';
  const supportsXhigh =
    normalizedModel === 'gpt-5.4' ||
    normalizedModel === 'gpt-5.3-codex' ||
    normalizedModel === 'gpt-5.2' ||
    normalizedModel === 'gpt-5.2-codex' ||
    normalizedModel === 'gpt-5.1-codex-max';
  const supportsNone =
    normalizedModel === 'gpt-5.1' || normalizedModel === 'gpt-5.2' || normalizedModel === 'gpt-5.4';

  let next = effort;
  if (next === 'minimal') next = 'low';
  if (!supportsXhigh && next === 'xhigh') next = 'high';
  if (!supportsNone && next === 'none') next = 'low';

  if (isCodexMini) {
    if (next === 'low' || next === 'none') next = 'medium';
    if (next === 'xhigh') next = 'high';
  }

  return next;
};

const extractRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const rewriteUrlForCodex = (url: string): string => url.replace('/responses', '/codex/responses');

const transformRequestInitForCodex = (init?: RequestInit) => {
  if (!init?.body || typeof init.body !== 'string') {
    return {
      requestInit: init,
      promptCacheKey: undefined,
    };
  }

  try {
    const body = JSON.parse(init.body) as {
      model?: string;
      stream?: boolean;
      store?: boolean;
      include?: string[];
      reasoning?: { effort?: string; summary?: 'auto' };
      prompt_cache_key?: string;
    };

    const normalizedModel = normalizeCodexModel(body.model ?? DEFAULT_OPENAI_CODEX_AUTH_MODEL);
    const nextInclude = Array.from(
      new Set([...(Array.isArray(body.include) ? body.include : []), 'reasoning.encrypted_content'])
    );

    const nextBody = {
      ...body,
      model: normalizedModel,
      store: false,
      stream: true,
      include: nextInclude,
      reasoning: body.reasoning
        ? {
            ...body.reasoning,
            effort: normalizeReasoningEffort(normalizedModel, body.reasoning.effort ?? 'medium'),
          }
        : body.reasoning,
    };

    return {
      requestInit: {
        ...init,
        body: JSON.stringify(nextBody),
      },
      promptCacheKey: nextBody.prompt_cache_key,
    };
  } catch {
    return {
      requestInit: init,
      promptCacheKey: undefined,
    };
  }
};

const createCodexHeaders = (
  headersInit: HeadersInit | undefined,
  session: { accessToken: string; accountId?: string },
  promptCacheKey?: string
) => {
  const headers = new Headers(headersInit ?? {});
  headers.delete('x-api-key');
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (session.accountId) {
    headers.set('chatgpt-account-id', session.accountId);
  }
  headers.set('OpenAI-Beta', 'responses=experimental');
  headers.set('originator', 'codex_cli_rs');
  headers.set('accept', 'text/event-stream');

  if (promptCacheKey) {
    headers.set('conversation_id', promptCacheKey);
    headers.set('session_id', promptCacheKey);
  } else {
    headers.delete('conversation_id');
    headers.delete('session_id');
  }

  return headers;
};

class OpenAICodexAuthProvider extends OpenAIResponsesProviderBase implements ProviderChat {
  private readonly id: ProviderId = OPENAI_CODEX_AUTH_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;

  constructor() {
    super(DEFAULT_OPENAI_CODEX_AUTH_MODEL);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: DUMMY_API_KEY,
        baseURL: CODEX_BASE_URL,
        dangerouslyAllowBrowser: true,
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const session = await getOpenAICodexAuthSession();
          if (!session?.authenticated || !session.accessToken) {
            throw new Error(t('settings.provider.error.openaiCodexAuth.missingLogin'));
          }

          const originalUrl = extractRequestUrl(input);
          const url = rewriteUrlForCodex(originalUrl);
          const { requestInit, promptCacheKey } = transformRequestInitForCodex(init);
          const headers = createCodexHeaders(requestInit?.headers, session, promptCacheKey);

          return fetch(url, {
            ...requestInit,
            headers,
          });
        },
      });
    }
    return this.client;
  }

  private buildTools() {
    return this.buildResponseTools();
  }

  private async runToolCall(call: ResponseFunctionCallItem): Promise<string> {
    return this.runDefaultToolCall(call, {
      unsupportedTool: (toolName) =>
        `${t('settings.provider.error.tool.unsupported')}: ${toolName}`,
      missingQuery: t('settings.provider.error.tool.missingQuery'),
    });
  }

  getId(): ProviderId {
    return this.id;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = sanitizeApiKey(apiKey);
  }

  protected getResponsesLogLabel(): string {
    return 'OpenAI Codex';
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();
    const { emitReasoning, reasoning } = this.buildResponseReasoningConfig(
      message,
      normalizeReasoningEffort(this.modelName, 'medium')
    );

    yield* this.sendResponsesMessageStream({
      client,
      message,
      signal,
      requestPolicy,
      tools: this.buildTools(),
      runToolCall: this.runToolCall.bind(this),
      userMessageIdPrefix: 'openai-codex-user',
      modelMessageIdPrefix: 'openai-codex-model',
      failureMessage: 'OpenAI Codex response stream failed',
      missingFollowUpResponseIdMessage:
        'Missing OpenAI Codex response id for function-call follow-up.',
      buildMaxRoundsError: (maxRounds) =>
        `Exceeded maximum OpenAI Codex tool call rounds: ${maxRounds}`,
      emitReasoning,
      reasoning,
      usePreviousResponseIdForFollowUps: false,
      requireResponseIdForFollowUps: true,
    });
  }
}

export const createProviderInstance = (): ProviderChat => new OpenAICodexAuthProvider();
