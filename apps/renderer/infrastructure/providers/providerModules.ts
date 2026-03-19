import { ProviderId } from '@/shared/types/chat';
import type { ProviderModule } from '@/infrastructure/providers/types';

export type ProviderModuleLoader = () => Promise<ProviderModule>;

export const PROVIDER_MODULE_LOADERS = {
  gemini: () => import('@/infrastructure/providers/geminiProvider'),
  'gemini-cli-auth': () => import('@/infrastructure/providers/geminiCliAuthProvider'),
  openai: () => import('@/infrastructure/providers/openaiProvider'),
  'openai-codex-auth': () => import('@/infrastructure/providers/openAICodexAuthProvider'),
  'openai-compatible': () => import('@/infrastructure/providers/openaiCompatibleProvider'),
  nvidia: () => import('@/infrastructure/providers/nvidiaProvider'),
  xai: () => import('@/infrastructure/providers/xaiProvider'),
  deepseek: () => import('@/infrastructure/providers/deepseekProvider'),
  glm: () => import('@/infrastructure/providers/glmProvider'),
  minimax: () => import('@/infrastructure/providers/minimaxProvider'),
  moonshot: () => import('@/infrastructure/providers/moonshotProvider'),
  'xiaomi-mimo': () => import('@/infrastructure/providers/xiaomiMimoProvider'),
  longcat: () => import('@/infrastructure/providers/longcatProvider'),
} as const satisfies Record<ProviderId, ProviderModuleLoader>;
