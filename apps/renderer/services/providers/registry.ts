import { ProviderId } from '../../types';
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
import { geminiProviderDefinition } from './geminiProvider';
import { openaiProviderDefinition } from './openaiProvider';
import { openaiCompatibleProviderDefinition } from './openaiCompatibleProvider';
import { openrouterProviderDefinition } from './openrouterProvider';
import { ollamaProviderDefinition } from './ollamaProvider';
import { xaiProviderDefinition } from './xaiProvider';
import { deepseekProviderDefinition } from './deepseekProvider';
import { glmProviderDefinition } from './glmProvider';
import { minimaxProviderDefinition } from './minimaxProvider';
import { moonshotProviderDefinition } from './moonshotProvider';
import { iflowProviderDefinition } from './iflowProvider';

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

const providerDefinitionsById: Record<ProviderId, ProviderDefinition> = {
  gemini: geminiProviderDefinition,
  openai: openaiProviderDefinition,
  'openai-compatible': openaiCompatibleProviderDefinition,
  openrouter: openrouterProviderDefinition,
  ollama: ollamaProviderDefinition,
  xai: xaiProviderDefinition,
  deepseek: deepseekProviderDefinition,
  glm: glmProviderDefinition,
  minimax: minimaxProviderDefinition,
  moonshot: moonshotProviderDefinition,
  iflow: iflowProviderDefinition,
};

const definitions: Record<ProviderId, ProviderDefinition> = PROVIDER_IDS.reduce(
  (acc, id) => {
    const sourceDefinition = providerDefinitionsById[id];
    acc[id] = {
      id,
      models: providerMeta[id].models,
      defaultModel: providerMeta[id].defaultModel,
      create: () => {
        const provider = sourceDefinition.create();
        provider.setModelName(providerMeta[id].defaultModel);
        return provider;
      },
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
