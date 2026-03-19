import { ChatMessage, ProviderId } from '@/shared/types/chat';
import { listProviderIds } from '@/infrastructure/providers/registry';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { ProviderResponseMetadata } from '@/infrastructure/providers/types';
import { ProviderSettings } from '@/infrastructure/providers/defaults';
import { ProviderSettingsRepository } from '@/application/chat/providerSettingsRepository';
import { ProviderRuntime } from '@/application/chat/providerRuntime';

type ProviderSyncOptions = {
  persistActiveProviderId?: boolean;
  providerSettings?: ProviderSettings;
};

export class ChatOrchestrator {
  private readonly settingsRepository: ProviderSettingsRepository;
  private readonly runtime: ProviderRuntime;

  constructor(
    settingsRepository: ProviderSettingsRepository = new ProviderSettingsRepository(),
    runtime?: ProviderRuntime
  ) {
    this.settingsRepository = settingsRepository;
    const initialProviderId = this.settingsRepository.getActiveProviderId();
    this.runtime = runtime ?? new ProviderRuntime(initialProviderId);
    this.syncProviderContext(initialProviderId);
  }

  private syncProviderContext(providerId: ProviderId, options: ProviderSyncOptions = {}): void {
    const { persistActiveProviderId = false, providerSettings } = options;
    const resolvedSettings = providerSettings ?? this.settingsRepository.getSettings(providerId);

    if (this.runtime.getProviderId() !== providerId) {
      this.runtime.setProvider(providerId);
    }

    this.runtime.applyProviderSettings(providerId, resolvedSettings);

    if (persistActiveProviderId) {
      this.settingsRepository.persistActiveProviderId(providerId);
    }
  }

  private updateAndSyncProviderSettings(
    providerId: ProviderId,
    updates: Partial<ProviderSettings>
  ): ProviderSettings {
    const next = this.settingsRepository.updateSettings(providerId, updates);

    if (providerId === this.getProviderId()) {
      this.syncProviderContext(providerId, { providerSettings: next });
    }

    return next;
  }

  getProviderId(): ProviderId {
    return this.runtime.getProviderId();
  }

  setProvider(id: ProviderId): void {
    this.syncProviderContext(id, { persistActiveProviderId: true });
  }

  getModelName(): string {
    return this.runtime.getModelName();
  }

  setSearchEnabled(enabled: boolean): void {
    const changed = this.runtime.setSearchEnabled(enabled);
    if (!changed) {
      return;
    }

    this.syncProviderContext(this.getProviderId());
  }

  setReasoningEnabled(enabled: boolean): void {
    this.runtime.setReasoningEnabled(enabled);
  }

  setModelName(model: string): void {
    this.updateAndSyncProviderSettings(this.getProviderId(), { modelName: model });
  }

  getApiKey(): string | undefined {
    return this.runtime.getApiKey();
  }

  setApiKey(apiKey?: string): void {
    this.updateAndSyncProviderSettings(this.getProviderId(), { apiKey });
  }

  getProviderSettings(providerId: ProviderId = this.getProviderId()): ProviderSettings {
    return { ...this.settingsRepository.getSettings(providerId) };
  }

  getAllProviderSettings(): Record<ProviderId, ProviderSettings> {
    return this.settingsRepository.getAllSettings();
  }

  updateProviderSettings(
    providerId: ProviderId,
    updates: Partial<ProviderSettings>
  ): ProviderSettings {
    return this.updateAndSyncProviderSettings(providerId, updates);
  }

  replaceAllProviderSettings(
    settings: Record<ProviderId, ProviderSettings>,
    activeProviderId: ProviderId = this.getProviderId()
  ): Record<ProviderId, ProviderSettings> {
    const nextSettings = this.settingsRepository.replaceAllSettings(settings);
    this.syncProviderContext(activeProviderId, {
      persistActiveProviderId: true,
      providerSettings: nextSettings[activeProviderId],
    });
    return nextSettings;
  }

  getAvailableProviders(): ProviderId[] {
    return listProviderIds();
  }

  resetChat(): void {
    this.runtime.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    await this.runtime.startChatWithHistory(messages);
  }

  async restoreChatWithHistory(messages: ChatMessage[]): Promise<void> {
    await this.runtime.startChatWithHistory(messages);
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    yield* this.runtime.sendMessageStream(message, signal, requestPolicy);
  }

  consumePendingResponseMetadata(): ProviderResponseMetadata | undefined {
    return this.runtime.consumePendingResponseMetadata();
  }
}
