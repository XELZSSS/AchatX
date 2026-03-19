import { ChatMessage, GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import { PROVIDER_CONFIGS } from '@/infrastructure/providers/providerConfig';
import {
  OpenAIRequestMode,
  ProviderChat,
  ProviderDefinition,
  ProviderReasoningPreference,
} from '@/infrastructure/providers/types';
import { buildProviderModelConfig } from '@/infrastructure/providers/modelConfig';
import { PROVIDER_IDS as RAW_PROVIDER_IDS } from '../../../shared/provider-ids';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import {
  PROVIDER_MODULE_LOADERS,
  type ProviderModuleLoader,
} from '@/infrastructure/providers/providerModules';

type ProviderMeta = {
  defaultModel: string;
  models: string[];
};

type ProviderCustomHeader = { key: string; value: string };

const PROVIDER_IDS = [...RAW_PROVIDER_IDS] as ProviderId[];

const assertProviderMappingCompleteness = (mapping: Record<ProviderId, unknown>, label: string) => {
  const missing = PROVIDER_IDS.filter((id) => !(id in mapping));
  if (missing.length > 0) {
    throw new Error(`Provider mapping "${label}" is missing: ${missing.join(', ')}`);
  }
};

const providerMeta: Record<ProviderId, ProviderMeta> = PROVIDER_IDS.reduce(
  (acc, id) => {
    const config = buildProviderModelConfig(PROVIDER_CONFIGS[id].modelSpec);
    acc[id] = {
      defaultModel: config.defaultModel,
      models: config.models,
    };
    return acc;
  },
  {} as Record<ProviderId, ProviderMeta>
);

assertProviderMappingCompleteness(PROVIDER_MODULE_LOADERS, 'providerModuleLoaders');

class DeferredProvider implements ProviderChat {
  private providerPromise: Promise<ProviderChat> | null = null;
  private loadedProvider: ProviderChat | null = null;

  private modelName: string;
  private apiKey?: string;
  private baseUrl?: string;
  private customHeaders?: ProviderCustomHeader[];
  private tavilyConfig?: TavilyConfig;
  private embeddingConfig?: GeminiEmbeddingConfig;
  private chatAgentEnabled?: boolean;
  private chatAgentPrompt?: string;
  private chatAgentSearchEnabled?: boolean;
  private reasoningPreference?: ProviderReasoningPreference;
  private requestMode?: OpenAIRequestMode;

  constructor(
    private readonly id: ProviderId,
    defaultModel: string,
    private readonly loader: ProviderModuleLoader
  ) {
    this.modelName = defaultModel;
  }

  private async ensureLoaded(): Promise<ProviderChat> {
    if (this.loadedProvider) {
      return this.loadedProvider;
    }
    if (!this.providerPromise) {
      this.providerPromise = this.loader()
        .then((providerModule) => {
          const provider = providerModule.createProviderInstance();
          provider.setModelName(this.modelName);
          provider.setApiKey(this.apiKey);

          if (provider.setBaseUrl && this.baseUrl !== undefined) {
            provider.setBaseUrl(this.baseUrl);
          }
          if (provider.setCustomHeaders && this.customHeaders !== undefined) {
            provider.setCustomHeaders(this.customHeaders);
          }
          if (provider.setTavilyConfig && this.tavilyConfig !== undefined) {
            provider.setTavilyConfig(this.tavilyConfig);
          }
          if (provider.setEmbeddingConfig && this.embeddingConfig !== undefined) {
            provider.setEmbeddingConfig(this.embeddingConfig);
          }
          if (provider.setChatAgentEnabled && this.chatAgentEnabled !== undefined) {
            provider.setChatAgentEnabled(this.chatAgentEnabled);
          }
          if (provider.setChatAgentPrompt && this.chatAgentPrompt !== undefined) {
            provider.setChatAgentPrompt(this.chatAgentPrompt);
          }
          if (provider.setChatAgentSearchEnabled && this.chatAgentSearchEnabled !== undefined) {
            provider.setChatAgentSearchEnabled(this.chatAgentSearchEnabled);
          }
          if (provider.setReasoningPreference && this.reasoningPreference !== undefined) {
            provider.setReasoningPreference(this.reasoningPreference);
          }
          if (provider.setRequestMode && this.requestMode !== undefined) {
            provider.setRequestMode(this.requestMode);
          }
          this.loadedProvider = provider;
          return provider;
        })
        .catch((error) => {
          this.providerPromise = null;
          throw error;
        });
    }
    return this.providerPromise;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.loadedProvider?.getModelName() ?? this.modelName;
  }

  setModelName(model: string): void {
    this.modelName = model;
    this.loadedProvider?.setModelName(model);
  }

  getApiKey(): string | undefined {
    return this.loadedProvider?.getApiKey() ?? this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = apiKey;
    this.loadedProvider?.setApiKey(apiKey);
  }

  getBaseUrl?(): string | undefined {
    if (this.loadedProvider?.getBaseUrl) {
      return this.loadedProvider.getBaseUrl();
    }
    return this.baseUrl;
  }

  setBaseUrl?(baseUrl?: string): void {
    this.baseUrl = baseUrl;
    this.loadedProvider?.setBaseUrl?.(baseUrl);
  }

  getCustomHeaders?(): ProviderCustomHeader[] | undefined {
    if (this.loadedProvider?.getCustomHeaders) {
      return this.loadedProvider.getCustomHeaders();
    }
    return this.customHeaders;
  }

  setCustomHeaders?(headers: ProviderCustomHeader[]): void {
    this.customHeaders = headers;
    this.loadedProvider?.setCustomHeaders?.(headers);
  }

  getTavilyConfig?(): TavilyConfig | undefined {
    if (this.loadedProvider?.getTavilyConfig) {
      return this.loadedProvider.getTavilyConfig();
    }
    return this.tavilyConfig;
  }

  setTavilyConfig?(config: TavilyConfig | undefined): void {
    this.tavilyConfig = config;
    this.loadedProvider?.setTavilyConfig?.(config);
  }

  getEmbeddingConfig?(): GeminiEmbeddingConfig | undefined {
    if (this.loadedProvider?.getEmbeddingConfig) {
      return this.loadedProvider.getEmbeddingConfig();
    }
    return this.embeddingConfig;
  }

  setEmbeddingConfig?(config: GeminiEmbeddingConfig | undefined): void {
    this.embeddingConfig = config;
    this.loadedProvider?.setEmbeddingConfig?.(config);
  }

  getChatAgentEnabled?(): boolean | undefined {
    if (this.loadedProvider?.getChatAgentEnabled) {
      return this.loadedProvider.getChatAgentEnabled();
    }
    return this.chatAgentEnabled;
  }

  setChatAgentEnabled?(enabled: boolean): void {
    this.chatAgentEnabled = enabled;
    this.loadedProvider?.setChatAgentEnabled?.(enabled);
  }

  getChatAgentPrompt?(): string | undefined {
    if (this.loadedProvider?.getChatAgentPrompt) {
      return this.loadedProvider.getChatAgentPrompt();
    }
    return this.chatAgentPrompt;
  }

  setChatAgentPrompt?(prompt: string): void {
    this.chatAgentPrompt = prompt;
    this.loadedProvider?.setChatAgentPrompt?.(prompt);
  }

  getChatAgentSearchEnabled?(): boolean | undefined {
    if (this.loadedProvider?.getChatAgentSearchEnabled) {
      return this.loadedProvider.getChatAgentSearchEnabled();
    }
    return this.chatAgentSearchEnabled;
  }

  setChatAgentSearchEnabled?(enabled: boolean): void {
    this.chatAgentSearchEnabled = enabled;
    this.loadedProvider?.setChatAgentSearchEnabled?.(enabled);
  }

  getReasoningPreference?(): ProviderReasoningPreference | undefined {
    if (this.loadedProvider?.getReasoningPreference) {
      return this.loadedProvider.getReasoningPreference();
    }
    return this.reasoningPreference;
  }

  setReasoningPreference?(preference: ProviderReasoningPreference): void {
    this.reasoningPreference = preference;
    this.loadedProvider?.setReasoningPreference?.(preference);
  }

  getRequestMode?(): OpenAIRequestMode | undefined {
    if (this.loadedProvider?.getRequestMode) {
      return this.loadedProvider.getRequestMode();
    }
    return this.requestMode;
  }

  setRequestMode?(mode: OpenAIRequestMode): void {
    this.requestMode = mode;
    this.loadedProvider?.setRequestMode?.(mode);
  }

  consumePendingResponseMetadata?() {
    return this.loadedProvider?.consumePendingResponseMetadata?.();
  }

  resetChat(): void {
    this.loadedProvider?.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    const provider = await this.ensureLoaded();
    await provider.startChatWithHistory(messages);
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal,
    requestPolicy?: RequestPolicy
  ): AsyncGenerator<string, void, unknown> {
    const provider = await this.ensureLoaded();
    yield* provider.sendMessageStream(message, signal, requestPolicy);
  }
}

const definitions: Record<ProviderId, ProviderDefinition> = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = {
      id,
      models: providerMeta[id].models,
      defaultModel: providerMeta[id].defaultModel,
      create: () =>
        new DeferredProvider(id, providerMeta[id].defaultModel, PROVIDER_MODULE_LOADERS[id]),
    };
    return acc;
  },
  {} as Record<ProviderId, ProviderDefinition>
);

export const getProviderDefinition = (id: ProviderId): ProviderDefinition => definitions[id];

export const createProvider = (id: ProviderId): ProviderChat => getProviderDefinition(id).create();

export const listProviderIds = (): ProviderId[] => [...PROVIDER_IDS];
