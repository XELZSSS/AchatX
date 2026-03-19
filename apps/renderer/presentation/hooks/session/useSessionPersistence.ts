import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatSession } from '@/shared/types/chat';
import { saveSession } from '@/infrastructure/persistence/sessionStore';
import { t } from '@/shared/utils/i18n';
import {
  SAVE_SESSION_DEBOUNCE_MS,
  consumePendingSessionSave,
  discardPendingSessionSave,
  hasSessionSummaryChanged,
  upsertSessionList,
} from '@/presentation/hooks/session/sessionHelpers';

type UseSessionPersistenceOptions = {
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
};

type UseSessionPersistenceResult = {
  sessionNotice: string | null;
  showSessionNotice: (message: string) => void;
  clearSessionNotice: () => void;
  persistSessionSnapshot: (session: ChatSession) => Promise<void>;
  scheduleSessionSave: (session: ChatSession) => void;
  flushSessionSave: () => Promise<void>;
  discardSessionSave: (sessionId?: string) => void;
  drainSaveQueue: () => Promise<void>;
  lastPersistedSessionRef: MutableRefObject<ChatSession | null>;
  pendingSessionSaveRef: MutableRefObject<ChatSession | null>;
  saveSessionTimerRef: MutableRefObject<number | null>;
  deletedSessionIdsRef: MutableRefObject<Set<string>>;
};

export const useSessionPersistence = ({
  setSessions,
}: UseSessionPersistenceOptions): UseSessionPersistenceResult => {
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const saveSessionTimerRef = useRef<number | null>(null);
  const sessionNoticeTimerRef = useRef<number | null>(null);
  const pendingSessionSaveRef = useRef<ChatSession | null>(null);
  const lastPersistedSessionRef = useRef<ChatSession | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const deletedSessionIdsRef = useRef<Set<string>>(new Set());

  const clearSessionNoticeTimer = useCallback(() => {
    if (sessionNoticeTimerRef.current !== null) {
      window.clearTimeout(sessionNoticeTimerRef.current);
      sessionNoticeTimerRef.current = null;
    }
  }, []);

  const showSessionNotice = useCallback(
    (message: string) => {
      setSessionNotice(message);
      clearSessionNoticeTimer();
      sessionNoticeTimerRef.current = window.setTimeout(() => {
        setSessionNotice(null);
        sessionNoticeTimerRef.current = null;
      }, 5000);
    },
    [clearSessionNoticeTimer]
  );

  const clearSessionNotice = useCallback(() => {
    clearSessionNoticeTimer();
    setSessionNotice(null);
  }, [clearSessionNoticeTimer]);

  const persistSessionSnapshot = useCallback(
    (session: ChatSession) => {
      const run = async () => {
        if (deletedSessionIdsRef.current.has(session.id)) {
          return;
        }

        setSessions((prevSessions) => {
          const existingSession = prevSessions.find((item) => item.id === session.id);
          return hasSessionSummaryChanged(existingSession, session)
            ? upsertSessionList(prevSessions, session)
            : prevSessions;
        });

        try {
          await saveSession(session);
          if (!deletedSessionIdsRef.current.has(session.id)) {
            lastPersistedSessionRef.current = session;
          }
        } catch (error) {
          console.error('Failed to persist session:', error);
          showSessionNotice(t('session.error.save'));
        }
      };

      const next = saveQueueRef.current.then(run, run);
      saveQueueRef.current = next;
      return next;
    },
    [setSessions, showSessionNotice]
  );

  const drainSaveQueue = useCallback(async () => {
    try {
      await saveQueueRef.current;
    } catch {
      // Errors are already reported by persistSessionSnapshot; draining only waits for completion.
    }
  }, []);

  const flushSessionSave = useCallback(async () => {
    const pendingSession = consumePendingSessionSave(saveSessionTimerRef, pendingSessionSaveRef);
    if (!pendingSession) {
      return;
    }

    await persistSessionSnapshot(pendingSession);
  }, [persistSessionSnapshot]);

  const discardSessionSave = useCallback((sessionId?: string) => {
    discardPendingSessionSave(saveSessionTimerRef, pendingSessionSaveRef, sessionId);
    if (sessionId && lastPersistedSessionRef.current?.id === sessionId) {
      lastPersistedSessionRef.current = null;
    }
  }, []);

  const flushSessionSaveOnPageExit = useEffectEvent(() => {
    void flushSessionSave();
  });

  useEffect(() => {
    return () => {
      clearSessionNoticeTimer();
    };
  }, [clearSessionNoticeTimer]);

  useEffect(() => {
    const handlePageHide = () => {
      flushSessionSaveOnPageExit();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSessionSaveOnPageExit();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushSessionSaveOnPageExit();
    };
  }, []);

  const scheduleSessionSave = useCallback(
    (session: ChatSession) => {
      pendingSessionSaveRef.current = session;

      if (saveSessionTimerRef.current !== null) {
        window.clearTimeout(saveSessionTimerRef.current);
      }

      saveSessionTimerRef.current = window.setTimeout(() => {
        const nextSession = pendingSessionSaveRef.current;
        pendingSessionSaveRef.current = null;

        if (nextSession) {
          void persistSessionSnapshot(nextSession);
        }
        saveSessionTimerRef.current = null;
      }, SAVE_SESSION_DEBOUNCE_MS);
    },
    [persistSessionSnapshot]
  );

  return {
    sessionNotice,
    showSessionNotice,
    clearSessionNotice,
    persistSessionSnapshot,
    scheduleSessionSave,
    flushSessionSave,
    discardSessionSave,
    drainSaveQueue,
    lastPersistedSessionRef,
    pendingSessionSaveRef,
    saveSessionTimerRef,
    deletedSessionIdsRef,
  };
};
