import { ChatMessage, Citation, GeminiEmbeddingConfig, ProviderId } from '@/shared/types/chat';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';

export type ProviderResponseMetadata = {
  citations?: Citation[];
};

export type ProviderReasoningPreference = {
  enabled: boolean;
};

export type OpenAIRequestMode = 'chat_completions' | 'responses';

export interface ProviderChat {
  getId(): ProviderId;
  getModelName(): string;
  setModelName(model: string): void;
  getApiKey(): string | undefined;
  setApiKey(apiKey?: string): void;
  getChatAgentEnabled?(): boolean | undefined;
  setChatAgentEnabled?(enabled: boolean): void;
  getChatAgentPrompt?(): string | undefined;
  setChatAgentPrompt?(prompt: string): void;
  getChatAgentSearchEnabled?(): boolean | undefined;
  setChatAgentSearchEnabled?(enabled: boolean): void;
  getReasoningPreference?(): ProviderReasoningPreference | undefined;
  setReasoningPreference?(preference: ProviderReasoningPreference): void;
  getRequestMode?(): OpenAIRequestMode | undefined;
  setRequestMode?(mode: OpenAIRequestMode): void;
  getBaseUrl?(): string | undefined;
  setBaseUrl?(baseUrl?: string): void;
  getCustomHeaders?(): Array<{ key: string; value: string }> | undefined;
  setCustomHeaders?(headers: Array<{ key: string; value: string }>): void;
  getTavilyConfig?(): import('@/shared/types/chat').TavilyConfig | undefined;
  setTavilyConfig?(config: import('@/shared/types/chat').TavilyConfig | undefined): void;
  getEmbeddingConfig?(): GeminiEmbeddingConfig | undefined;
  setEmbeddingConfig?(config: GeminiEmbeddingConfig | undefined): void;
  consumePendingResponseMetadata?(): ProviderResponseMetadata | undefined;
  resetChat(): void;
  startChatWithHistory(messages: ChatMessage[]): Promise<void>;
  sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown>;
}

export interface ProviderDefinition {
  id: ProviderId;
  models: string[];
  defaultModel: string;
  create(): ProviderChat;
}

export interface ProviderModule {
  createProviderInstance(): ProviderChat;
}
