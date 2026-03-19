import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { getGeminiCliAuthSession } from '@/infrastructure/auth/geminiCliAuth';
import { getDefaultChatAgentPrompt } from '@/infrastructure/providers/chatAgent';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import { getDefaultTavilyConfig, normalizeTavilyConfig } from '@/infrastructure/providers/tavily';
import type {
  ProviderChat,
  ProviderReasoningPreference,
  ProviderResponseMetadata,
} from '@/infrastructure/providers/types';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import {
  buildGeminiCliTools,
  buildGeminiCliToolResponseParts,
  createGeminiCliChatSession,
  createGeminiModelMessage,
  extractGeminiChunkPayload,
} from '@/infrastructure/providers/geminiCliAuthChat';
import {
  buildGeminiCliRequest,
  transformGeminiCliResponse,
} from '@/infrastructure/providers/geminiCliAuthTransport';

export const GEMINI_CLI_AUTH_PROVIDER_ID: ProviderId = 'gemini-cli-auth';

const { defaultModel: DEFAULT_GEMINI_CLI_AUTH_MODEL } = buildProviderModelConfig(
  PROVIDER_CONFIGS[GEMINI_CLI_AUTH_PROVIDER_ID].modelSpec
);

class GeminiCliAuthProvider implements ProviderChat {
  private readonly id: ProviderId = GEMINI_CLI_AUTH_PROVIDER_ID;
  private modelName: string;
  private client: GoogleGenAI | null = null;
  private tavilyConfig?: TavilyConfig;
  private history: ChatMessage[] = [];
  private pendingResponseMetadata?: ProviderResponseMetadata;
  private chatAgentEnabled = true;
  private chatAgentPrompt = getDefaultChatAgentPrompt(GEMINI_CLI_AUTH_PROVIDER_ID) ?? '';
  private chatAgentSearchEnabled = true;
  private reasoningPreference: ProviderReasoningPreference = { enabled: false };

  constructor() {
    this.modelName = DEFAULT_GEMINI_CLI_AUTH_MODEL;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private async getClient(): Promise<GoogleGenAI> {
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: 'gemini-cli-oauth' });
    }
    return this.client;
  }

  private async installGeminiCliFetch(): Promise<() => void> {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const session = await getGeminiCliAuthSession();
      if (!session?.authenticated || !session.accessToken) {
        throw new Error(t('settings.provider.error.geminiCliAuth.missingLogin'));
      }
      if (!session.projectId) {
        throw new Error(t('settings.provider.error.geminiCliAuth.missingProject'));
      }

      const transformed = buildGeminiCliRequest(
        input,
        init,
        session,
        DEFAULT_GEMINI_CLI_AUTH_MODEL
      );
      const response = await originalFetch(transformed.request, transformed.init);
      return transformGeminiCliResponse(response, transformed.streaming);
    };

    return () => {
      globalThis.fetch = originalFetch;
    };
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
    return undefined;
  }

  setApiKey(): void {}

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
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
    if (signal?.aborted) {
      return;
    }

    const client = await this.getClient();
    this.pendingResponseMetadata = undefined;
    let fullResponse = '';
    let fullReasoning = '';
    const userMessage: ChatMessage = {
      id: `gemini-cli-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };
    const restoreFetch = await this.installGeminiCliFetch();

    try {
      const tools = buildGeminiCliTools(
        this.chatAgentEnabled,
        this.chatAgentSearchEnabled,
        this.tavilyConfig
      );
      const chat = createGeminiCliChatSession({
        client,
        providerId: this.id,
        modelName: this.modelName,
        chatAgentEnabled: this.chatAgentEnabled,
        chatAgentPrompt: this.chatAgentPrompt,
        reasoningPreference: this.reasoningPreference,
        history: this.history,
        tools,
        signal,
      });
      const emitReasoning = this.reasoningPreference.enabled;

      if (!tools) {
        const stream = await chat.sendMessageStream({ message });
        for await (const chunk of stream) {
          if (signal?.aborted) return;
          const payload = extractGeminiChunkPayload(chunk as GenerateContentResponse);
          if (emitReasoning && payload.reasoning) {
            fullReasoning += payload.reasoning;
            yield `<think>${payload.reasoning}</think>`;
          }
          if (payload.content) {
            fullResponse += payload.content;
            yield payload.content;
          }
        }
      } else {
        const response = await chat.sendMessage({ message });
        const functionCalls = response.functionCalls ?? [];

        if (!functionCalls.length) {
          const payload = extractGeminiChunkPayload(response);
          if (emitReasoning && payload.reasoning) {
            fullReasoning += payload.reasoning;
            yield `<think>${payload.reasoning}</think>`;
          }
          if (payload.content) {
            fullResponse = payload.content;
            yield payload.content;
          }
        } else {
          const toolParts = await buildGeminiCliToolResponseParts({
            tavilyConfig: this.tavilyConfig,
            functionCalls,
            requestPolicy,
          });
          const stream = await chat.sendMessageStream({ message: toolParts });
          for await (const chunk of stream) {
            if (signal?.aborted) return;
            const payload = extractGeminiChunkPayload(chunk as GenerateContentResponse);
            if (emitReasoning && payload.reasoning) {
              fullReasoning += payload.reasoning;
              yield `<think>${payload.reasoning}</think>`;
            }
            if (payload.content) {
              fullResponse += payload.content;
              yield payload.content;
            }
          }
        }
      }

      if (fullResponse) {
        this.history = [
          ...this.history,
          userMessage,
          createGeminiModelMessage(fullResponse, fullReasoning),
        ];
      }
    } catch (error) {
      console.error('Error in Gemini CLI OAuth stream:', error);
      throw error;
    } finally {
      restoreFetch();
    }
  }
}

export const createProviderInstance = (): ProviderChat => new GeminiCliAuthProvider();
