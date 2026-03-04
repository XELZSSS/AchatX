import { ChatMessage, ProviderId, TavilyConfig } from '../../types';
import { ProviderSettings } from '../providers/defaults';
import { getProviderDefaultModel } from '../providers/registry';
import { ProviderRouter } from '../providers/router';
import { ProviderChat } from '../providers/types';

export class ProviderRuntime {
  private readonly router: ProviderRouter;
  private provider: ProviderChat;
  private searchEnabled = true;

  constructor(initialProviderId: ProviderId) {
    this.router = new ProviderRouter(initialProviderId);
    this.provider = this.router.getActiveProvider();
  }

  getProviderId(): ProviderId {
    return this.provider.getId();
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  getApiKey(): string | undefined {
    return this.provider.getApiKey();
  }

  setProvider(providerId: ProviderId): void {
    this.provider = this.router.setActiveProvider(providerId);
  }

  setSearchEnabled(enabled: boolean): boolean {
    if (this.searchEnabled === enabled) {
      return false;
    }
    this.searchEnabled = enabled;
    return true;
  }

  private areHeadersEqual(
    a: Array<{ key: string; value: string }> | undefined,
    b: Array<{ key: string; value: string }> | undefined
  ): boolean {
    const left = a ?? [];
    const right = b ?? [];
    if (left.length !== right.length) return false;
    return left.every((header, index) => {
      const next = right[index];
      return !!next && header.key === next.key && header.value === next.value;
    });
  }

  private isTavilyEqual(a: TavilyConfig | undefined, b: TavilyConfig | undefined): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }

  applyProviderSettings(providerId: ProviderId, settings: ProviderSettings): void {
    const nextApiKey = settings?.apiKey;
    if (this.provider.getApiKey() !== nextApiKey) {
      this.provider.setApiKey(nextApiKey);
    }

    const nextModel = settings?.modelName ?? getProviderDefaultModel(providerId);
    if (this.provider.getModelName() !== nextModel) {
      this.provider.setModelName(nextModel);
    }

    if (this.provider.setBaseUrl) {
      const currentBaseUrl = this.provider.getBaseUrl?.();
      const nextBaseUrl = settings?.baseUrl;
      if (currentBaseUrl !== nextBaseUrl) {
        this.provider.setBaseUrl(nextBaseUrl);
      }
    }

    if (this.provider.setCustomHeaders) {
      const currentHeaders = this.provider.getCustomHeaders?.();
      const nextHeaders = settings?.customHeaders ?? [];
      if (!this.areHeadersEqual(currentHeaders, nextHeaders)) {
        this.provider.setCustomHeaders(nextHeaders);
      }
    }

    if (this.provider.setTavilyConfig) {
      const currentTavily = this.provider.getTavilyConfig?.();
      const nextTavily = this.searchEnabled ? settings?.tavily : undefined;
      if (!this.isTavilyEqual(currentTavily, nextTavily)) {
        this.provider.setTavilyConfig(nextTavily);
      }
    }
  }

  resetChat(): void {
    this.provider.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    await this.provider.startChatWithHistory(messages);
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    yield* this.provider.sendMessageStream(message, signal);
  }
}
