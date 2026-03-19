import { ProviderId } from '@/shared/types/chat';
import {
  DEEPSEEK_MODEL_CATALOG,
  GEMINI_CLI_AUTH_MODEL_CATALOG,
  GEMINI_MODEL_CATALOG,
  GLM_MODEL_CATALOG,
  LONGCAT_MODEL_CATALOG,
  MINIMAX_MODEL_CATALOG,
  MOONSHOT_MODEL_CATALOG,
  NVIDIA_MODEL_CATALOG,
  OPENAI_COMPATIBLE_MODEL_CATALOG,
  OPENAI_CODEX_AUTH_MODEL_CATALOG,
  OPENAI_MODEL_CATALOG,
  XIAOMI_MIMO_MODEL_CATALOG,
  XAI_MODEL_CATALOG,
} from '@/infrastructure/providers/models';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';

export type ProviderCapabilities = {
  supportsTavily: boolean;
  supportsBaseUrl: boolean;
  supportsCustomHeaders: boolean;
  supportsRegion: boolean;
  supportsChatAgent: boolean;
  supportsRequestMode?: boolean;
  supportsEmbedding?: boolean;
};

export type ProviderModelSpec = {
  envModel?: string;
  fallbackModel: string;
  catalog: string[];
  includeFallbackModel?: boolean;
};

export type ProviderConfig = {
  label: string;
  isOfficialProvider: boolean;
  capabilities: ProviderCapabilities;
  modelSpec: ProviderModelSpec;
  envApiKeyResolver: () => string | undefined;
  chatAgentPromptPreset?: 'default' | 'gemini';
};

const STANDARD_PROVIDER_CAPABILITIES = {
  supportsTavily: true,
  supportsBaseUrl: false,
  supportsCustomHeaders: false,
  supportsRegion: false,
  supportsChatAgent: true,
} as const satisfies ProviderCapabilities;

const REGIONAL_PROVIDER_CAPABILITIES = {
  ...STANDARD_PROVIDER_CAPABILITIES,
  supportsRegion: true,
} as const satisfies ProviderCapabilities;

const GEMINI_PROVIDER_CAPABILITIES = {
  ...STANDARD_PROVIDER_CAPABILITIES,
  supportsChatAgent: true,
  supportsEmbedding: true,
} as const satisfies ProviderCapabilities;

const OPENAI_COMPATIBLE_CAPABILITIES = {
  ...STANDARD_PROVIDER_CAPABILITIES,
  supportsBaseUrl: true,
  supportsCustomHeaders: true,
  supportsRequestMode: true,
} as const satisfies ProviderCapabilities;

const createProviderConfig = ({
  label,
  isOfficialProvider,
  capabilities,
  envModel,
  fallbackModel,
  catalog,
  envApiKey,
  includeFallbackModel,
  chatAgentPromptPreset,
}: {
  label: string;
  isOfficialProvider: boolean;
  capabilities: ProviderCapabilities;
  envModel?: string;
  fallbackModel: string;
  catalog: string[];
  envApiKey?: string;
  includeFallbackModel?: boolean;
  chatAgentPromptPreset?: ProviderConfig['chatAgentPromptPreset'];
}): ProviderConfig => ({
  label,
  isOfficialProvider,
  capabilities,
  modelSpec: {
    envModel,
    fallbackModel,
    catalog,
    includeFallbackModel,
  },
  envApiKeyResolver: () => sanitizeApiKey(envApiKey),
  chatAgentPromptPreset,
});

