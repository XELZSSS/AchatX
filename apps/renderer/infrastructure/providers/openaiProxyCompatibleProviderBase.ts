import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role } from '@/shared/types/chat';
import {
  buildReasoningEffortExtraBody,
  shouldEmitReasoning,
  streamWithToolCallLoopAndAccumulate,
  ToolLoopOverrides,
} from '@/infrastructure/providers/openaiChatHelpers';
import { OpenAIResponsesProviderBase } from '@/infrastructure/providers/openaiResponsesProviderBase';
import { getProxyAuthHeadersForTarget } from '@/infrastructure/providers/proxy';
import { buildOpenAITavilyTools, normalizeTavilyConfig } from '@/infrastructure/providers/tavily';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { normalizeCustomHeaders } from '@/infrastructure/providers/headerUtils';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';

type OpenAIProxyCompatibleProviderBaseOptions = {
  id: ProviderId;
  defaultModel: string;
  defaultApiKey?: string;
  fallbackApiKey?: string;
  proxyBaseUrl: string;
  defaultTargetBaseUrl?: string;
  missingApiKeyError?: string;
  missingBaseUrlError: string;
  logLabel: string;
  supportsTavily?: boolean;
};

export abstract class OpenAIProxyCompatibleProviderBase extends OpenAIResponsesProviderBase {
  protected readonly id: ProviderId;
  protected apiKey?: string;
  protected client: OpenAI | null = null;
  protected targetBaseUrl?: string;
  protected customHeaders: Array<{ key: string; value: string }> = [];
  protected chatAgentSearchEnabled = true;
  protected requestMode: OpenAIRequestMode = 'chat_completions';

  private readonly defaultApiKey?: string;
  private readonly fallbackApiKey?: string;
  private readonly proxyBaseUrl: string;
  private readonly missingApiKeyError?: string;
  private readonly missingBaseUrlError: string;
  private readonly logLabel: string;
  private readonly supportsTavily: boolean;

  constructor(options: OpenAIProxyCompatibleProviderBaseOptions) {
    super(options.defaultModel);
    this.id = options.id;
    this.defaultApiKey = options.defaultApiKey;
    this.fallbackApiKey = options.fallbackApiKey;
    this.proxyBaseUrl = options.proxyBaseUrl;
    this.missingApiKeyError = options.missingApiKeyError;
    this.missingBaseUrlError = options.missingBaseUrlError;
    this.logLabel = options.logLabel;
    this.supportsTavily = options.supportsTavily ?? false;

    this.apiKey = options.defaultApiKey;
    this.targetBaseUrl = options.defaultTargetBaseUrl;
    if (!this.supportsTavily) {
      this.tavilyConfig = undefined;
    }
  }

  protected resolveTargetBaseUrl(baseUrl?: string): string | undefined {
    return baseUrl;
  }

  protected getToolLoopOverrides(): ToolLoopOverrides {
    return {};
  }

  protected getProxyRequestHeaders(): Record<string, string> {
    return {};
  }

  private resolveApiKey(): string | undefined {
    return this.apiKey ?? this.defaultApiKey ?? this.fallbackApiKey;
  }

