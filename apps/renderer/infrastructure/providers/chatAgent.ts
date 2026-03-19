import { ProviderId } from '@/shared/types/chat';
import {
  supportsProviderChatAgent,
  supportsProviderTavily,
} from '@/infrastructure/providers/capabilities';
import {
  CHAT_AGENT_PROMPT,
  buildChatAgentPrompt,
  getDefaultChatAgentPromptForProvider,
  getDefaultChatAgentPromptPartsForProvider,
  parseChatAgentPromptParts,
  type ChatAgentPromptParts,
} from '@/infrastructure/providers/prompts';

const canUseChatAgent = (providerId: ProviderId): boolean => supportsProviderChatAgent(providerId);
const canUseChatAgentSearch = (providerId: ProviderId): boolean =>
  supportsProviderChatAgent(providerId) && supportsProviderTavily(providerId);

export const getDefaultChatAgentEnabled = (providerId: ProviderId): boolean =>
  canUseChatAgent(providerId);

export const getDefaultChatAgentSearchEnabled = (providerId: ProviderId): boolean | undefined =>
  canUseChatAgentSearch(providerId) ? true : undefined;

export const getDefaultChatAgentPrompt = (providerId: ProviderId): string | undefined =>
  canUseChatAgent(providerId) ? getDefaultChatAgentPromptForProvider(providerId) : undefined;

export const normalizeChatAgentEnabled = (
  providerId: ProviderId,
  enabled?: boolean
): boolean | undefined => {
  if (!canUseChatAgent(providerId)) {
    return undefined;
  }

  return Boolean(enabled);
};

export const normalizeChatAgentSearchEnabled = (
  providerId: ProviderId,
  enabled?: boolean
): boolean | undefined => {
  if (!canUseChatAgentSearch(providerId)) {
    return undefined;
  }
  if (enabled === undefined) {
    return undefined;
  }
  return Boolean(enabled);
};

const resolvePromptFallback = (providerId: ProviderId): string =>
  getDefaultChatAgentPromptForProvider(providerId);

export const normalizeChatAgentPrompt = (
  providerId: ProviderId,
  prompt?: string
): string | undefined => {
  if (!canUseChatAgent(providerId)) {
    return undefined;
  }

  const fallback = resolvePromptFallback(providerId);
  return prompt?.trim() ? String(prompt) : fallback;
};

export const resolveChatAgentFormPrompt = (providerId: ProviderId, prompt?: string): string =>
  normalizeChatAgentPrompt(providerId, prompt) ?? '';

export const getDefaultChatAgentPromptParts = (
  providerId: ProviderId
): ChatAgentPromptParts | undefined =>
  canUseChatAgent(providerId) ? getDefaultChatAgentPromptPartsForProvider(providerId) : undefined;

export const normalizeChatAgentPromptParts = (
  providerId: ProviderId,
  parts?: ChatAgentPromptParts
): ChatAgentPromptParts | undefined => {
  if (!canUseChatAgent(providerId)) {
    return undefined;
  }
  const fallback = getDefaultChatAgentPromptParts(providerId);
  if (!fallback) {
    return undefined;
  }

  const normalized = {
    identity: parts?.identity?.trim() ?? '',
    role: parts?.role?.trim() ?? '',
    setting: parts?.setting?.trim() ?? '',
  } satisfies ChatAgentPromptParts;

  if (!normalized.identity && !normalized.role && !normalized.setting) {
    return fallback;
  }

  return normalized;
};

export const buildChatAgentPromptFromParts = (
  providerId: ProviderId,
  parts?: ChatAgentPromptParts
): string | undefined => {
  if (!canUseChatAgent(providerId)) {
    return undefined;
  }
  const normalized = normalizeChatAgentPromptParts(providerId, parts);
  if (!normalized) {
    return undefined;
  }
  return buildChatAgentPrompt(normalized);
};

export const parseChatAgentPromptToParts = (
  providerId: ProviderId,
  prompt?: string
): ChatAgentPromptParts | undefined => {
  if (!canUseChatAgent(providerId)) {
    return undefined;
  }
  const fallback = getDefaultChatAgentPromptParts(providerId);
  if (!prompt || !prompt.trim()) {
    return fallback;
  }
  const parts = parseChatAgentPromptParts(prompt);
  if (!parts) {
    return fallback;
  }
  return normalizeChatAgentPromptParts(providerId, parts) ?? fallback;
};
