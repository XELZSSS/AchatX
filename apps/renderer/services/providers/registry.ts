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

type ProviderDefinitionLoader = () => Promise<ProviderDefinition>;

type ProviderCustomHeader = { key: string; value: string };

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
    fallbackModel: 'deepseek-reasoner',
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

const providerDefinitionLoaders: Record<ProviderId, ProviderDefinitionLoader> = {
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

class DeferredProvider implements ProviderChat {
  private providerPromise: Promise<ProviderChat> | null = null;
  private loadedProvider: ProviderChat | null = null;

  private modelName: string;
  private apiKey?: string;
  private baseUrl?: string;
  private customHeaders?: ProviderCustomHeader[];
  private tavilyConfig?: TavilyConfig;

  constructor(
    private readonly id: ProviderId,
    defaultModel: string,
    private readonly loader: ProviderDefinitionLoader
  ) {
    this.modelName = defaultModel;
  }

  private async ensureLoaded(): Promise<ProviderChat> {
    if (this.loadedProvider) {
      return this.loadedProvider;
    }
    if (!this.providerPromise) {
      this.providerPromise = this.loader().then((definition) => {
        const provider = definition.create();
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

        this.loadedProvider = provider;
        return provider;
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

  resetChat(): void {
    this.loadedProvider?.resetChat();
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    const provider = await this.ensureLoaded();
    await provider.startChatWithHistory(messages);
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const provider = await this.ensureLoaded();
    yield* provider.sendMessageStream(message, signal);
  }
}

const definitions: Record<ProviderId, ProviderDefinition> = PROVIDER_IDS.reduce(
  (acc, id) => {
    acc[id] = {
      id,
      models: providerMeta[id].models,
      defaultModel: providerMeta[id].defaultModel,
      create: () => new DeferredProvider(id, providerMeta[id].defaultModel, providerDefinitionLoaders[id]),
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
