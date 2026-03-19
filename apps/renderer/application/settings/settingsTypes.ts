import { ProviderId } from '@/shared/types/chat';
import type { AppSettings } from '@/infrastructure/persistence/appSettingsStore';
import { ProviderSettings } from '@/infrastructure/providers/defaults';

export type ProviderSettingsMap = Record<ProviderId, ProviderSettings>;

export type SaveProviderSettingsPayload = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  requestMode?: ProviderSettings['requestMode'];
  baseUrl?: string;
  geminiCliProjectId?: ProviderSettings['geminiCliProjectId'];
  googleCloudProject?: ProviderSettings['googleCloudProject'];
  customHeaders?: ProviderSettings['customHeaders'];
  tavily?: ProviderSettings['tavily'];
  embedding?: ProviderSettings['embedding'];
  chatAgentEnabled?: ProviderSettings['chatAgentEnabled'];
  chatAgentPrompt?: ProviderSettings['chatAgentPrompt'];
  chatAgentPromptParts?: ProviderSettings['chatAgentPromptParts'];
  chatAgentSearchEnabled?: ProviderSettings['chatAgentSearchEnabled'];
};

export type SaveSettingsPayload = {
  provider: SaveProviderSettingsPayload;
  app: AppSettings;
};
