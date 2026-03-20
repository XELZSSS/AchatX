import { ChatSession } from '@/shared/types/chat';
import {
  cloneSessions,
  normalizeSession,
} from '@/infrastructure/persistence/sessionStoreSerialization';
import * as localSessionStore from '@/infrastructure/persistence/sessionStoreLocal';

type NativeSessionStorage = NonNullable<Window['axchat']>;

const getNativeSessionStorage = (): NativeSessionStorage | null => {
  return typeof window !== 'undefined' && window.axchat?.listStoredSessions ? window.axchat : null;
};

const withSessionStorage = async <T>(
  nativeOperation: (storage: NativeSessionStorage) => Promise<T>,
  fallbackOperation: () => T | Promise<T>
): Promise<T> => {
  const nativeSessionStorage = getNativeSessionStorage();
  return nativeSessionStorage ? nativeOperation(nativeSessionStorage) : fallbackOperation();
};

const normalizeSessions = (sessions: ChatSession[]): ChatSession[] => {
  return cloneSessions(sessions.map((session) => normalizeSession(session)));
};

const listNativeSessions = async (
  nativeSessionStorage: NativeSessionStorage,
  options?: { limit?: number }
): Promise<ChatSession[]> => {
  const payload = options?.limit ? { limit: options.limit } : undefined;
  return normalizeSessions(await nativeSessionStorage.listStoredSessions(payload));
};

export const getSessionSummaries = async (limit?: number): Promise<ChatSession[]> => {
  return withSessionStorage(
    async (nativeSessionStorage) => listNativeSessions(nativeSessionStorage, { limit }),
    () => localSessionStore.getSessionSummaries()
  );
};

export const getSession = async (sessionId: string): Promise<ChatSession | null> => {
  return withSessionStorage(
    async (nativeSessionStorage) => {
      const session = await nativeSessionStorage.getStoredSession(sessionId);
      return session ? normalizeSession(session) : null;
    },
    () => localSessionStore.getSession(sessionId)
  );
};

export const getActiveSessionId = async (): Promise<string | null> => {
  return withSessionStorage(
    async (nativeSessionStorage) => nativeSessionStorage.getStoredActiveSessionId(),
    () => localSessionStore.getActiveSessionId()
  );
};

export const setActiveSessionId = async (sessionId: string): Promise<void> => {
  await withSessionStorage(
    (nativeSessionStorage) => nativeSessionStorage.setStoredActiveSessionId(sessionId),
    () => localSessionStore.setActiveSessionId(sessionId)
  );
};

export const clearActiveSessionId = async (): Promise<void> => {
  await withSessionStorage(
    (nativeSessionStorage) => nativeSessionStorage.clearStoredActiveSessionId(),
    () => localSessionStore.clearActiveSessionId()
  );
};

export const saveSession = async (session: ChatSession): Promise<void> => {
  await withSessionStorage(
    (nativeSessionStorage) => nativeSessionStorage.saveStoredSession(session),
    () => localSessionStore.saveSession(session)
  );
};

export const updateSessionTitle = async (
  sessionId: string,
  newTitle: string
): Promise<ChatSession[]> => {
  return withSessionStorage(
    async (nativeSessionStorage) => {
      await nativeSessionStorage.renameStoredSession({ sessionId, title: newTitle });
      return getSessionSummaries();
    },
    () => localSessionStore.updateSessionTitle(sessionId, newTitle)
  );
};

export const deleteSession = async (sessionId: string): Promise<ChatSession[]> => {
  return withSessionStorage(
    async (nativeSessionStorage) => {
      await nativeSessionStorage.deleteStoredSession(sessionId);
      return getSessionSummaries();
    },
    () => localSessionStore.deleteSession(sessionId)
  );
};

export const searchSessionSummaries = async (
  query: string,
  limit = 200
): Promise<ChatSession[]> => {
  return withSessionStorage(
    async (nativeSessionStorage) => {
      const sessions = await nativeSessionStorage.searchStoredSessions({ query, limit });
      return normalizeSessions(sessions);
    },
    () => localSessionStore.searchSessionSummaries(query, limit)
  );
};
