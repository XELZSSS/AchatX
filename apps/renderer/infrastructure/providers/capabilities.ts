import { ProviderId } from '@/shared/types/chat';
import { PROVIDER_IDS } from '../../../shared/provider-ids';
import {
  PROVIDER_CONFIGS,
  type ProviderCapabilities,
} from '@/infrastructure/providers/providerConfig';

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsTavily: false,
  supportsBaseUrl: false,
  supportsCustomHeaders: false,
  supportsRegion: false,
  supportsChatAgent: false,
  supportsRequestMode: false,
  supportsEmbedding: false,
};

export const PROVIDER_CAPABILITIES = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = PROVIDER_CONFIGS[id].capabilities;
    return acc;
  },
  {} as Record<ProviderId, ProviderCapabilities>
);

const assertProviderMappingCompleteness = (mapping: Record<ProviderId, unknown>, label: string) => {
  const missing = PROVIDER_IDS.filter((id) => !(id in mapping));
  if (missing.length > 0) {
    throw new Error(`Provider mapping "${label}" is missing: ${missing.join(', ')}`);
  }
};

assertProviderMappingCompleteness(PROVIDER_CAPABILITIES, 'PROVIDER_CAPABILITIES');

export const getProviderCapabilities = (providerId: ProviderId): ProviderCapabilities => {
  return PROVIDER_CAPABILITIES[providerId] ?? DEFAULT_CAPABILITIES;
};

export const supportsProviderTavily = (providerId: ProviderId): boolean => {
  return getProviderCapabilities(providerId).supportsTavily;
};

export const supportsProviderChatAgent = (providerId: ProviderId): boolean => {
  return getProviderCapabilities(providerId).supportsChatAgent;
};

export const supportsProviderRequestMode = (providerId: ProviderId): boolean => {
  return Boolean(getProviderCapabilities(providerId).supportsRequestMode);
};

export const supportsProviderEmbedding = (providerId: ProviderId): boolean => {
  return Boolean(getProviderCapabilities(providerId).supportsEmbedding);
};
