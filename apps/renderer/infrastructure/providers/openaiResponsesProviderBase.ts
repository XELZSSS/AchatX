import OpenAI from 'openai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '@/shared/types/chat';
import { OpenAIStyleProviderBase } from '@/infrastructure/providers/openaiBase';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import {
  buildResponseTavilyTools,
  ResponseFunctionCallItem,
  ResponseInputMessage,
  ResponseToolDefinition,
  runResponseTavilyToolCall,
  toResponseInputMessages,
} from '@/infrastructure/providers/responsesShared';
import { getDefaultTavilyConfig, normalizeTavilyConfig } from '@/infrastructure/providers/tavily';
import type { ProviderChat, ProviderReasoningPreference } from '@/infrastructure/providers/types';
import { getMaxToolCallRounds } from '@/infrastructure/providers/utils';
import {
  buildResponseReasoningConfig,
  createResponsesTurnRequest,
  streamResponsesTurn,
  type ResponseReasoningConfig,
  type ResponseStreamChunk,
  type ResponseTurnInput,
} from '@/infrastructure/providers/openaiResponsesProviderHelpers';
import type { ResponseUsagePayload } from '@/infrastructure/providers/responsesShared';

const isAssistantRole = (role: Role): role is Role.Model => role !== Role.User;

export abstract class OpenAIResponsesProviderBase
  extends OpenAIStyleProviderBase
  implements ProviderChat
{
  protected modelName: string;
  protected tavilyConfig?: TavilyConfig;
  protected reasoningPreference: ProviderReasoningPreference = { enabled: false };

  constructor(defaultModel: string) {
    super();
    this.modelName = defaultModel;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  protected toInputMessages(messages: ChatMessage[]): ResponseInputMessage[] {
    return toResponseInputMessages(
      messages.map((msg) => ({
        role: msg.role === Role.User ? 'user' : 'model',
        text: msg.text,
        isError: msg.isError,
      }))
    );
  }

  protected buildResponseTools({
    useHostedToolSearch = false,
  }: {
    useHostedToolSearch?: boolean;
  } = {}): ResponseToolDefinition[] | undefined {
    return buildResponseTavilyTools({
      chatAgentEnabled: this.chatAgentEnabled,
      chatAgentSearchEnabled: this.chatAgentSearchEnabled,
      tavilyConfig: this.tavilyConfig,
      useHostedToolSearch,
    });
  }

  protected async runDefaultToolCall(
    call: ResponseFunctionCallItem,
    messages: {
      unsupportedTool: (toolName: string) => string;
      missingQuery: string;
      requestFailed?: string;
    }
  ): Promise<string> {
    return runResponseTavilyToolCall(call, this.tavilyConfig, messages);
  }

  protected async *streamResponsesTurn(
    client: OpenAI,
    request: {
      model: string;
      instructions: string;
      input?: ResponseTurnInput;
      previous_response_id?: string;
      tools?: ResponseToolDefinition[];
      parallel_tool_calls?: boolean;
      reasoning?: ResponseReasoningConfig;
      stream: true;
    },
    options: {
      signal?: AbortSignal;
      emitReasoning?: boolean;
      failureMessage: string;
    }
  ): AsyncGenerator<ResponseStreamChunk, void, unknown> {
    yield* streamResponsesTurn(client, request, options);
  }

  protected buildResponseReasoningConfig(message: string, effort?: string) {
    return buildResponseReasoningConfig({
      modelName: this.modelName,
      message,
      reasoningEnabled: this.reasoningPreference.enabled,
      effort,
    });
  }

  protected async *sendResponsesMessageStream({
    client,
    message,
    signal,
    requestPolicy,
    tools,
    runToolCall,
    userMessageIdPrefix,
    modelMessageIdPrefix,
    failureMessage,
    missingFollowUpResponseIdMessage,
    buildMaxRoundsError,
    emitReasoning,
    reasoning,
    usePreviousResponseIdForFollowUps = true,
    requireResponseIdForFollowUps = usePreviousResponseIdForFollowUps,
  }: {
    client: OpenAI;
    message: string;
    signal?: AbortSignal;
    requestPolicy?: RequestPolicy;
    tools?: ResponseToolDefinition[];
    runToolCall: (call: ResponseFunctionCallItem) => Promise<string>;
    userMessageIdPrefix: string;
    modelMessageIdPrefix: string;
    failureMessage: string;
    missingFollowUpResponseIdMessage: string;
    buildMaxRoundsError: (maxRounds: number) => string;
    emitReasoning: boolean;
    reasoning?: ResponseReasoningConfig;
    usePreviousResponseIdForFollowUps?: boolean;
    requireResponseIdForFollowUps?: boolean;
  }): AsyncGenerator<string, void, unknown> {
    const userMessage: ChatMessage = {
      id: `${userMessageIdPrefix}-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const maxToolRounds = getMaxToolCallRounds();

    let fullResponse = '';
    let previousResponseId: string | undefined;
    let requestInput: ResponseTurnInput = this.toInputMessages(nextHistory);

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

        const request = createResponsesTurnRequest({
          providerId: this.getId(),
          modelName: this.modelName,
          chatAgentEnabled: this.chatAgentEnabled,
          chatAgentPrompt: this.chatAgentPrompt,
          input: requestInput,
          previousResponseId,
          tools,
          requestPolicy,
          reasoning,
          usePreviousResponseIdForFollowUps,
        });

        for await (const chunk of this.streamResponsesTurn(client, request, {
          signal,
          emitReasoning,
          failureMessage,
        })) {
          if (chunk.kind === 'text') {
            fullResponse += chunk.value.startsWith('<think>') ? '' : chunk.value;
            yield chunk.value;
          } else {
            turnResult = chunk;
          }
        }

        if (!turnResult?.functionCalls.length) {
          break;
        }

        if (requireResponseIdForFollowUps && !turnResult.id) {
          throw new Error(missingFollowUpResponseIdMessage);
        }

        if (round >= maxToolRounds) {
          throw new Error(buildMaxRoundsError(maxToolRounds));
        }

        if (usePreviousResponseIdForFollowUps) {
          previousResponseId = turnResult.id;
        }

        requestInput = await Promise.all(
          turnResult.functionCalls.map(async (call) => ({
            type: 'function_call_output' as const,
            call_id: call.call_id,
            output: await runToolCall(call),
          }))
        );
      }

      const modelMessage: ChatMessage = {
        id: `${modelMessageIdPrefix}-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage].filter((item) =>
        item.role === Role.User ? true : isAssistantRole(item.role)
      );
    } catch (error) {
      console.error(`Error in ${this.getResponsesLogLabel()} stream:`, error);
      throw error;
    }
  }

  abstract getId(): ProviderId;
  abstract getApiKey(): string | undefined;
  abstract setApiKey(apiKey?: string): void;
  abstract sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown>;

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim();
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
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

  protected abstract getResponsesLogLabel(): string;
}
