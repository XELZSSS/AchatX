import { ProviderId } from '@/shared/types/chat';
import {
  buildDefaultProviderSettings,
  ProviderSettings,
} from '@/infrastructure/providers/defaults';
import { normalizeBaseUrlForProvider } from '@/infrastructure/providers/baseUrl';
import {
  supportsProviderEmbedding,
  supportsProviderRequestMode,
} from '@/infrastructure/providers/capabilities';
import {
  normalizeChatAgentEnabled,
  normalizeChatAgentPrompt,
  normalizeChatAgentPromptParts,
  normalizeChatAgentSearchEnabled,
  buildChatAgentPromptFromParts,
  getDefaultChatAgentSearchEnabled,
} from '@/infrastructure/providers/chatAgent';
import { normalizeCustomHeaders as normalizeHeaders } from '@/infrastructure/providers/headerUtils';
import { listProviderIds } from '@/infrastructure/providers/registry';
import { normalizeGeminiEmbeddingConfig } from '@/infrastructure/providers/geminiEmbeddings';
import { normalizeTavilyConfig } from '@/infrastructure/providers/tavily';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';
import { readAppStorage, writeAppStorage } from '@/infrastructure/persistence/storageKeys';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import {
  loadDefaultProviderId as loadAppDefaultProviderId,
  persistDefaultProviderId as persistAppDefaultProviderId,
} from '@/infrastructure/persistence/appSettingsStore';

const canUseAppStorage = (): boolean => typeof window !== 'undefined';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const areValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => areValuesEqual(item, right[index]))
    );
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) && areValuesEqual(left[key], right[key])
      )
    );
  }

  return false;
};

const normalizeModelName = (value?: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '';
};

const normalizeBaseUrl = (providerId: ProviderId, value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0
    ? normalizeBaseUrlForProvider(providerId, trimmed)
    : undefined;
};

const normalizeOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStoredCustomHeaders = (
  headers?: Array<{ key?: string; value?: string }>
): Array<{ key: string; value: string }> | undefined => {
  if (!headers) return undefined;
  return normalizeHeaders(headers);
};

const normalizeRequestMode = (
  providerId: ProviderId,
  value?: string
): OpenAIRequestMode | undefined => {
  if (!supportsProviderRequestMode(providerId)) {
    return undefined;
  }

  return value === 'responses' ? 'responses' : 'chat_completions';
};

const resolveGlobalTavilyConfig = (
  settings: Record<ProviderId, ProviderSettings>
): ProviderSettings['tavily'] => {
  for (const id of listProviderIds()) {
    const tavily = normalizeTavilyConfig(settings[id]?.tavily);
    if (tavily) return tavily;
  }
  return undefined;
};

export const applyGlobalTavilyConfig = (
  settings: Record<ProviderId, ProviderSettings>,
  tavily: ProviderSettings['tavily']
): Record<ProviderId, ProviderSettings> => {
  const next = {} as Record<ProviderId, ProviderSettings>;
  for (const id of listProviderIds()) {
    next[id] = { ...settings[id], tavily };
  }
  return next;
};

const applyResolvedGlobalTavily = (
  settings: Record<ProviderId, ProviderSettings>
): Record<ProviderId, ProviderSettings> => {
  return applyGlobalTavilyConfig(settings, resolveGlobalTavilyConfig(settings));
};

const toStoredProviderSettingsRecord = (
  value: unknown
): Partial<Record<string, Partial<ProviderSettings>>> => {
  return isPlainObject(value) ? (value as Partial<Record<string, Partial<ProviderSettings>>>) : {};
};

const canonicalizeProviderSettingsRecord = (
  value: unknown
): Record<ProviderId, ProviderSettings> => {
  const defaults = buildDefaultProviderSettings();
  const storedSettings = toStoredProviderSettingsRecord(value);

  for (const id of listProviderIds()) {
    defaults[id] = normalizeStoredProviderSettings(id, defaults[id], storedSettings[id] ?? {});
  }

  return applyResolvedGlobalTavily(defaults);
};

export const normalizeProviderSettingsRecord = (
  value: unknown
): Record<ProviderId, ProviderSettings> => {
  return canonicalizeProviderSettingsRecord(value);
};

export const normalizePartialProviderSettingsRecord = (
  value: unknown
): Partial<Record<ProviderId, ProviderSettings>> => {
  const defaults = buildDefaultProviderSettings();
  const storedSettings = toStoredProviderSettingsRecord(value);
  const next: Partial<Record<ProviderId, ProviderSettings>> = {};

  for (const id of listProviderIds()) {
    if (!Object.prototype.hasOwnProperty.call(storedSettings, id)) {
      continue;
    }

    next[id] = normalizeStoredProviderSettings(id, defaults[id], storedSettings[id] ?? {});
  }

  return next;
};

