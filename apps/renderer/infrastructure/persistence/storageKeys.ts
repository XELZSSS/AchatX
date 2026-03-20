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
