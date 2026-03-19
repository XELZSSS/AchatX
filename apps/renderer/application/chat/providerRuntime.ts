import { ChatMessage, GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import { ProviderSettings } from '@/infrastructure/providers/defaults';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { ProviderRouter } from '@/infrastructure/providers/router';
import {
  OpenAIRequestMode,
  ProviderReasoningPreference,
  ProviderResponseMetadata,
} from '@/infrastructure/providers/types';
import { ProviderChat } from '@/infrastructure/providers/types';

const areHeadersEqual = (
  a: Array<{ key: string; value: string }> | undefined,
  b: Array<{ key: string; value: string }> | undefined
): boolean => {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((header, index) => {
    const next = right[index];
    return !!next && header.key === next.key && header.value === next.value;
  });
};

const isJsonEqual = <T>(a: T | undefined, b: T | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const isTrimmedStringEqual = (a?: string, b?: string): boolean => (a ?? '').trim() === (b ?? '').trim();

const isReasoningPreferenceEqual = (
  left?: ProviderReasoningPreference,
  right?: ProviderReasoningPreference
): boolean => Boolean(left?.enabled) === Boolean(right?.enabled);

export class ProviderRuntime {
  private readonly router: ProviderRouter;
  private provider: ProviderChat;
  private searchEnabled = true;
  private reasoningPreference: ProviderReasoningPreference = { enabled: false };
  private requestMode: OpenAIRequestMode = 'chat_completions';
  private historySyncGeneration = 0;
  private latestHistorySyncRequest: { provider: ProviderChat; messages: ChatMessage[] } | null =
    null;
  private historyReconcilePromise: Promise<void> | null = null;

  constructor(initialProviderId: ProviderId) {
    this.router = new ProviderRouter(initialProviderId);
    this.provider = this.router.getActiveProvider();
  }

  getProviderId(): ProviderId {
    return this.provider.getId();
  }

  private resetHistorySyncState(): void {
    this.historySyncGeneration += 1;
    this.latestHistorySyncRequest = null;
  }

  private syncProviderValue<T>(
    currentValue: T,
    nextValue: T,
    apply: (value: T) => void,
    isEqual: (left: T, right: T) => boolean = Object.is
  ): void {
    if (isEqual(currentValue, nextValue)) {
      return;
    }

    apply(nextValue);
  }

  setProvider(providerId: ProviderId): void {
    this.resetHistorySyncState();
    this.provider = this.router.setActiveProvider(providerId);
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  getApiKey(): string | undefined {
    return this.provider.getApiKey();
  }

  setSearchEnabled(enabled: boolean): boolean {
    if (this.searchEnabled === enabled) {
      return false;
    }
    this.searchEnabled = enabled;
    return true;
  }

  setReasoningEnabled(enabled: boolean): boolean {
    if (this.reasoningPreference.enabled === enabled) {
      return false;
    }

    this.reasoningPreference = { enabled };
    this.provider.setReasoningPreference?.(this.reasoningPreference);
    return true;
  }

  applyProviderSettings(providerId: ProviderId, settings: ProviderSettings): void {
    if (this.provider.getId() !== providerId) {
      this.resetHistorySyncState();
      this.provider = this.router.setActiveProvider(providerId);
    }

    this.requestMode = settings?.requestMode ?? this.requestMode;

    this.syncProviderValue(this.provider.getApiKey(), settings?.apiKey, (nextApiKey) => {
      this.provider.setApiKey(nextApiKey);
    });

    this.syncProviderValue(this.provider.getModelName(), settings?.modelName ?? '', (nextModel) => {
      this.provider.setModelName(nextModel);
    });

    if (this.provider.setBaseUrl) {
      this.syncProviderValue(this.provider.getBaseUrl?.(), settings?.baseUrl, (nextBaseUrl) =>
        this.provider.setBaseUrl?.(nextBaseUrl)
      );
    }

    if (this.provider.setCustomHeaders) {
      this.syncProviderValue(
        this.provider.getCustomHeaders?.() ?? [],
        settings?.customHeaders ?? [],
        (nextHeaders) => this.provider.setCustomHeaders?.(nextHeaders),
        areHeadersEqual
      );
    }

    if (this.provider.setTavilyConfig) {
      this.syncProviderValue(
        this.provider.getTavilyConfig?.(),
        this.searchEnabled ? settings?.tavily : undefined,
        (nextTavily) => this.provider.setTavilyConfig?.(nextTavily),
        isJsonEqual<TavilyConfig>
      );
    }

    if (this.provider.setReasoningPreference) {
      this.syncProviderValue(
        this.provider.getReasoningPreference?.() ?? { enabled: false },
        this.reasoningPreference,
        (nextPreference) => this.provider.setReasoningPreference?.(nextPreference),
        isReasoningPreferenceEqual
      );
    }

    if (this.provider.setRequestMode) {
      this.syncProviderValue(
        this.provider.getRequestMode?.(),
        settings?.requestMode ?? this.requestMode,
        (nextMode) => this.provider.setRequestMode?.(nextMode),
        Object.is
      );
    }

    if (this.provider.setEmbeddingConfig) {
      this.syncProviderValue(
        this.provider.getEmbeddingConfig?.(),
        settings?.embedding,
        (nextEmbedding) => this.provider.setEmbeddingConfig?.(nextEmbedding),
        isJsonEqual<GeminiEmbeddingConfig>
      );
    }

    if (this.provider.setChatAgentEnabled) {
      this.syncProviderValue(
        this.provider.getChatAgentEnabled?.(),
        settings?.chatAgentEnabled,
        (nextEnabled) => this.provider.setChatAgentEnabled?.(Boolean(nextEnabled)),
        Object.is
      );
    }

    if (this.provider.setChatAgentPrompt) {
      this.syncProviderValue(
        this.provider.getChatAgentPrompt?.(),
        settings?.chatAgentPrompt,
        (nextPrompt) =>
          this.provider.setChatAgentPrompt?.(typeof nextPrompt === 'string' ? nextPrompt : ''),
        isTrimmedStringEqual
      );
    }

    if (this.provider.setChatAgentSearchEnabled && settings?.chatAgentSearchEnabled !== undefined) {
      this.syncProviderValue(
        this.provider.getChatAgentSearchEnabled?.(),
        settings?.chatAgentSearchEnabled,
        (nextEnabled) => this.provider.setChatAgentSearchEnabled?.(Boolean(nextEnabled)),
        Object.is
      );
    }
  }

  resetChat(): void {
    this.resetHistorySyncState();
    this.provider.resetChat();
  }

  private async reconcileLatestHistorySync(): Promise<void> {
    if (this.historyReconcilePromise) {
      await this.historyReconcilePromise;
      return;
    }

    const latestRequest = this.latestHistorySyncRequest;
    if (!latestRequest) {
      return;
    }

    this.historyReconcilePromise = (async () => {
      const snapshot = this.latestHistorySyncRequest;
      if (!snapshot) {
        return;
      }

      await snapshot.provider.startChatWithHistory(snapshot.messages);
    })().finally(() => {
      this.historyReconcilePromise = null;
    });

    await this.historyReconcilePromise;
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    const provider = this.provider;
    this.latestHistorySyncRequest = { provider, messages };
    const generation = ++this.historySyncGeneration;

    await provider.startChatWithHistory(messages);

    if (
      generation !== this.historySyncGeneration ||
      this.latestHistorySyncRequest?.provider !== provider ||
      this.latestHistorySyncRequest?.messages !== messages
    ) {
      await this.reconcileLatestHistorySync();
    }
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    yield* this.provider.sendMessageStream(message, signal, requestPolicy);
  }

  consumePendingResponseMetadata(): ProviderResponseMetadata | undefined {
    return this.provider.consumePendingResponseMetadata?.();
  }
}
