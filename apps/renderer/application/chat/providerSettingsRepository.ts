import { ProviderId } from '@/shared/types/chat';
import { getDefaultProviderSettings, ProviderSettings } from '@/infrastructure/providers/defaults';
import { listProviderIds } from '@/infrastructure/providers/registry';
import {
  loadActiveProviderId,
  persistActiveProviderId,
} from '@/infrastructure/persistence/appSettingsStore';
import {
  applyGlobalTavilyConfig,
  loadProviderSettings,
  normalizeProviderSettingsRecord,
  normalizeProviderSettingsUpdate,
  persistProviderSettings,
} from '@/infrastructure/persistence/providerSettingsStore';

export class ProviderSettingsRepository {
  private settings: Record<ProviderId, ProviderSettings>;

  constructor(initialSettings: Record<ProviderId, ProviderSettings> = loadProviderSettings()) {
    this.settings = initialSettings;
  }

  getActiveProviderId(): ProviderId {
    return loadActiveProviderId();
  }

  persistActiveProviderId(providerId: ProviderId): void {
    persistActiveProviderId(providerId);
  }

  getSettings(providerId: ProviderId): ProviderSettings {
    return this.settings[providerId] ?? getDefaultProviderSettings(providerId);
  }

  getAllSettings(): Record<ProviderId, ProviderSettings> {
    const snapshot = {} as Record<ProviderId, ProviderSettings>;
    for (const id of listProviderIds()) {
      snapshot[id] = { ...this.getSettings(id) };
    }
    return snapshot;
  }

  updateSettings(providerId: ProviderId, updates: Partial<ProviderSettings>): ProviderSettings {
    const current = this.getSettings(providerId);
    const next = normalizeProviderSettingsUpdate(providerId, current, updates);
    if (updates.tavily !== undefined) {
      this.settings = applyGlobalTavilyConfig(
        { ...this.settings, [providerId]: next },
        next.tavily
      );
    } else {
      this.settings = { ...this.settings, [providerId]: next };
    }
    persistProviderSettings(this.settings);
    return next;
  }

  replaceAllSettings(
    settings: Record<ProviderId, ProviderSettings>
  ): Record<ProviderId, ProviderSettings> {
    this.settings = normalizeProviderSettingsRecord(settings);
    persistProviderSettings(this.settings);
    return this.getAllSettings();
  }
}
