import {
  GoogleGenAI,
  type GenerateContentResponse,
  type ToolListUnion,
} from '@google/genai';
import {
  ChatMessage,
  GeminiEmbeddingConfig,
  ProviderId,
  Role,
  TavilyConfig,
} from '@/shared/types/chat';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { ProviderChat, ProviderResponseMetadata } from '@/infrastructure/providers/types';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';
import { normalizeGeminiEmbeddingConfig } from '@/infrastructure/providers/geminiEmbeddings';
import { retrieveGeminiSemanticContext } from '@/infrastructure/providers/geminiSemanticSearch';
import {
  getDefaultTavilyConfig,
  normalizeTavilyConfig,
} from '@/infrastructure/providers/tavily';
import { getDefaultChatAgentPrompt } from '@/infrastructure/providers/chatAgent';
import type { ProviderReasoningPreference } from '@/infrastructure/providers/types';
import {
  buildGeminiToolResponseParts,
  buildGeminiTools,
  createGeminiChatSession,
  createGeminiModelMessage,
  extractGeminiChunkPayload,
} from '@/infrastructure/providers/geminiProviderHelpers';

export const GEMINI_PROVIDER_ID: ProviderId = 'gemini';

const { defaultModel: DEFAULT_GEMINI_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[GEMINI_PROVIDER_ID].modelSpec
);
const DEFAULT_GEMINI_API_KEY = PROVIDER_CONFIGS[GEMINI_PROVIDER_ID].envApiKeyResolver();

class GeminiProvider implements ProviderChat {
  private readonly id: ProviderId = GEMINI_PROVIDER_ID;
  private modelName: string;
  private apiKey?: string;
  private client: GoogleGenAI | null = null;
  private tavilyConfig?: TavilyConfig;
  private embeddingConfig?: GeminiEmbeddingConfig;
  private history: ChatMessage[] = [];
  private pendingResponseMetadata?: ProviderResponseMetadata;
  private chatAgentEnabled = true;
  private chatAgentPrompt = getDefaultChatAgentPrompt(GEMINI_PROVIDER_ID) ?? '';
  private chatAgentSearchEnabled = true;
  private reasoningPreference: ProviderReasoningPreference = { enabled: false };

  constructor() {
    this.modelName = DEFAULT_GEMINI_MODEL;
    this.apiKey = DEFAULT_GEMINI_API_KEY;
    this.tavilyConfig = getDefaultTavilyConfig();
    this.embeddingConfig = undefined;
  }

  private async getClient(): Promise<GoogleGenAI> {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  private buildTools(): ToolListUnion | undefined {
    return buildGeminiTools({
      chatAgentEnabled: this.chatAgentEnabled,
      chatAgentSearchEnabled: this.chatAgentSearchEnabled,
      tavilyConfig: this.tavilyConfig,
    });
  }

  private createChatSession(client: GoogleGenAI, tools?: ToolListUnion, signal?: AbortSignal) {
    return createGeminiChatSession({
      client,
      id: this.id,
      modelName: this.modelName,
      history: this.history,
      chatAgentEnabled: this.chatAgentEnabled,
      chatAgentPrompt: this.chatAgentPrompt,
      reasoningEnabled: this.reasoningPreference.enabled,
      tools,
      signal,
    });
  }

  private async buildToolResponseParts(
    functionCalls: import('@google/genai').FunctionCall[],
    requestPolicy?: RequestPolicy
  ) {
    return buildGeminiToolResponseParts({
      functionCalls,
      tavilyConfig: this.tavilyConfig,
      requestPolicy,
    });
  }

  getChatAgentEnabled(): boolean {
    return this.chatAgentEnabled;
  }

  setChatAgentEnabled(enabled: boolean): void {
    this.chatAgentEnabled = enabled;
  }

  getChatAgentPrompt(): string {
    return this.chatAgentPrompt;
  }

  setChatAgentPrompt(prompt: string): void {
    this.chatAgentPrompt = prompt;
  }

  getChatAgentSearchEnabled(): boolean {
    return this.chatAgentSearchEnabled;
  }

  setChatAgentSearchEnabled(enabled: boolean): void {
    this.chatAgentSearchEnabled = enabled;
  }

  getReasoningPreference(): ProviderReasoningPreference {
    return this.reasoningPreference;
  }

  setReasoningPreference(preference: ProviderReasoningPreference): void {
    this.reasoningPreference = preference;
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
      this.resetChat();
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_GEMINI_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
      this.resetChat();
    }
  }

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  getEmbeddingConfig(): GeminiEmbeddingConfig | undefined {
    return this.embeddingConfig;
  }

