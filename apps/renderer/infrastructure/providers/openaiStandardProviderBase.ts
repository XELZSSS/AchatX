import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '@/shared/types/chat';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { OpenAIStyleProviderBase } from '@/infrastructure/providers/openaiBase';
import {
  buildReasoningEffortExtraBody,
  ToolLoopOverrides,
  streamWithToolCallLoopAndAccumulate,
  shouldEmitReasoning,
} from '@/infrastructure/providers/openaiChatHelpers';
import {
  buildOpenAITavilyTools,
  getDefaultTavilyConfig,
  normalizeTavilyConfig,
} from '@/infrastructure/providers/tavily';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';
import type { ProviderReasoningPreference } from '@/infrastructure/providers/types';

type OpenAIStandardProviderBaseOptions = {
  id: ProviderId;
  defaultModel: string;
  defaultApiKey?: string;
  missingApiKeyError: string;
  logLabel: string;
};

export abstract class OpenAIStandardProviderBase extends OpenAIStyleProviderBase {
  protected readonly id: ProviderId;
  protected apiKey?: string;
  protected client: OpenAI | null = null;
  protected modelName: string;
  protected tavilyConfig?: TavilyConfig;
  protected reasoningPreference: ProviderReasoningPreference = { enabled: false };

  private readonly defaultModel: string;
  private readonly defaultApiKey?: string;
  private readonly missingApiKeyError: string;
  private readonly logLabel: string;

  constructor(options: OpenAIStandardProviderBaseOptions) {
    super();
    this.id = options.id;
    this.defaultModel = options.defaultModel;
    this.defaultApiKey = options.defaultApiKey;
    this.missingApiKeyError = options.missingApiKeyError;
    this.logLabel = options.logLabel;
    this.apiKey = options.defaultApiKey;
    this.modelName = options.defaultModel;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  protected abstract createClient(apiKey: string): OpenAI;

  protected getToolLoopOverrides(): ToolLoopOverrides {
    return {};
  }

  protected getClient(): OpenAI {
    const keyToUse = this.apiKey ?? this.defaultApiKey;
    if (!keyToUse) {
      throw new Error(this.missingApiKeyError);
    }
    if (!this.client) {
      this.client = this.createClient(keyToUse);
    }
    return this.client;
  }

  private buildTools(): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    if (!this.chatAgentEnabled) return undefined;
    return buildOpenAITavilyTools(this.tavilyConfig);
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim();
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
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

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  getReasoningPreference(): ProviderReasoningPreference {
    return this.reasoningPreference;
  }

  setReasoningPreference(preference: ProviderReasoningPreference): void {
    this.reasoningPreference = preference;
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

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const userMessage = this.createUserMessage(message);
    const nextHistory = [...this.history, userMessage];
    const messages = this.buildMessages(nextHistory, this.id, this.modelName);

    try {
      const tools = this.buildTools();
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
        ...toolLoopOverrides,
        extraBody: {
          ...(toolLoopOverrides.extraBody ?? {}),
          ...(buildReasoningEffortExtraBody(this.modelName, emitReasoning) ?? {}),
        },
        emitReasoning,
      });

      const modelMessage = this.createModelMessage(fullResponse ?? '');
      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error(`Error in ${this.logLabel} stream:`, error);
      throw error;
    }
  }
}
