import { ChatMessage, ProviderId } from '../../types';
import { getProviderDefaultModel, getProviderModels, listProviderIds } from '../providers/registry';
import { ProviderSettings } from '../providers/defaults';
import { ProviderSettingsRepository } from './providerSettingsRepository';
import { ProviderRuntime } from './providerRuntime';

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
    this.applyCurrentProviderSettings();
  }

  private applyProviderSettings(providerId: ProviderId): void {
    const settings = this.settingsRepository.getSettings(providerId);
    this.runtime.applyProviderSettings(providerId, settings);
  }

  private applyCurrentProviderSettings(): void {
    this.applyProviderSettings(this.getProviderId());
  }

  getProviderId(): ProviderId {
    return this.runtime.getProviderId();
  }

  getModelName(): string {
    return this.runtime.getModelName();
  }

  setProvider(id: ProviderId): void {
    this.runtime.setProvider(id);
    this.applyCurrentProviderSettings();
    this.settingsRepository.persistActiveProviderId(id);
  }

  setSearchEnabled(enabled: boolean): void {
    const changed = this.runtime.setSearchEnabled(enabled);
    if (!changed) {
      return;
    }
    this.applyCurrentProviderSettings();
  }

  setModelName(model: string): void {
    this.updateProviderSettings(this.getProviderId(), { modelName: model });
  }

  getApiKey(): string | undefined {
    return this.runtime.getApiKey();
  }

  setApiKey(apiKey?: string): void {
    this.updateProviderSettings(this.getProviderId(), { apiKey });
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
    const next = this.settingsRepository.updateSettings(providerId, updates);
    if (providerId === this.getProviderId()) {
      this.runtime.applyProviderSettings(providerId, next);
    }
    return next;
  }

  getAvailableProviders(): ProviderId[] {
    return listProviderIds();
  }

  getAvailableModels(id: ProviderId = this.getProviderId()): string[] {
    return getProviderModels(id);
  }

  resetChat(): void {
    this.runtime.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    await this.runtime.startChatWithHistory(messages);
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    yield* this.runtime.sendMessageStream(message, signal);
  }

  getProviderDefaultModel(providerId: ProviderId): string {
    return getProviderDefaultModel(providerId);
  }
}