export const PROVIDER_CONFIGS = {
  gemini: createProviderConfig({
    label: 'Gemini',
    isOfficialProvider: true,
    capabilities: GEMINI_PROVIDER_CAPABILITIES,
    fallbackModel: 'gemini-3.1-flash-lite-preview',
    catalog: GEMINI_MODEL_CATALOG,
    envApiKey: process.env.GEMINI_API_KEY ?? process.env.API_KEY,
    chatAgentPromptPreset: 'gemini',
  }),
  'gemini-cli-auth': createProviderConfig({
    label: 'Gemini CLI OAuth',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    fallbackModel: 'gemini-2.5-flash',
    catalog: GEMINI_CLI_AUTH_MODEL_CATALOG,
    chatAgentPromptPreset: 'gemini',
  }),
  openai: createProviderConfig({
    label: 'OpenAI',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    envModel: process.env.OPENAI_MODEL,
    fallbackModel: 'gpt-5.4',
    catalog: OPENAI_MODEL_CATALOG,
    envApiKey: process.env.OPENAI_API_KEY,
  }),
  'openai-codex-auth': createProviderConfig({
    label: 'Codex OAuth',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    fallbackModel: 'gpt-5.2',
    catalog: OPENAI_CODEX_AUTH_MODEL_CATALOG,
  }),
  'openai-compatible': createProviderConfig({
    label: 'OpenAI-Compatible',
    isOfficialProvider: false,
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    envModel: process.env.OPENAI_COMPATIBLE_MODEL,
    fallbackModel: 'gpt-4.1-mini',
    catalog: OPENAI_COMPATIBLE_MODEL_CATALOG,
    envApiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
  }),
  nvidia: createProviderConfig({
    label: 'NVIDIA',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    envModel: process.env.NVIDIA_MODEL,
    fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
    catalog: NVIDIA_MODEL_CATALOG,
    envApiKey: process.env.NVIDIA_API_KEY,
  }),
  xai: createProviderConfig({
    label: 'xAI',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    envModel: process.env.XAI_MODEL,
    fallbackModel: 'grok-4-1-fast-reasoning',
    catalog: XAI_MODEL_CATALOG,
    envApiKey: process.env.XAI_API_KEY,
  }),
  deepseek: createProviderConfig({
    label: 'DeepSeek',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    envModel: process.env.DEEPSEEK_MODEL,
    fallbackModel: 'deepseek-reasoner',
    catalog: DEEPSEEK_MODEL_CATALOG,
    envApiKey: process.env.DEEPSEEK_API_KEY,
  }),
  glm: createProviderConfig({
    label: 'GLM',
    isOfficialProvider: true,
    capabilities: REGIONAL_PROVIDER_CAPABILITIES,
    envModel: process.env.GLM_MODEL,
    fallbackModel: 'glm-5',
    catalog: GLM_MODEL_CATALOG,
    envApiKey: process.env.GLM_API_KEY,
  }),
  minimax: createProviderConfig({
    label: 'MiniMax',
    isOfficialProvider: true,
    capabilities: REGIONAL_PROVIDER_CAPABILITIES,
    envModel: process.env.MINIMAX_MODEL,
    fallbackModel: 'MiniMax-M2.5',
    catalog: MINIMAX_MODEL_CATALOG,
    envApiKey: process.env.MINIMAX_API_KEY,
    includeFallbackModel: false,
  }),
  moonshot: createProviderConfig({
    label: 'Kimi',
    isOfficialProvider: true,
    capabilities: REGIONAL_PROVIDER_CAPABILITIES,
    envModel: process.env.MOONSHOT_MODEL,
    fallbackModel: 'kimi-k2.5',
    catalog: MOONSHOT_MODEL_CATALOG,
    envApiKey: process.env.MOONSHOT_API_KEY,
    includeFallbackModel: false,
  }),
  'xiaomi-mimo': createProviderConfig({
    label: 'Xiaomi MiMo',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    envModel: process.env.XIAOMI_MIMO_MODEL ?? process.env.XIAOMIMIMO_MODEL,
    fallbackModel: 'mimo-v2-flash',
    catalog: XIAOMI_MIMO_MODEL_CATALOG,
    envApiKey: process.env.XIAOMI_MIMO_API_KEY ?? process.env.XIAOMIMIMO_API_KEY,
    includeFallbackModel: false,
  }),
  longcat: createProviderConfig({
    label: 'LongCat',
    isOfficialProvider: true,
    capabilities: STANDARD_PROVIDER_CAPABILITIES,
    envModel: process.env.LONGCAT_MODEL,
    fallbackModel: 'LongCat-Flash-Chat',
    catalog: LONGCAT_MODEL_CATALOG,
    envApiKey: process.env.LONGCAT_API_KEY,
    includeFallbackModel: false,
  }),
} as const satisfies Record<ProviderId, ProviderConfig>;
