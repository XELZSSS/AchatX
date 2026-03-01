import { ProviderId } from '../types';
import { buildDefaultProviderSettings, ProviderSettings } from './providers/defaults';
import { normalizeCustomHeaders as normalizeHeaders } from './providers/headerUtils';
import { getProviderDefaultModel, listProviderIds } from './providers/registry';
import { normalizeTavilyConfig } from './providers/tavily';
import { sanitizeApiKey } from './providers/utils';
import { readAppStorage, writeAppStorage } from './storageKeys';

const normalizeModelName = (providerId: ProviderId, value?: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : getProviderDefaultModel(providerId);
};

const normalizeBaseUrl = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStoredCustomHeaders = (
  headers?: Array<{ key?: string; value?: string }>
): Array<{ key: string; value: string }> | undefined => {
  if (!headers) return undefined;
  return normalizeHeaders(headers);
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

export const loadActiveProviderId = (): ProviderId => {
  const available = listProviderIds();
  const fallbackProviderId = available[0] ?? 'gemini';
  if (typeof window === 'undefined') {
    return fallbackProviderId;
  }
  try {
    const stored = readAppStorage('activeProvider') as ProviderId | null;
    if (stored && available.includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.error('Failed to load active provider:', error);
  }
  return fallbackProviderId;
};

export const persistActiveProviderId = (providerId: ProviderId): void => {
  if (typeof window === 'undefined') return;
  try {
    writeAppStorage('activeProvider', providerId);
  } catch (error) {
    console.error('Failed to persist active provider:', error);
  }
};

export const loadProviderSettings = (): Record<ProviderId, ProviderSettings> => {
  let defaults = buildDefaultProviderSettings();
  if (typeof window === 'undefined') {
    return applyResolvedGlobalTavily(defaults);
  }

  try {
    const stored = readAppStorage('providerSettings');
    if (!stored) {
      return applyResolvedGlobalTavily(defaults);
    }

    const parsed = JSON.parse(stored) as Partial<Record<ProviderId, Partial<ProviderSettings>>>;
    for (const id of listProviderIds()) {
      const storedSettings = parsed[id];
      if (!storedSettings) continue;
      defaults[id] = {
        apiKey: sanitizeApiKey(storedSettings.apiKey) ?? defaults[id].apiKey,
        modelName: normalizeModelName(id, storedSettings.modelName),
        baseUrl: normalizeBaseUrl(storedSettings.baseUrl) ?? defaults[id].baseUrl,
        customHeaders:
          normalizeStoredCustomHeaders(storedSettings.customHeaders) ?? defaults[id].customHeaders,
        tavily: normalizeTavilyConfig(storedSettings.tavily) ?? defaults[id].tavily,
      };
    }
    defaults = applyResolvedGlobalTavily(defaults);
    return defaults;
  } catch (error) {
    console.error('Failed to load provider settings:', error);
    return applyResolvedGlobalTavily(defaults);
  }
};

export const persistProviderSettings = (settings: Record<ProviderId, ProviderSettings>): void => {
  if (typeof window === 'undefined') return;
  try {
    writeAppStorage('providerSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist provider settings:', error);
  }
};

export const normalizeProviderSettingsUpdate = (
  providerId: ProviderId,
  current: ProviderSettings,
  updates: Partial<ProviderSettings>
): ProviderSettings => {
  return {
    apiKey: updates.apiKey !== undefined ? sanitizeApiKey(updates.apiKey) : current.apiKey,
    modelName:
      updates.modelName !== undefined
        ? normalizeModelName(providerId, updates.modelName)
        : current.modelName,
    baseUrl: updates.baseUrl !== undefined ? normalizeBaseUrl(updates.baseUrl) : current.baseUrl,
    customHeaders:
      updates.customHeaders !== undefined
        ? normalizeStoredCustomHeaders(updates.customHeaders)
        : current.customHeaders,
    tavily: updates.tavily !== undefined ? normalizeTavilyConfig(updates.tavily) : current.tavily,
  };
};
