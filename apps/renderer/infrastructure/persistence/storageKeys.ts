type KeyDefinition = string;

type NativeAppStorage = Pick<
  NonNullable<Window['axchat']>,
  'readStoredAppValue' | 'writeStoredAppValue' | 'removeStoredAppValue'
>;

const STORAGE_KEYS = {
  sessions: 'axchat_session_index_v1',
  activeSessionId: 'axchat_active_session_id_v1',
  providerSettings: 'axchat_provider_settings',
  appSettings: 'axchat_app_settings',
  searchEnabled: 'axchat_search_enabled',
  reasoningEnabled: 'axchat_reasoning_enabled',
  inputDraft: 'axchat_input_draft',
  recentEmojis: 'axchat_recent_emojis',
  appVersion: 'axchat_app_version',
  updaterStatus: 'axchat_updater_status',
} as const satisfies Record<string, KeyDefinition>;

const OBSOLETE_STORAGE_KEYS = [
  'axchat_active_provider',
  'axchat_language',
  'axchat_theme',
  'axchat_tool_call_max_rounds',
  'axchat_proxy_static_http2',
  'axchat_proxy_allow_http_targets',
] as const;

export type AppStorageKey = keyof typeof STORAGE_KEYS;

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getNativeAppStorage = (): NativeAppStorage | null => {
  if (
    typeof window === 'undefined' ||
    !window.axchat?.readStoredAppValue ||
    !window.axchat?.writeStoredAppValue ||
    !window.axchat?.removeStoredAppValue
  ) {
    return null;
  }

  return window.axchat;
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

const mirrorNativeValueToLocal = (
  storage: Storage | null,
  key: AppStorageKey,
  value: string
): void => {
  if (!storage) {
    return;
  }

  safeSetItem(storage, STORAGE_KEYS[key], value);
};

const syncCurrentValueToNative = (key: AppStorageKey, value: string): void => {
  const nativeAppStorage = getNativeAppStorage();
  if (!nativeAppStorage) {
    return;
  }

  try {
    const nativeValue = nativeAppStorage.readStoredAppValue(key);
    if (nativeValue === value) {
      return;
    }
    nativeAppStorage.writeStoredAppValue(key, value);
  } catch {
    // ignore backfill failures
  }
};

const writeNativeAppStorage = (key: AppStorageKey, value: string): void => {
  const nativeAppStorage = getNativeAppStorage();
  if (!nativeAppStorage) {
    return;
  }

  try {
    nativeAppStorage.writeStoredAppValue(key, value);
  } catch {
    // keep local mirror even if native persistence fails
  }
};

const removeNativeAppStorage = (key: AppStorageKey): void => {
  const nativeAppStorage = getNativeAppStorage();
  if (!nativeAppStorage) {
    return;
  }

  try {
    nativeAppStorage.removeStoredAppValue(key);
  } catch {
    // keep local removal even if native persistence fails
  }
};

export const getAppStorageKey = (key: AppStorageKey): string => STORAGE_KEYS[key];

export const readAppStorage = (key: AppStorageKey): string | null => {
  const storage = getLocalStorage();
  if (storage) {
    const localValue = safeGetItem(storage, STORAGE_KEYS[key]);
    if (localValue !== null) {
      syncCurrentValueToNative(key, localValue);
      return localValue;
    }
  }

  const nativeAppStorage = getNativeAppStorage();
  if (nativeAppStorage) {
    try {
      const nativeValue = nativeAppStorage.readStoredAppValue(key);
      if (nativeValue !== null && nativeValue !== undefined) {
        mirrorNativeValueToLocal(storage, key, nativeValue);
        return nativeValue;
      }
    } catch {
      // fall back to renderer storage below
    }
  }

  return null;
};

export const writeAppStorage = (key: AppStorageKey, value: string): void => {
  const storage = getLocalStorage();
  mirrorNativeValueToLocal(storage, key, value);

  writeNativeAppStorage(key, value);
};

export const removeAppStorage = (key: AppStorageKey): void => {
  const storage = getLocalStorage();
  if (storage) {
    safeRemoveItem(storage, STORAGE_KEYS[key]);
  }

  removeNativeAppStorage(key);
};

export const cleanupLegacyAppStorage = (): void => {
  const storage = getLocalStorage();
  if (storage) {
    for (const key of OBSOLETE_STORAGE_KEYS) {
      safeRemoveItem(storage, key);
    }
  }

  const nativeAppStorage = getNativeAppStorage();
  if (!nativeAppStorage) {
    return;
  }

  for (const key of OBSOLETE_STORAGE_KEYS) {
    try {
      nativeAppStorage.removeStoredAppValue(key);
    } catch {
      // ignore cleanup failures
    }
  }
};
