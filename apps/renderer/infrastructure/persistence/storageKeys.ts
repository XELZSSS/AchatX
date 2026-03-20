type KeyDefinition = string;

type NativeAppStorage = Pick<
  NonNullable<Window['orlinx']>,
  'readStoredAppValue' | 'writeStoredAppValue' | 'removeStoredAppValue'
>;

const STORAGE_KEYS = {
  sessions: 'orlinx_session_index_v1',
  activeSessionId: 'orlinx_active_session_id_v1',
  providerSettings: 'orlinx_provider_settings',
  appSettings: 'orlinx_app_settings',
  searchEnabled: 'orlinx_search_enabled',
  reasoningEnabled: 'orlinx_reasoning_enabled',
  inputDraft: 'orlinx_input_draft',
  recentEmojis: 'orlinx_recent_emojis',
  appVersion: 'orlinx_app_version',
  updaterStatus: 'orlinx_updater_status',
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

const getNativeAppStorage = (): NativeAppStorage | null => {
  if (
    typeof window === 'undefined' ||
    !window.orlinx?.readStoredAppValue ||
    !window.orlinx?.writeStoredAppValue ||
    !window.orlinx?.removeStoredAppValue
  ) {
    return null;
  }

  return window.orlinx;
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

export const getAppStorageKey = (key: AppStorageKey): string => STORAGE_KEYS[key];

export const readAppStorage = (key: AppStorageKey): string | null => {
  const nativeAppStorage = getNativeAppStorage();
  if (nativeAppStorage) {
    try {
      return nativeAppStorage.readStoredAppValue(key);
    } catch {
      return null;
    }
  }

  const storage = getLocalStorage();
  return storage ? safeGetItem(storage, STORAGE_KEYS[key]) : null;
};

export const writeAppStorage = (key: AppStorageKey, value: string): void => {
  const nativeAppStorage = getNativeAppStorage();
  if (nativeAppStorage) {
    try {
      nativeAppStorage.writeStoredAppValue(key, value);
      return;
    } catch {
      return;
    }
  }

  const storage = getLocalStorage();
  if (storage) {
    safeSetItem(storage, STORAGE_KEYS[key], value);
  }
};

export const removeAppStorage = (key: AppStorageKey): void => {
  const nativeAppStorage = getNativeAppStorage();
  if (nativeAppStorage) {
    try {
      nativeAppStorage.removeStoredAppValue(key);
      return;
    } catch {
      return;
    }
  }

  const storage = getLocalStorage();
  if (storage) {
    safeRemoveItem(storage, STORAGE_KEYS[key]);
  }
};

