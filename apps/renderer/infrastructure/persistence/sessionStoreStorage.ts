import type { ChatSession } from '@/shared/types/chat';
import {
  type AppStorageKey,
  readAppStorage,
  removeAppStorage,
  writeAppStorage,
} from '@/infrastructure/persistence/storageKeys';

const memoryStore = new Map<AppStorageKey, string>();
const payloadMemoryStore = new Map<string, string>();
let sessionsCache: ChatSession[] | null = null;
const SESSION_PAYLOAD_KEY_PREFIX = 'axchat_session_payload_v1_';

export const storageGetItem = (key: AppStorageKey): string | null => {
  const storageValue = readAppStorage(key);
  if (storageValue !== null) {
    memoryStore.set(key, storageValue);
    return storageValue;
  }

  return memoryStore.get(key) ?? null;
};

export const storageSetItem = (key: AppStorageKey, value: string): void => {
  writeAppStorage(key, value);
  memoryStore.set(key, value);
};

export const storageRemoveItem = (key: AppStorageKey): void => {
  removeAppStorage(key);
  memoryStore.delete(key);
};

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getSessionPayloadStorageKey = (sessionId: string): string =>
  `${SESSION_PAYLOAD_KEY_PREFIX}${sessionId}`;

export const readSessionPayloadRaw = (sessionId: string): string | null => {
  const key = getSessionPayloadStorageKey(sessionId);
  const storage = getLocalStorage();
  if (storage) {
    try {
      const value = storage.getItem(key);
      if (value !== null) {
        payloadMemoryStore.set(key, value);
        return value;
      }
    } catch {
      // fall back to memory cache
    }
  }

  return payloadMemoryStore.get(key) ?? null;
};

export const writeSessionPayloadRaw = (sessionId: string, value: string): void => {
  const key = getSessionPayloadStorageKey(sessionId);
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // fall back to memory cache
    }
  }

  payloadMemoryStore.set(key, value);
};

export const removeSessionPayloadRaw = (sessionId: string): void => {
  const key = getSessionPayloadStorageKey(sessionId);
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // fall back to memory cache
    }
  }

  payloadMemoryStore.delete(key);
};

export const cleanupOrphanSessionPayloads = (activeSessionIds: Set<string>): void => {
  const isActivePayloadKey = (key: string): boolean => {
    if (!key.startsWith(SESSION_PAYLOAD_KEY_PREFIX)) return false;
    const sessionId = key.slice(SESSION_PAYLOAD_KEY_PREFIX.length);
    return sessionId.length > 0 && activeSessionIds.has(sessionId);
  };

  const storage = getLocalStorage();
  if (storage) {
    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key || !key.startsWith(SESSION_PAYLOAD_KEY_PREFIX)) continue;
        if (!isActivePayloadKey(key)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        try {
          storage.removeItem(key);
        } catch {
          // ignore storage cleanup failure
        }
      }
    } catch {
      // ignore key enumeration failures
    }
  }

  for (const key of payloadMemoryStore.keys()) {
    if (!isActivePayloadKey(key)) {
      payloadMemoryStore.delete(key);
    }
  }
};

export const getCachedSessionsValue = (): ChatSession[] | null => sessionsCache;

export const setCachedSessionsValue = (sessions: ChatSession[] | null): void => {
  sessionsCache = sessions;
};
