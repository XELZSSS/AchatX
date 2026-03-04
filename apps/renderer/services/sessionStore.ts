import { ChatSession } from '../types';
import { formatMessageTime } from '../utils/time';
import { AppStorageKey, readAppStorage, removeAppStorage, writeAppStorage } from './storageKeys';

const DEFAULT_PROVIDER_ID = 'gemini' as const;
const DEFAULT_MODEL_NAME = 'gemini-3.1-pro-preview';

const SESSIONS_STORAGE_KEY: AppStorageKey = 'sessions';
const ACTIVE_SESSION_STORAGE_KEY: AppStorageKey = 'activeSessionId';

type StoredSession = Partial<ChatSession> &
  Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>;
type StoredSessionIndexEntry = Pick<
  ChatSession,
  'id' | 'title' | 'provider' | 'model' | 'createdAt' | 'updatedAt'
>;
type StoredSessionIndexV2 = {
  version: 2;
  sessions: StoredSessionIndexEntry[];
};
type StoredSessionPayload = {
  messages: ChatSession['messages'];
};

const memoryStore = new Map<AppStorageKey, string>();
const payloadMemoryStore = new Map<string, string>();
let sessionsCache: ChatSession[] | null = null;
const SESSION_PAYLOAD_KEY_PREFIX = 'achatx_session_payload_';

const storageGetItem = (key: AppStorageKey): string | null => {
  const storageValue = readAppStorage(key);
  if (storageValue !== null) {
    memoryStore.set(key, storageValue);
    return storageValue;
  }
  return memoryStore.get(key) ?? null;
};

const storageSetItem = (key: AppStorageKey, value: string): void => {
  writeAppStorage(key, value);
  memoryStore.set(key, value);
};

const storageRemoveItem = (key: AppStorageKey): void => {
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

const getSessionPayloadStorageKey = (sessionId: string): string =>
  `${SESSION_PAYLOAD_KEY_PREFIX}${sessionId}`;

const readSessionPayloadRaw = (sessionId: string): string | null => {
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

const writeSessionPayloadRaw = (sessionId: string, value: string): void => {
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

const removeSessionPayloadRaw = (sessionId: string): void => {
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

const cleanupOrphanSessionPayloads = (activeSessionIds: Set<string>): void => {
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

const loadSessionPayload = (sessionId: string): ChatSession['messages'] => {
  try {
    const raw = readSessionPayloadRaw(sessionId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSessionPayload;
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    return messages.map((message) => ({
      ...message,
      timeLabel: message.timeLabel ?? formatMessageTime(message.timestamp),
    }));
  } catch {
    return [];
  }
};

const normalizeSession = (session: StoredSession): ChatSession => {
  return {
    ...session,
    provider: session.provider ?? DEFAULT_PROVIDER_ID,
    model: session.model ?? DEFAULT_MODEL_NAME,
    messages: (session.messages ?? []).map((message) => ({
      ...message,
      timeLabel: message.timeLabel ?? formatMessageTime(message.timestamp),
    })),
  };
};

const cloneSessions = (sessions: ChatSession[]): ChatSession[] =>
  sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  }));

const toSessionIndex = (sessions: ChatSession[]): StoredSessionIndexV2 => ({
  version: 2,
  sessions: sessions.map((session) => ({
    id: session.id,
    title: session.title,
    provider: session.provider,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  })),
});

const isStoredSessionIndexV2 = (value: unknown): value is StoredSessionIndexV2 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSessionIndexV2>;
  return candidate.version === 2 && Array.isArray(candidate.sessions);
};

const loadSessionsFromStorage = (): ChatSession[] => {
  try {
    const stored = storageGetItem(SESSIONS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) {
      // Legacy format: full sessions are stored in one large array.
      return (parsed as StoredSession[]).map((session) => normalizeSession(session));
    }
    if (!isStoredSessionIndexV2(parsed)) {
      return [];
    }

    const sessions = parsed.sessions.map((entry) =>
      normalizeSession({
        ...entry,
        messages: loadSessionPayload(entry.id),
      })
    );
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions;
  } catch (error) {
    console.error('Failed to load sessions from storage:', error);
    return [];
  }
};

const getCachedSessions = (): ChatSession[] => {
  if (!sessionsCache) {
    sessionsCache = loadSessionsFromStorage();
  }
  return sessionsCache;
};

const persistSessions = (
  sessions: ChatSession[],
  options?: { changedSessionIds?: string[]; removedSessionIds?: string[] }
): void => {
  const { changedSessionIds, removedSessionIds } = options ?? {};
  const sessionsById = new Map(sessions.map((session) => [session.id, session] as const));

  // Migration safety: if any session payload is missing, force a full payload write
  // before overwriting the new v2 index to avoid message loss after restart.
  const shouldForceFullPersist = sessions.some((session) => readSessionPayloadRaw(session.id) === null);
  const candidateIds = shouldForceFullPersist
    ? sessions.map((session) => session.id)
    : changedSessionIds ?? sessions.map((session) => session.id);
  const idsToPersist = Array.from(new Set(candidateIds));

  for (const sessionId of idsToPersist) {
    const session = sessionsById.get(sessionId);
    if (!session) continue;
    writeSessionPayloadRaw(
      sessionId,
      JSON.stringify({
        messages: session.messages,
      } as StoredSessionPayload)
    );
  }
  for (const removedId of removedSessionIds ?? []) {
    removeSessionPayloadRaw(removedId);
  }
  cleanupOrphanSessionPayloads(new Set(sessions.map((session) => session.id)));

  storageSetItem(SESSIONS_STORAGE_KEY, JSON.stringify(toSessionIndex(sessions)));
  sessionsCache = sessions;
};

export const getSessions = (): ChatSession[] => {
  return cloneSessions(getCachedSessions());
};

export const getActiveSessionId = (): string | null => {
  try {
    return storageGetItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load active session id:', error);
    return null;
  }
};

export const setActiveSessionId = (sessionId: string): void => {
  try {
    storageSetItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  } catch (error) {
    console.error('Failed to persist active session id:', error);
  }
};

export const clearActiveSessionId = (): void => {
  try {
    storageRemoveItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear active session id:', error);
  }
};

export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = [...getCachedSessions()];
    const normalized = normalizeSession(session);
    const index = sessions.findIndex((s) => s.id === normalized.id);

    if (index >= 0) {
      sessions[index] = normalized;
    } else {
      sessions.unshift(normalized);
    }

    // Sort by updated at desc
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    persistSessions(sessions, { changedSessionIds: [normalized.id] });
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

export const updateSessionTitle = (sessionId: string, newTitle: string): ChatSession[] => {
  try {
    const sessions = [...getCachedSessions()];
    const index = sessions.findIndex((s) => s.id === sessionId);

    if (index >= 0) {
      sessions[index] = { ...sessions[index], title: newTitle };
      // We do not update 'updatedAt' here to prevent the session from jumping to the top of the list just for a rename
      persistSessions(sessions);
      return cloneSessions(sessions);
    }
    return cloneSessions(sessions);
  } catch (error) {
    console.error('Failed to update session title:', error);
    return [];
  }
};

export const deleteSession = (sessionId: string): ChatSession[] => {
  try {
    const sessions = getCachedSessions().filter((s) => s.id !== sessionId);
    persistSessions(sessions, { removedSessionIds: [sessionId] });
    return cloneSessions(sessions);
  } catch (error) {
    console.error('Failed to delete session:', error);
    return [];
  }
};
