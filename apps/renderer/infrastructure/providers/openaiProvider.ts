import OpenAI from 'openai';
import { ProviderId } from '@/shared/types/chat';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { t } from '@/shared/utils/i18n';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { OpenAIResponsesProviderBase } from '@/infrastructure/providers/openaiResponsesProviderBase';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import {
  ResponseFunctionCallItem,
  supportsHostedToolSearch,
} from '@/infrastructure/providers/responsesShared';
import { ProviderChat } from '@/infrastructure/providers/types';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';

export const OPENAI_PROVIDER_ID: ProviderId = 'openai';
const { defaultModel: DEFAULT_OPENAI_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[OPENAI_PROVIDER_ID].modelSpec
);

const DEFAULT_OPENAI_API_KEY = PROVIDER_CONFIGS[OPENAI_PROVIDER_ID].envApiKeyResolver();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

class OpenAIProvider extends OpenAIResponsesProviderBase implements ProviderChat {
  private readonly id: ProviderId = OPENAI_PROVIDER_ID;
  private apiKey?: string;
  private client: OpenAI | null = null;

  constructor() {
    super(DEFAULT_OPENAI_MODEL);
    this.apiKey = DEFAULT_OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    const keyToUse = this.apiKey ?? DEFAULT_OPENAI_API_KEY;
    if (!keyToUse) {
      throw new Error(t('settings.provider.error.openai.missingApiKey'));
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: keyToUse,
        baseURL: OPENAI_BASE_URL,
        dangerouslyAllowBrowser: true,
      });
    }
    return this.client;
  }

  private buildTools() {
    return this.buildResponseTools({
      useHostedToolSearch: supportsHostedToolSearch(this.modelName),
    });
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
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_OPENAI_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
    }
  }

  protected getResponsesLogLabel(): string {
    return 'OpenAI';
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();
    const { emitReasoning, reasoning } = this.buildResponseReasoningConfig(message);

    yield* this.sendResponsesMessageStream({
      client,
      message,
      signal,
      requestPolicy,
      tools: this.buildTools(),
      runToolCall: this.runToolCall.bind(this),
      userMessageIdPrefix: 'openai-user',
      modelMessageIdPrefix: 'openai-model',
      failureMessage: 'OpenAI response stream failed',
      missingFollowUpResponseIdMessage: 'Missing OpenAI response id for function-call follow-up.',
      buildMaxRoundsError: (maxRounds) => `Exceeded maximum OpenAI tool call rounds: ${maxRounds}`,
      emitReasoning,
      reasoning,
    });
  }
}

export const createProviderInstance = (): ProviderChat => new OpenAIProvider();
