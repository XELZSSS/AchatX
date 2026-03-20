import { ChatMessage, ProviderId } from '@/shared/types/chat';
import { listProviderIds } from '@/infrastructure/providers/registry';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { ProviderResponseMetadata } from '@/infrastructure/providers/types';
import { ProviderSettings } from '@/infrastructure/providers/defaults';
import { ProviderSettingsRepository } from '@/application/chat/providerSettingsRepository';
import { ConversationContext, ProviderRuntime } from '@/application/chat/providerRuntime';

export class ChatOrchestrator {
  private readonly settingsRepository: ProviderSettingsRepository;
  private readonly runtime: ProviderRuntime;

  constructor(
    settingsRepository: ProviderSettingsRepository = new ProviderSettingsRepository(),
    runtime?: ProviderRuntime
  ) {
    this.settingsRepository = settingsRepository;
    const initialProviderId = this.settingsRepository.getDefaultProviderId();
    const initialProviderSettings = this.settingsRepository.getSettings(initialProviderId);
    this.runtime = runtime ?? new ProviderRuntime(initialProviderId);
    this.runtime.applyConversationContext(
      initialProviderId,
      initialProviderSettings.modelName,
      initialProviderSettings
    );
  }

  private syncRuntimeProviderSettings(
    providerId: ProviderId,
    providerSettings?: ProviderSettings
  ): void {
    const resolvedSettings = providerSettings ?? this.settingsRepository.getSettings(providerId);
    this.runtime.applyProviderSettings(providerId, resolvedSettings);
  }

  private updateAndSyncProviderSettings(
    providerId: ProviderId,
    updates: Partial<ProviderSettings>
  ): ProviderSettings {
    const next = this.settingsRepository.updateSettings(providerId, updates);

    if (providerId === this.getProviderId()) {
      this.syncRuntimeProviderSettings(providerId, next);
    }

    return next;
  }

  getProviderId(): ProviderId {
    return this.runtime.getProviderId();
  }

  getDefaultProviderId(): ProviderId {
    return this.settingsRepository.getDefaultProviderId();
  }

  getConversationContext(): ConversationContext {
    return this.runtime.getConversationContext();
  }

  setDefaultProvider(id: ProviderId): void {
    this.settingsRepository.persistDefaultProviderId(id);
  }

  activateConversationContext(context: ConversationContext): void {
    this.runtime.applyConversationContext(
      context.providerId,
      context.modelName,
      this.settingsRepository.getSettings(context.providerId)
    );
  }

  activateDefaultConversationContext(): void {
    const providerId = this.getDefaultProviderId();
    const settings = this.settingsRepository.getSettings(providerId);
    this.runtime.applyConversationContext(providerId, settings.modelName, settings);
  }

  getModelName(): string {
    return this.runtime.getModelName();
  }

  setSearchEnabled(enabled: boolean): void {
    const changed = this.runtime.setSearchEnabled(enabled);
    if (!changed) {
      return;
    }

    this.syncRuntimeProviderSettings(this.getProviderId());
  }

  setReasoningEnabled(enabled: boolean): void {
    this.runtime.setReasoningEnabled(enabled);
  }

  setDefaultModelName(providerId: ProviderId, model: string): void {
    this.updateAndSyncProviderSettings(providerId, { modelName: model });
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
    settings: Record<ProviderId, ProviderSettings>
  ): Record<ProviderId, ProviderSettings> {
    const nextSettings = this.settingsRepository.replaceAllSettings(settings);
    this.syncRuntimeProviderSettings(this.getProviderId(), nextSettings[this.getProviderId()]);
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