  setEmbeddingConfig(config?: GeminiEmbeddingConfig): void {
    this.embeddingConfig = normalizeGeminiEmbeddingConfig(config);
  }

  consumePendingResponseMetadata(): ProviderResponseMetadata | undefined {
    const metadata = this.pendingResponseMetadata;
    this.pendingResponseMetadata = undefined;
    return metadata;
  }

  resetChat(): void {
    this.history = [];
    this.pendingResponseMetadata = undefined;
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    this.history = messages.filter((msg) => !msg.isError);
    this.pendingResponseMetadata = undefined;
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    try {
      if (signal?.aborted) return;

      const client = await this.getClient();
      this.pendingResponseMetadata = undefined;
      let fullResponse = '';
      let fullReasoning = '';
      const userMessage: ChatMessage = {
        id: `gemini-user-${Date.now()}`,
        role: Role.User,
        text: message,
        timestamp: Date.now(),
      };
      const semanticContext = await retrieveGeminiSemanticContext({
        apiKey: this.apiKey ?? '',
        query: message,
        embeddingConfig: this.embeddingConfig,
        signal,
      }).catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        console.warn('Gemini semantic retrieval skipped:', error);
        return undefined;
      });
      const outboundMessage = semanticContext?.prompt ?? message;

      const tools = this.buildTools();
      const chat = this.createChatSession(client, tools, signal);
      const emitReasoning = this.reasoningPreference.enabled;

      if (!tools) {
        const stream = await chat.sendMessageStream({ message: outboundMessage });

        for await (const chunk of stream) {
          if (signal?.aborted) return;
          const responseChunk = chunk as GenerateContentResponse;
          const payload = extractGeminiChunkPayload(responseChunk);
          if (emitReasoning && payload.reasoning) {
            fullReasoning += payload.reasoning;
            yield `<think>${payload.reasoning}</think>`;
          }
          if (payload.content) {
            fullResponse += payload.content;
            yield payload.content;
          }
        }

        if (fullResponse) {
          const modelMessage = createGeminiModelMessage(fullResponse, fullReasoning);
          this.pendingResponseMetadata = semanticContext
            ? { citations: semanticContext.citations }
            : undefined;
          this.history = [...this.history, userMessage, modelMessage];
        }
        return;
      }

      const response = await chat.sendMessage({ message: outboundMessage });

      const functionCalls = response.functionCalls ?? [];
      if (!functionCalls.length) {
        if (signal?.aborted) return;
        const payload = extractGeminiChunkPayload(response);
        if (emitReasoning && payload.reasoning) {
          fullReasoning += payload.reasoning;
          yield `<think>${payload.reasoning}</think>`;
        }
        if (payload.content) {
          fullResponse = payload.content;
          yield payload.content;
          const modelMessage = createGeminiModelMessage(payload.content, fullReasoning);
          this.pendingResponseMetadata = semanticContext
            ? { citations: semanticContext.citations }
            : undefined;
          this.history = [...this.history, userMessage, modelMessage];
        }
        return;
      }

      const toolParts = await this.buildToolResponseParts(functionCalls, requestPolicy);
      const stream = await chat.sendMessageStream({ message: toolParts });

      for await (const chunk of stream) {
        if (signal?.aborted) return;
        const responseChunk = chunk as GenerateContentResponse;
        const payload = extractGeminiChunkPayload(responseChunk);
        if (emitReasoning && payload.reasoning) {
          fullReasoning += payload.reasoning;
          yield `<think>${payload.reasoning}</think>`;
        }
        if (payload.content) {
          fullResponse += payload.content;
          yield payload.content;
        }
      }

      if (fullResponse) {
        const modelMessage = createGeminiModelMessage(fullResponse, fullReasoning);
        this.pendingResponseMetadata = semanticContext
          ? { citations: semanticContext.citations }
          : undefined;
        this.history = [...this.history, userMessage, modelMessage];
      }
    } catch (error) {
      console.error('Error in Gemini stream:', error);
      throw error;
    }
  }
}

export const createProviderInstance = (): ProviderChat => new GeminiProvider();
