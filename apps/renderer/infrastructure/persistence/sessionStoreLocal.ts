import { ChatSession } from '@/shared/types/chat';
import {
  cloneSessions,
  isStoredSessionIndex,
  loadStoredSessionPayloadFromRaw,
  normalizeSession,
  toSessionIndex,
  type StoredSessionPayload,
} from '@/infrastructure/persistence/sessionStoreSerialization';
import {
  cleanupOrphanSessionPayloads,
  getCachedSessionsValue,
  readSessionPayloadRaw,
  removeSessionPayloadRaw,
  setCachedSessionsValue,
  storageGetItem,
  storageRemoveItem,
  storageSetItem,
  writeSessionPayloadRaw,
} from '@/infrastructure/persistence/sessionStoreStorage';

const SESSIONS_STORAGE_KEY = 'sessions';
const ACTIVE_SESSION_STORAGE_KEY = 'activeSessionId';

const loadSessionsFromStorage = (): ChatSession[] => {
  try {
    const stored = storageGetItem(SESSIONS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (!isStoredSessionIndex(parsed)) {
      return [];
    }

    const sessions = parsed.sessions.map((entry) =>
      normalizeSession(
        (() => {
          const payload = loadStoredSessionPayloadFromRaw(readSessionPayloadRaw(entry.id));
          return {
            ...entry,
            messages: payload.messages,
          };
        })()
      )
    );
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions;
  } catch (error) {
    console.error('Failed to load sessions from local storage:', error);
    return [];
  }
};

const getCachedSessions = (): ChatSession[] => {
  const cachedSessions = getCachedSessionsValue();
  if (!cachedSessions) {
    const loadedSessions = loadSessionsFromStorage();
    setCachedSessionsValue(loadedSessions);
    return loadedSessions;
  }
  return cachedSessions;
};

const persistSessions = (
  sessions: ChatSession[],
  options?: { changedSessionIds?: string[]; removedSessionIds?: string[] }
): void => {
  const { changedSessionIds, removedSessionIds } = options ?? {};
  const sessionsById = new Map(sessions.map((session) => [session.id, session] as const));

  const shouldForceFullPersist = sessions.some(
    (session) => readSessionPayloadRaw(session.id) === null
  );
  const candidateIds = shouldForceFullPersist
    ? sessions.map((session) => session.id)
    : (changedSessionIds ?? sessions.map((session) => session.id));
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
  setCachedSessionsValue(sessions);
};

export const getSessions = (): ChatSession[] => {
  return cloneSessions(getCachedSessions());
};

export const getSessionSummaries = (): ChatSession[] => {
  return cloneSessions(
    getCachedSessions().map((session) => ({
      ...session,
      messages: [],
    }))
  );
};

export const getSession = (sessionId: string): ChatSession | null => {
  const session = getCachedSessions().find((item) => item.id === sessionId);
  return session ? cloneSessions([session])[0] : null;
};

export const getActiveSessionId = (): string | null => {
  try {
    return storageGetItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load active session id from local storage:', error);
    return null;
  }
};

export const setActiveSessionId = (sessionId: string): void => {
  try {
    storageSetItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  } catch (error) {
    console.error('Failed to persist active session id to local storage:', error);
  }
};

export const clearActiveSessionId = (): void => {
  try {
    storageRemoveItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear active session id from local storage:', error);
  }
};

export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = [...getCachedSessions()];
    const normalized = normalizeSession(session);
    const index = sessions.findIndex((item) => item.id === normalized.id);

    if (index >= 0) {
      sessions[index] = normalized;
    } else {
      sessions.unshift(normalized);
    }

    sessions.sort((left, right) => right.updatedAt - left.updatedAt);

    persistSessions(sessions, { changedSessionIds: [normalized.id] });
  } catch (error) {
    console.error('Failed to save session to local storage:', error);
  }
};

export const updateSessionTitle = (sessionId: string, newTitle: string): ChatSession[] => {
  try {
    const sessions = [...getCachedSessions()];
    const index = sessions.findIndex((session) => session.id === sessionId);

    if (index >= 0) {
      sessions[index] = { ...sessions[index], title: newTitle };
      persistSessions(sessions, { changedSessionIds: [] });
      return cloneSessions(sessions);
    }

    return cloneSessions(sessions);
  } catch (error) {
    console.error('Failed to update session title in local storage:', error);
    return [];
  }
};

export const searchSessionSummaries = (query: string, limit = 200): ChatSession[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const maxLimit = Math.max(1, Math.min(500, Math.round(limit) || 200));

  if (!normalizedQuery) {
    return getSessionSummaries().slice(0, maxLimit);
  }

  const matches = getCachedSessions().filter((session) => {
    if (session.title.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return session.messages.some((message) => message.text.toLowerCase().includes(normalizedQuery));
  });

  return cloneSessions(
    matches.slice(0, maxLimit).map((session) => ({
      ...session,
      messages: [],
    }))
  );
};

export const deleteSession = (sessionId: string): ChatSession[] => {
  try {
    const sessions = getCachedSessions().filter((session) => session.id !== sessionId);
    persistSessions(sessions, { changedSessionIds: [], removedSessionIds: [sessionId] });
    return cloneSessions(sessions);
  } catch (error) {
    console.error('Failed to delete session from local storage:', error);
    return [];
  }
};
