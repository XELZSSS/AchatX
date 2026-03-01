import { ChatMessage, ProviderId, TavilyConfig } from '../../types';
import {
  DEEPSEEK_MODEL_CATALOG,
  GEMINI_MODEL_CATALOG,
  GLM_MODEL_CATALOG,
  IFLOW_MODEL_CATALOG,
  MINIMAX_MODEL_CATALOG,
  MOONSHOT_MODEL_CATALOG,
  OLLAMA_MODEL_CATALOG,
  OPENAI_COMPATIBLE_MODEL_CATALOG,
  OPENROUTER_MODEL_CATALOG,
  OPENAI_MODEL_CATALOG,
  XAI_MODEL_CATALOG,
} from './models';
import { ProviderChat, ProviderDefinition } from './types';
import { buildProviderModelConfig } from './modelConfig';

const PROVIDER_IDS: ProviderId[] = [
  'gemini',
  'openai',
  'openai-compatible',
  'openrouter',
  'ollama',
  'xai',
  'deepseek',
  'glm',
  'minimax',
  'moonshot',
  'iflow',
];

type ProviderMeta = {
  defaultModel: string;
  models: string[];
};

type ProviderModelSpec = {
  envModel?: string;
  fallbackModel: string;
  catalog: string[];
  includeFallbackModel?: boolean;
};

const providerModelSpecs: Record<ProviderId, ProviderModelSpec> = {
  gemini: {
    fallbackModel: 'gemini-3.1-pro-preview',
    catalog: GEMINI_MODEL_CATALOG,
  },
  openai: {
    envModel: process.env.OPENAI_MODEL,
    fallbackModel: 'gpt-5.2',
    catalog: OPENAI_MODEL_CATALOG,
  },
  'openai-compatible': {
    envModel: process.env.OPENAI_COMPATIBLE_MODEL,
    fallbackModel: 'gpt-4.1-mini',
    catalog: OPENAI_COMPATIBLE_MODEL_CATALOG,
  },
  openrouter: {
    envModel: process.env.OPENROUTER_MODEL,
    fallbackModel: 'openrouter/auto',
    catalog: OPENROUTER_MODEL_CATALOG,
  },
  ollama: {
    envModel: process.env.OLLAMA_MODEL,
    fallbackModel: 'llama3.2',
    catalog: OLLAMA_MODEL_CATALOG,
  },
  xai: {
    envModel: process.env.XAI_MODEL,
    fallbackModel: 'grok-4',
    catalog: XAI_MODEL_CATALOG,
  },
  deepseek: {
    envModel: process.env.DEEPSEEK_MODEL,
    fallbackModel: 'deepseek-chat',
    catalog: DEEPSEEK_MODEL_CATALOG,
  },
  glm: {
    envModel: process.env.GLM_MODEL,
    fallbackModel: 'glm-5',
    catalog: GLM_MODEL_CATALOG,
  },
  minimax: {
    envModel: process.env.MINIMAX_MODEL,
    fallbackModel: 'MiniMax-M2.5',
    catalog: MINIMAX_MODEL_CATALOG,
    includeFallbackModel: false,
  },
  moonshot: {
    envModel: process.env.MOONSHOT_MODEL,
    fallbackModel: 'kimi-k2.5',
    catalog: MOONSHOT_MODEL_CATALOG,
    includeFallbackModel: false,
  },
  iflow: {
    envModel: process.env.IFLOW_MODEL,
    fallbackModel: 'TBStars2-200B-A13B',
    catalog: IFLOW_MODEL_CATALOG,
  },
};

const providerMeta: Record<ProviderId, ProviderMeta> = PROVIDER_IDS.reduce(
  (acc, id) => {
    const config = buildProviderModelConfig(providerModelSpecs[id]);
    acc[id] = {
      defaultModel: config.defaultModel,
      models: config.models,
    };
    return acc;
  },
  {} as Record<ProviderId, ProviderMeta>
);

const providerDefinitionLoaders: Record<ProviderId, () => Promise<ProviderDefinition>> = {
  gemini: async () => (await import('./geminiProvider')).geminiProviderDefinition,
  openai: async () => (await import('./openaiProvider')).openaiProviderDefinition,
  'openai-compatible': async () =>
    (await import('./openaiCompatibleProvider')).openaiCompatibleProviderDefinition,
  openrouter: async () => (await import('./openrouterProvider')).openrouterProviderDefinition,
  ollama: async () => (await import('./ollamaProvider')).ollamaProviderDefinition,
  xai: async () => (await import('./xaiProvider')).xaiProviderDefinition,
  deepseek: async () => (await import('./deepseekProvider')).deepseekProviderDefinition,
  glm: async () => (await import('./glmProvider')).glmProviderDefinition,
  minimax: async () => (await import('./minimaxProvider')).minimaxProviderDefinition,
  moonshot: async () => (await import('./moonshotProvider')).moonshotProviderDefinition,
  iflow: async () => (await import('./iflowProvider')).iflowProviderDefinition,
};