  protected getClient(): OpenAI {
    const keyToUse = this.resolveApiKey();
    if (!keyToUse && this.missingApiKeyError) {
      throw new Error(this.missingApiKeyError);
    }
    if (!this.targetBaseUrl) {
      throw new Error(this.missingBaseUrlError);
    }
    if (!this.client) {
      const headersPayload = normalizeCustomHeaders(this.customHeaders);
      this.client = new OpenAI({
        apiKey: keyToUse ?? 'placeholder',
        baseURL: this.proxyBaseUrl,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'x-openai-compatible-base-url': this.targetBaseUrl,
          'x-openai-compatible-headers': JSON.stringify(headersPayload),
          ...this.getProxyRequestHeaders(),
          ...getProxyAuthHeadersForTarget(this.proxyBaseUrl),
        },
      });
    }
    return this.client;
  }

  private buildChatCompletionTools(): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    if (!this.supportsTavily) return undefined;
    if (!this.chatAgentEnabled) return undefined;
    return buildOpenAITavilyTools(this.tavilyConfig);
  }

  private buildResponsesTools() {
    if (!this.supportsTavily) return undefined;
    return this.buildResponseTools();
  }

  private async runResponsesToolCall(
    call: import('@/infrastructure/providers/responsesShared').ResponseFunctionCallItem
  ) {
    return this.runDefaultToolCall(call, {
      unsupportedTool: (toolName) => `Unsupported tool: ${toolName}`,
      missingQuery: 'Missing query for tavily_search',
    });
  }

  getId(): ProviderId {
    return this.id;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? this.defaultApiKey;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
    }
  }

  getBaseUrl(): string | undefined {
    return this.targetBaseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = this.resolveTargetBaseUrl(baseUrl);
    if (nextUrl !== this.targetBaseUrl) {
      this.targetBaseUrl = nextUrl;
      this.client = null;
    }
  }

  getCustomHeaders(): Array<{ key: string; value: string }> | undefined {
    return this.customHeaders;
  }

  setCustomHeaders(headers: Array<{ key: string; value: string }>): void {
    const normalized = normalizeCustomHeaders(headers);
    this.customHeaders = normalized;
    this.client = null;
  }

  setTavilyConfig(config?: import('@/shared/types/chat').TavilyConfig): void {
    if (!this.supportsTavily) return;
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  getChatAgentSearchEnabled(): boolean {
    return this.chatAgentSearchEnabled;
  }

  setChatAgentSearchEnabled(enabled: boolean): void {
    this.chatAgentSearchEnabled = enabled;
  }

  getRequestMode(): OpenAIRequestMode {
    return this.requestMode;
  }

  setRequestMode(mode: OpenAIRequestMode): void {
    this.requestMode = mode;
  }

  protected createUserMessage(message: string): ChatMessage {
    return {
      id: `${this.id}-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };
  }

  protected createModelMessage(fullResponse: string): ChatMessage {
    return {
      id: `${this.id}-model-${Date.now()}`,
      role: Role.Model,
      text: fullResponse,
      timestamp: Date.now(),
    };
  }

  protected getResponsesLogLabel(): string {
    return `${this.logLabel} responses`;
  }

  private async *sendChatCompletionsMessageStream(
    message: string,
    client: OpenAI,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const userMessage = this.createUserMessage(message);
    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    try {
      const tools = this.buildChatCompletionTools();
      const emitReasoning = this.reasoningPreference.enabled && shouldEmitReasoning(message);
      const toolLoopOverrides = this.getToolLoopOverrides();
      const fullResponse = yield* streamWithToolCallLoopAndAccumulate({
        client,
        model: this.modelName,
        messages,
        tools,
        tavilyConfig: this.tavilyConfig,
        toolCallsEnabled: this.chatAgentSearchEnabled,
        signal,
        requestPolicy,
        buildToolMessages: this.buildToolMessages.bind(this),
        emitPreflightMessageWhenNoToolCalls: true,
        emitReasoning,
        ...toolLoopOverrides,
        extraBody: {
          ...(toolLoopOverrides.extraBody ?? {}),
          ...(buildReasoningEffortExtraBody(this.modelName, emitReasoning) ?? {}),
        },
      });

      const modelMessage = this.createModelMessage(fullResponse ?? '');
      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error(`Error in ${this.logLabel} stream:`, error);
      throw error;
    }
  }

  private async *sendResponsesModeMessageStream(
    message: string,
    client: OpenAI,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const { emitReasoning, reasoning } = this.buildResponseReasoningConfig(message, 'medium');

    yield* this.sendResponsesMessageStream({
      client,
      message,
      signal,
      requestPolicy,
      tools: this.buildResponsesTools(),
      runToolCall: this.runResponsesToolCall.bind(this),
      userMessageIdPrefix: `${this.id}-user`,
      modelMessageIdPrefix: `${this.id}-model`,
      failureMessage: 'OpenAI-compatible response stream failed',
      missingFollowUpResponseIdMessage:
        'Missing OpenAI-compatible response id for function-call follow-up.',
      buildMaxRoundsError: (maxRounds) =>
        `Exceeded maximum OpenAI-compatible tool call rounds: ${maxRounds}`,
      emitReasoning,
      reasoning,
    });
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    if (this.requestMode === 'responses') {
      yield* this.sendResponsesModeMessageStream(message, client, signal, requestPolicy);
      return;
    }

    yield* this.sendChatCompletionsMessageStream(message, client, signal, requestPolicy);
  }
}
