import { ChatMessage, ProviderId, Role, TavilyConfig } from '@/shared/types/chat';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { t } from '@/shared/utils/i18n';
import { OpenAIStyleProviderBase } from '@/infrastructure/providers/openaiBase';
import { shouldEmitReasoning } from '@/infrastructure/providers/openaiChatHelpers';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { ProviderChat, type ProviderReasoningPreference } from '@/infrastructure/providers/types';
import { getDefaultTavilyConfig, normalizeTavilyConfig } from '@/infrastructure/providers/tavily';
import {
  buildResponseTavilyTools,
  type ResponseFunctionCallItem,
  type ResponseUsagePayload,
  runResponseTavilyToolCall,
  supportsResponseReasoningSummary,
} from '@/infrastructure/providers/responsesShared';
import { sanitizeApiKey, getMaxToolCallRounds } from '@/infrastructure/providers/utils';
import {
  buildXaiContinuationInput,
  buildXaiInitialInputMessages,
  type XAIResponseRequest,
  type XAIResponseTurnInput,
  streamXaiResponsesTurn,
} from '@/infrastructure/providers/xaiProviderHelpers';

export const XAI_PROVIDER_ID: ProviderId = 'xai';

const { defaultModel: DEFAULT_XAI_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[XAI_PROVIDER_ID].modelSpec
);

const DEFAULT_XAI_API_KEY = PROVIDER_CONFIGS[XAI_PROVIDER_ID].envApiKeyResolver();

class XAIProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = XAI_PROVIDER_ID;
  private apiKey?: string;
  private modelName: string;
  private tavilyConfig?: TavilyConfig;
  private reasoningPreference: ProviderReasoningPreference = { enabled: false };
  private previousResponseId?: string;

  constructor() {
    super();
    this.modelName = DEFAULT_XAI_MODEL;
    this.apiKey = DEFAULT_XAI_API_KEY;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private resolveApiKey(): string {
    const keyToUse = this.apiKey ?? DEFAULT_XAI_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing XAI_API_KEY');
    }
    return keyToUse;
  }

  private buildTools() {
    return buildResponseTavilyTools({
      chatAgentEnabled: this.chatAgentEnabled,
      chatAgentSearchEnabled: this.chatAgentSearchEnabled,
      tavilyConfig: this.tavilyConfig,
    });
  }

  private async runToolCall(call: ResponseFunctionCallItem): Promise<string> {
    return runResponseTavilyToolCall(call, this.tavilyConfig, {
      unsupportedTool: (toolName) =>
        `${t('settings.provider.error.tool.unsupported')}: ${toolName}`,
      missingQuery: t('settings.provider.error.tool.missingQuery'),
    });
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
      this.previousResponseId = undefined;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_XAI_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.previousResponseId = undefined;
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

  override setChatAgentEnabled(enabled: boolean): void {
    super.setChatAgentEnabled(enabled);
    this.previousResponseId = undefined;
  }

  override setChatAgentPrompt(prompt: string): void {
    super.setChatAgentPrompt(prompt);
    this.previousResponseId = undefined;
  }

  override setChatAgentSearchEnabled(enabled: boolean): void {
    super.setChatAgentSearchEnabled(enabled);
    this.previousResponseId = undefined;
  }

  resetChat(): void {
    super.resetChat();
    this.previousResponseId = undefined;
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    await super.startChatWithHistory(messages);
    this.previousResponseId = undefined;
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const apiKey = this.resolveApiKey();
    const userMessage: ChatMessage = {
      id: `${this.id}-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const tools = this.buildTools();
    const emitReasoning = this.reasoningPreference.enabled && shouldEmitReasoning(message);
    const enableReasoningSummary =
      supportsResponseReasoningSummary(
        this.modelName,
        (normalizedModelName) =>
          normalizedModelName.includes('reasoning') ||
          normalizedModelName.startsWith('grok-4') ||
          normalizedModelName.startsWith('grok-3')
      ) && emitReasoning;
    const maxToolRounds = getMaxToolCallRounds();

    let fullResponse = '';
    let conversationResponseId = this.previousResponseId;
    let finalResponseId = this.previousResponseId;
    let requestInput: XAIResponseTurnInput[] | undefined = conversationResponseId
      ? buildXaiContinuationInput(message)
      : buildXaiInitialInputMessages({
          id: this.id,
          modelName: this.modelName,
          chatAgentEnabled: this.chatAgentEnabled,
          chatAgentPrompt: this.chatAgentPrompt,
          messages: nextHistory,
        });

    try {
      for (let round = 0; round <= maxToolRounds; round += 1) {
        let turnResult:
          | {
              kind: 'response';
              id?: string;
              functionCalls: ResponseFunctionCallItem[];
              usage?: ResponseUsagePayload;
            }
          | undefined;

        for await (const chunk of streamXaiResponsesTurn(
          apiKey,
          {
            model: this.modelName,
            input: requestInput,
            previous_response_id: conversationResponseId,
            tools,
            parallel_tool_calls: (requestPolicy?.toolParallelism ?? 1) > 1,
            store: true,
            stream: true,
          },
          signal,
          enableReasoningSummary
        )) {
          if (chunk.kind === 'text') {
            if (!chunk.value.startsWith('<think>')) {
              fullResponse += chunk.value;
            }
            yield chunk.value;
          } else {
            turnResult = chunk;
          }
        }

        if (!turnResult?.functionCalls.length) {
          finalResponseId = turnResult?.id ?? conversationResponseId;
          break;
        }

        if (!turnResult.id) {
          throw new Error('Missing xAI response id for function-call follow-up.');
        }

        if (round >= maxToolRounds) {
          throw new Error(`Exceeded maximum xAI tool call rounds: ${maxToolRounds}`);
        }

        conversationResponseId = turnResult.id;
        requestInput = await Promise.all(
          turnResult.functionCalls.map(async (call) => ({
            type: 'function_call_output' as const,
            call_id: call.call_id,
            output: await this.runToolCall(call),
          }))
        );
      }

      const modelMessage: ChatMessage = {
        id: `${this.id}-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
      this.previousResponseId = finalResponseId;
    } catch (error) {
      console.error('Error in xAI Responses stream:', error);
      throw error;
    }
  }
}

export const createProviderInstance = (): ProviderChat => new XAIProvider();