class LazyProvider implements ProviderChat {
  private loadedProvider: ProviderChat | null = null;
  private loadingProvider: Promise<ProviderChat> | null = null;
  private modelName: string;
  private apiKey?: string;
  private baseUrl?: string;
  private customHeaders?: Array<{ key: string; value: string }>;
  private tavilyConfig?: TavilyConfig;
  private historySnapshot: ChatMessage[] = [];
  private historyVersion = 0;
  private syncedHistoryVersion = 0;

  constructor(
    private readonly id: ProviderId,
    defaultModel: string,
    private readonly loadDefinition: () => Promise<ProviderDefinition>
  ) {
    this.modelName = defaultModel;
  }

  private cloneHistory(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => ({ ...msg }));
  }

  private applyCachedState(provider: ProviderChat): void {
    provider.setModelName(this.modelName);
    provider.setApiKey(this.apiKey);
    if (provider.setBaseUrl) {
      provider.setBaseUrl(this.baseUrl);
    }
    if (provider.setCustomHeaders) {
      provider.setCustomHeaders(this.customHeaders ?? []);
    }
    if (provider.setTavilyConfig) {
      provider.setTavilyConfig(this.tavilyConfig);
    }
  }

  private async syncHistoryIfNeeded(provider: ProviderChat): Promise<void> {
    if (this.syncedHistoryVersion === this.historyVersion) return;
    await provider.startChatWithHistory(this.cloneHistory(this.historySnapshot));
    this.syncedHistoryVersion = this.historyVersion;
  }

  private async ensureProvider(): Promise<ProviderChat> {
    if (this.loadedProvider) {
      await this.syncHistoryIfNeeded(this.loadedProvider);
      return this.loadedProvider;
    }

    if (!this.loadingProvider) {
      this.loadingProvider = this.loadDefinition().then((definition) => {
        const provider = definition.create();
        this.applyCachedState(provider);
        this.loadedProvider = provider;
        return provider;
      });
    }

    const provider = await this.loadingProvider;
    await this.syncHistoryIfNeeded(provider);
    return provider;
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

  getBaseUrl(): string | undefined {
    if (!this.loadedProvider?.getBaseUrl) return this.baseUrl;
    return this.loadedProvider.getBaseUrl();
  }

  setBaseUrl(baseUrl?: string): void {
    this.baseUrl = baseUrl;
    this.loadedProvider?.setBaseUrl?.(baseUrl);
  }

  getCustomHeaders(): Array<{ key: string; value: string }> | undefined {
    if (!this.loadedProvider?.getCustomHeaders) return this.customHeaders;
    return this.loadedProvider.getCustomHeaders();
  }

  setCustomHeaders(headers: Array<{ key: string; value: string }>): void {
    this.customHeaders = [...headers];
    this.loadedProvider?.setCustomHeaders?.([...headers]);
  }

  getTavilyConfig(): TavilyConfig | undefined {
    if (!this.loadedProvider?.getTavilyConfig) return this.tavilyConfig;
    return this.loadedProvider.getTavilyConfig();
  }

  setTavilyConfig(config: TavilyConfig | undefined): void {
    this.tavilyConfig = config;
    this.loadedProvider?.setTavilyConfig?.(config);
  }

  resetChat(): void {
    this.historySnapshot = [];
    this.historyVersion += 1;
    this.syncedHistoryVersion = 0;
    this.loadedProvider?.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    this.historySnapshot = this.cloneHistory(messages);
    this.historyVersion += 1;
    if (!this.loadedProvider) return;
    await this.loadedProvider.startChatWithHistory(this.cloneHistory(this.historySnapshot));
    this.syncedHistoryVersion = this.historyVersion;
  }

  async *sendMessageStream(message: string): AsyncGenerator<string, void, unknown> {
    const provider = await this.ensureProvider();
    yield* provider.sendMessageStream(message);
  }
}

const definitions: Record<ProviderId, ProviderDefinition> = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = {
      id,
      models: providerMeta[id].models,
      defaultModel: providerMeta[id].defaultModel,
      create: () =>
        new LazyProvider(id, providerMeta[id].defaultModel, providerDefinitionLoaders[id]),
    };
    return acc;
  },
  {} as Record<ProviderId, ProviderDefinition>
);

export const getProviderDefinition = (id: ProviderId): ProviderDefinition => definitions[id];

export const createProvider = (id: ProviderId): ProviderChat => getProviderDefinition(id).create();

export const listProviderIds = (): ProviderId[] => [...PROVIDER_IDS];

export const getProviderModels = (id: ProviderId): string[] => getProviderDefinition(id).models;

export const getProviderDefaultModel = (id: ProviderId): string =>
  getProviderDefinition(id).defaultModel;
