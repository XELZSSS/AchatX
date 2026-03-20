import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatService } from '@/application/chat/chatService';
import type { ChatSession } from '@/shared/types/chat';
import {
  getActiveSessionId,
  getSession,
  getSessionSummaries,
  setActiveSessionId,
} from '@/infrastructure/persistence/sessionStore';
import { t } from '@/shared/utils/i18n';
import {
  SESSION_DEBUG_PREFIX,
  activateSession,
  type SessionContextActions,
} from '@/presentation/hooks/session/sessionHelpers';

type UseInitializeSessionStateOptions = {
  chatService: ChatService;
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setCurrentSessionId: Dispatch<SetStateAction<string>>;
  setIsSessionStateReady: Dispatch<SetStateAction<boolean>>;
  clearSessionNotice: () => void;
  showSessionNotice: (message: string) => void;
  sessionContextActions: SessionContextActions;
  latestActivationTokenRef: MutableRefObject<number>;
  lastPersistedSessionRef: MutableRefObject<ChatSession | null>;
};

export const useInitializeSessionState = ({
  chatService,
  setSessions,
  setCurrentSessionId,
  setIsSessionStateReady,
  clearSessionNotice,
  showSessionNotice,
  sessionContextActions,
  latestActivationTokenRef,
  lastPersistedSessionRef,
}: UseInitializeSessionStateOptions) => {
  useEffect(() => {
    let disposed = false;

    const loadSessionState = async () => {
      try {
        let loadedSessions = await getSessionSummaries(200);
        const activeId = await getActiveSessionId();
        if (disposed) {
          return;
        }

        setSessions(loadedSessions);

        const matchedActiveSessionSummary = activeId
          ? loadedSessions.find((session) => session.id === activeId)
          : undefined;
        let activeSessionSummary = matchedActiveSessionSummary ?? loadedSessions[0];

        while (activeSessionSummary) {
          const activeSession = await getSession(activeSessionSummary.id);
          if (disposed) {
            return;
          }

          if (activeSession) {
            if (activeId !== activeSession.id) {
              await setActiveSessionId(activeSession.id);
              if (disposed) {
                return;
              }
            }
            lastPersistedSessionRef.current = activeSession;
            activateSession(
              chatService,
              activeSession,
              sessionContextActions,
              latestActivationTokenRef
            );
            if (!disposed) {
              clearSessionNotice();
              setIsSessionStateReady(true);
            }
            return;
          }

          loadedSessions = loadedSessions.filter(
            (session) => session.id !== activeSessionSummary.id
          );
          setSessions(loadedSessions);
          activeSessionSummary = loadedSessions[0];
        }

        if (!activeSessionSummary) {
          const newId = uuidv4();
          console.warn(`${SESSION_DEBUG_PREFIX} initialized empty session id`, {
            sessionId: newId,
          });
          chatService.activateDefaultConversationContext();
          sessionContextActions.syncConversationState();
          setCurrentSessionId(newId);
          await setActiveSessionId(newId);
          if (!disposed) {
            clearSessionNotice();
            setIsSessionStateReady(true);
          }
        }
      } catch (error) {
        console.error('Failed to initialize session state:', error);
        if (!disposed) {
          showSessionNotice(t('session.error.init'));
          setIsSessionStateReady(true);
        }
      }
    };

    void loadSessionState();

    return () => {
      disposed = true;
    };
  }, [
    chatService,
    clearSessionNotice,
    lastPersistedSessionRef,
    latestActivationTokenRef,
    sessionContextActions,
    setCurrentSessionId,
    setIsSessionStateReady,
    setSessions,
    showSessionNotice,
  ]);
};
