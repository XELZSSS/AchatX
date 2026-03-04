type KeyDefinition = {
  current: string;
  legacy: readonly string[];
};

const STORAGE_KEYS = {
  sessions: {
    current: 'achatx_sessions',
    legacy: ['gemini_chat_sessions'],
  },
  activeSessionId: {
    current: 'achatx_active_session_id',
    legacy: ['gemini_chat_active_session_id'],
  },
  providerSettings: {
    current: 'achatx_provider_settings',
    legacy: ['gemini_chat_provider_settings'],
  },
  activeProvider: {
    current: 'achatx_active_provider',
    legacy: ['gemini_chat_active_provider'],
  },
  language: {
    current: 'achatx_language',
    legacy: ['gemini_chat_language'],
  },
  theme: {
    current: 'achatx_theme',
    legacy: ['gemini_chat_theme'],
  },
  searchEnabled: {
    current: 'achatx_search_enabled',
    legacy: ['gemini_chat_search_enabled'],
  },
  inputDraft: {
    current: 'achatx_input_draft',
    legacy: ['gemini_chat_input_draft'],
  },
  settingsActiveTab: {
    current: 'achatx_settings_active_tab',
    legacy: ['gemini_settings_active_tab'],
  },
  toolCallMaxRounds: {
    current: 'achatx_tool_call_max_rounds',
    legacy: ['gemini_tool_call_max_rounds'],
  },
  mem0ApiKey: {
    current: 'achatx_mem0_api_key',
    legacy: [],
  },
  mem0UserId: {
    current: 'achatx_mem0_user_id',
    legacy: [],
  },
  proxyStaticHttp2: {
    current: 'achatx_proxy_static_http2',
    legacy: [],
  },
} as const satisfies Record<string, KeyDefinition>;

export type AppStorageKey = keyof typeof STORAGE_KEYS;

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const safeGetItem = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (storage: Storage, key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore persistence failures.
  }
};

const safeRemoveItem = (storage: Storage, key: string): void => {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore persistence failures.
  }
};

export const getAppStorageKey = (key: AppStorageKey): string => STORAGE_KEYS[key].current;

export const readAppStorage = (key: AppStorageKey): string | null => {
  const storage = getLocalStorage();
  if (!storage) return null;

  const { current, legacy } = STORAGE_KEYS[key];
  const currentValue = safeGetItem(storage, current);
  if (currentValue !== null) return currentValue;

  for (const legacyKey of legacy) {
    const legacyValue = safeGetItem(storage, legacyKey);
    if (legacyValue === null) continue;
    safeSetItem(storage, current, legacyValue);
    return legacyValue;
  }

  return null;
};

export const writeAppStorage = (key: AppStorageKey, value: string): void => {
  const storage = getLocalStorage();
  if (!storage) return;

  const { current, legacy } = STORAGE_KEYS[key];
  safeSetItem(storage, current, value);
  for (const legacyKey of legacy) {
    safeRemoveItem(storage, legacyKey);
  }
};

export const removeAppStorage = (key: AppStorageKey): void => {
  const storage = getLocalStorage();
  if (!storage) return;

  const { current, legacy } = STORAGE_KEYS[key];
  safeRemoveItem(storage, current);
  for (const legacyKey of legacy) {
    safeRemoveItem(storage, legacyKey);
  }
};
