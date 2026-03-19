import { GeminiEmbeddingConfig, ProviderId } from '@/shared/types/chat';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import type { DropdownOption } from '@/shared/ui';
import type { OpenAICodexAuthStatus } from '@/infrastructure/auth/openAICodexAuth';
import type { GeminiCliAuthStatus } from '@/infrastructure/auth/geminiCliAuth';
import type { SettingsValidationIssue } from '@/presentation/components/settingsModal/validation';

export type OpenAICodexAuthCardProps = {
  authBusy: boolean;
  authError: string;
  authStatus: OpenAICodexAuthStatus;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
};

export type GeminiCliAuthCardProps = {
  authBusy: boolean;
  authError: string;
  authStatus: GeminiCliAuthStatus;
  canOpenLocalConfig: boolean;
  canOpenCredentialPage: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenLocalConfig: () => void;
  onOpenCredentialPage: () => void;
  onRefresh: () => void;
};

export type CustomHeadersSectionProps = {
  customHeaders: Array<{ key: string; value: string }>;
  validationIssuesByField: Record<string, SettingsValidationIssue[]>;
  onAddCustomHeader: () => void;
  onSetCustomHeaderKey: (index: number, value: string) => void;
  onSetCustomHeaderValue: (index: number, value: string) => void;
  onRemoveCustomHeader: (index: number) => void;
};

export type RegionSelectorProps = {
  isCnRegion: boolean;
  isIntlRegion: boolean;
  onSetRegionCn: () => void;
  onSetRegionIntl: () => void;
};

export type CustomHeaderRowProps = {
  header: { key: string; value: string };
  index: number;
  issues?: SettingsValidationIssue[];
  onSetCustomHeaderKey: (index: number, value: string) => void;
  onSetCustomHeaderValue: (index: number, value: string) => void;
  onRemoveCustomHeader: (index: number) => void;
};

export type GeminiEmbeddingSectionProps = {
  embedding: GeminiEmbeddingConfig;
  outputDimensionalityIssues?: SettingsValidationIssue[];
  titleIssues?: SettingsValidationIssue[];
  onSetEmbeddingField: <K extends keyof GeminiEmbeddingConfig>(
    key: K,
    value: GeminiEmbeddingConfig[K]
  ) => void;
};

export type ProviderTabProps = {
  providerId: ProviderId;
  providerOptions: DropdownOption[];
  modelName: string;
  currentModelName: string;
  apiKey: string;
  requestMode?: OpenAIRequestMode;
  baseUrl?: string;
  geminiCliProjectId?: string;
  googleCloudProject?: string;
  customHeaders: Array<{ key: string; value: string }>;
  embedding: GeminiEmbeddingConfig;
  showApiKey: boolean;
  supportsRequestMode?: boolean;
  supportsEmbedding?: boolean;
  supportsBaseUrl?: boolean;
  supportsCustomHeaders?: boolean;
  supportsRegion?: boolean;
  isOfficialProvider?: boolean;
  validationIssuesByField: Record<string, SettingsValidationIssue[]>;
  onProviderChange: (providerId: ProviderId) => void;
  onModelNameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onRequestModeChange: (value: OpenAIRequestMode) => void;
  onToggleApiKeyVisibility: () => void;
  onClearApiKey: () => void;
  onBaseUrlChange: (value: string) => void;
  onGeminiCliProjectIdChange: (value: string) => void;
  onGoogleCloudProjectChange: (value: string) => void;
  onSetEmbeddingField: <K extends keyof GeminiEmbeddingConfig>(
    key: K,
    value: GeminiEmbeddingConfig[K]
  ) => void;
  onAddCustomHeader: () => void;
  onSetCustomHeaderKey: (index: number, value: string) => void;
  onSetCustomHeaderValue: (index: number, value: string) => void;
  onRemoveCustomHeader: (index: number) => void;
  onSetRegionBaseUrl: (region: 'intl' | 'cn') => void;
};