const normalizeStoredProviderSettings = (
  providerId: ProviderId,
  defaults: ProviderSettings,
  storedSettings: Partial<ProviderSettings>
): ProviderSettings => {
  const fallbackParts = defaults.chatAgentPromptParts;
  const storedParts = normalizeChatAgentPromptParts(
    providerId,
    storedSettings.chatAgentPromptParts
  );
  const resolvedParts = storedParts ?? fallbackParts;
  const promptFromParts = buildChatAgentPromptFromParts(providerId, resolvedParts);
  const promptFallback = defaults.chatAgentPrompt;
  const chatAgentSearchEnabledFallback =
    defaults.chatAgentSearchEnabled ?? getDefaultChatAgentSearchEnabled(providerId);
  const chatAgentSearchEnabled =
    normalizeChatAgentSearchEnabled(providerId, storedSettings.chatAgentSearchEnabled) ??
    chatAgentSearchEnabledFallback;
  const embedding = supportsProviderEmbedding(providerId)
    ? (normalizeGeminiEmbeddingConfig(storedSettings.embedding) ?? defaults.embedding)
    : undefined;

  return {
    apiKey: sanitizeApiKey(storedSettings.apiKey) ?? defaults.apiKey,
    modelName: normalizeModelName(storedSettings.modelName),
    requestMode:
      normalizeRequestMode(providerId, storedSettings.requestMode) ?? defaults.requestMode,
    baseUrl: normalizeBaseUrl(providerId, storedSettings.baseUrl) ?? defaults.baseUrl,
    geminiCliProjectId:
      normalizeOptionalText(storedSettings.geminiCliProjectId) ?? defaults.geminiCliProjectId,
    googleCloudProject:
      normalizeOptionalText(storedSettings.googleCloudProject) ?? defaults.googleCloudProject,
    customHeaders:
      normalizeStoredCustomHeaders(storedSettings.customHeaders) ?? defaults.customHeaders,
    tavily: normalizeTavilyConfig(storedSettings.tavily) ?? defaults.tavily,
    embedding,
    chatAgentEnabled:
      normalizeChatAgentEnabled(providerId, storedSettings.chatAgentEnabled) ??
      defaults.chatAgentEnabled,
    chatAgentPrompt: normalizeChatAgentPrompt(providerId, promptFromParts ?? promptFallback),
    chatAgentPromptParts:
      resolvedParts ?? normalizeChatAgentPromptParts(providerId, defaults.chatAgentPromptParts),
    chatAgentSearchEnabled,
  };
};

export const loadDefaultProviderId = (): ProviderId => {
  return loadAppDefaultProviderId();
};

export const persistDefaultProviderId = (providerId: ProviderId): void => {
  persistAppDefaultProviderId(providerId);
};

export const loadProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  const defaults = buildDefaultProviderSettings();
  if (!canUseAppStorage()) {
    return applyResolvedGlobalTavily(defaults);
  }

  try {
    const stored = readAppStorage('providerSettings');
    if (!stored) {
      return applyResolvedGlobalTavily(defaults);
    }

    const parsed = JSON.parse(stored) as unknown;
    const normalizedSettings = canonicalizeProviderSettingsRecord(parsed);

    if (!areValuesEqual(normalizedSettings, parsed)) {
      persistProviderSettings(normalizedSettings);
    }

    return normalizedSettings;
  } catch (error) {
    console.error('Failed to load provider settings:', error);
    return applyResolvedGlobalTavily(defaults);
  }
};

export const persistProviderSettings = (settings: Record<ProviderId, ProviderSettings>): void => {
  if (!canUseAppStorage()) return;
  try {
    writeAppStorage(
      'providerSettings',
      JSON.stringify(canonicalizeProviderSettingsRecord(settings))
    );
  } catch (error) {
    console.error('Failed to persist provider settings:', error);
  }
};

export const normalizeProviderSettingsUpdate = (
  providerId: ProviderId,
  current: ProviderSettings,
  updates: Partial<ProviderSettings>
): ProviderSettings => {
  const fallbackParts = current.chatAgentPromptParts;
  const incomingParts = updates.chatAgentPromptParts ?? undefined;
  const normalizedIncomingParts = normalizeChatAgentPromptParts(providerId, incomingParts);
  const resolvedParts = normalizedIncomingParts ?? fallbackParts;
  const promptFromParts =
    updates.chatAgentPromptParts !== undefined
      ? buildChatAgentPromptFromParts(providerId, resolvedParts)
      : undefined;
  const chatAgentSearchEnabled =
    normalizeChatAgentSearchEnabled(providerId, updates.chatAgentSearchEnabled) ??
    current.chatAgentSearchEnabled;
  const embedding =
    updates.embedding !== undefined
      ? supportsProviderEmbedding(providerId)
        ? normalizeGeminiEmbeddingConfig(updates.embedding)
        : undefined
      : current.embedding;

  return {
    apiKey: updates.apiKey !== undefined ? sanitizeApiKey(updates.apiKey) : current.apiKey,
    modelName:
      updates.modelName !== undefined ? normalizeModelName(updates.modelName) : current.modelName,
    requestMode:
      updates.requestMode !== undefined
        ? normalizeRequestMode(providerId, updates.requestMode)
        : current.requestMode,
    baseUrl:
      updates.baseUrl !== undefined
        ? normalizeBaseUrl(providerId, updates.baseUrl)
        : current.baseUrl,
    geminiCliProjectId:
      updates.geminiCliProjectId !== undefined
        ? normalizeOptionalText(updates.geminiCliProjectId)
        : current.geminiCliProjectId,
    googleCloudProject:
      updates.googleCloudProject !== undefined
        ? normalizeOptionalText(updates.googleCloudProject)
        : current.googleCloudProject,
    customHeaders:
      updates.customHeaders !== undefined
        ? normalizeStoredCustomHeaders(updates.customHeaders)
        : current.customHeaders,
    tavily: updates.tavily !== undefined ? normalizeTavilyConfig(updates.tavily) : current.tavily,
    embedding,
    chatAgentEnabled:
      normalizeChatAgentEnabled(providerId, updates.chatAgentEnabled) ?? current.chatAgentEnabled,
    chatAgentPrompt: normalizeChatAgentPrompt(
      providerId,
      promptFromParts ??
        (updates.chatAgentPrompt !== undefined
          ? String(updates.chatAgentPrompt)
          : current.chatAgentPrompt)
    ),
    chatAgentPromptParts:
      updates.chatAgentPromptParts !== undefined
        ? resolvedParts
        : normalizeChatAgentPromptParts(providerId, current.chatAgentPromptParts),
    chatAgentSearchEnabled,
  };
};
