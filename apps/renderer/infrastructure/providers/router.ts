import { ProviderId } from '@/shared/types/chat';
import { PROVIDER_IDS as RAW_PROVIDER_IDS } from '../../../shared/provider-ids';
import { createProvider } from '@/infrastructure/providers/registry';
import { ProviderChat } from '@/infrastructure/providers/types';

export class ProviderRouter {
  private activeProviderId: ProviderId;
  private activeProvider: ProviderChat;
  private readonly providers = new Map<ProviderId, ProviderChat>();

  private getOrCreateProvider(id: ProviderId): ProviderChat {
    const cached = this.providers.get(id);
    if (cached) {
      return cached;
    }

    const provider = createProvider(id);
    this.providers.set(id, provider);
    return provider;
  }

  constructor(
    initialProvider: ProviderId = (RAW_PROVIDER_IDS[0] ??
      'gemini') as (typeof RAW_PROVIDER_IDS)[number]
  ) {
    this.activeProviderId = initialProvider;
    this.activeProvider = this.getOrCreateProvider(initialProvider);
  }

  getActiveProviderId(): ProviderId {
    return this.activeProviderId;
  }

  getActiveProvider(): ProviderChat {
    return this.activeProvider;
  }

  setActiveProvider(id: ProviderId): ProviderChat {
    if (id === this.activeProviderId) {
      return this.activeProvider;
    }

    this.activeProviderId = id;
    this.activeProvider = this.getOrCreateProvider(id);
    return this.activeProvider;
  }
}
