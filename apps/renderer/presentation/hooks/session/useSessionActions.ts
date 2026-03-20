import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatService } from '@/application/chat/chatService';
import type { ChatSession } from '@/shared/types/chat';
import {
  deleteSession,
  getSession,
  getSessionSummaries,
  setActiveSessionId,
} from '@/infrastructure/persistence/sessionStore';
import { t } from '@/shared/utils/i18n';
import {
  SESSION_DEBUG_PREFIX,
  activateSession,
  pickFallbackSessionSummary,
  type SessionContextActions,
} from '@/presentation/hooks/session/sessionHelpers';

type UseSessionActionsOptions = {
  chatService: ChatService;
  currentSessionId: string;
  editingSessionId: string | null;
  isStreaming: boolean;
  isLoading: boolean;
  sessionSummaries: ChatSession[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  resetToDraftSession: (nextSessionId: string) => void;
  resetEditState: () => void;
  closeSidebar: () => void;
  flushSessionSave: () => Promise<void>;
  discardSessionSave: (sessionId?: string) => void;
  drainSaveQueue: () => Promise<void>;
  clearSessionNotice: () => void;
  showSessionNotice: (message: string) => void;
  sessionContextActions: SessionContextActions;
  latestActivationTokenRef: MutableRefObject<number>;
  lastPersistedSessionRef: MutableRefObject<ChatSession | null>;
  deletedSessionIdsRef: MutableRefObject<Set<string>>;
};

export const useSessionActions = ({
  chatService,
  currentSessionId,
  editingSessionId,
  isStreaming,
  isLoading,
  sessionSummaries,
  setSessions,
  resetToDraftSession,
  resetEditState,
  closeSidebar,
  flushSessionSave,
  discardSessionSave,
  drainSaveQueue,
  clearSessionNotice,
  showSessionNotice,
  sessionContextActions,
  latestActivationTokenRef,
  lastPersistedSessionRef,
  deletedSessionIdsRef,
}: UseSessionActionsOptions) => {
  const startNewChat = useCallback(() => {
    void (async () => {
      try {
        await flushSessionSave();
        const newId = uuidv4();
        console.warn(`${SESSION_DEBUG_PREFIX} generated new session id`, { sessionId: newId });
        chatService.activateDefaultConversationContext();
        sessionContextActions.syncConversationState();
        resetToDraftSession(newId);
        await setActiveSessionId(newId);
        clearSessionNotice();
      } catch (error) {
        console.error('Failed to start a new chat session:', error);
        showSessionNotice(t('session.error.init'));
      }
    })();
  }, [
    chatService,
    clearSessionNotice,
    flushSessionSave,
    resetToDraftSession,
    sessionContextActions,
    showSessionNotice,
  ]);

  const handleLoadSession = useCallback(
    (session: ChatSession) => {
      void (async () => {
        try {
          if (isStreaming || isLoading) return;
          if (editingSessionId === session.id) return;

          if (session.id === currentSessionId) {
            closeSidebar();
            return;
          }

          await flushSessionSave();
          const loadedSession = await getSession(session.id);
          if (!loadedSession) {
            setSessions(await getSessionSummaries(200));
            showSessionNotice(t('session.error.missing'));
            return;
          }

          lastPersistedSessionRef.current = loadedSession;
          await setActiveSessionId(loadedSession.id);
          activateSession(
            chatService,
            loadedSession,
            sessionContextActions,
            latestActivationTokenRef
          );
          clearSessionNotice();
          closeSidebar();
        } catch (error) {
          console.error(`Failed to load session "${session.id}":`, error);
          showSessionNotice(t('session.error.load'));
        }
      })();
    },
    [
      chatService,
      clearSessionNotice,
      closeSidebar,
      currentSessionId,
      editingSessionId,
      flushSessionSave,
      isLoading,
      isStreaming,
      lastPersistedSessionRef,
      latestActivationTokenRef,
      sessionContextActions,
      setSessions,
      showSessionNotice,
    ]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      void (async () => {
        try {
          if (editingSessionId === sessionId) {
            resetEditState();
          }

          discardSessionSave(sessionId);
          deletedSessionIdsRef.current.add(sessionId);
          console.warn(`${SESSION_DEBUG_PREFIX} deleting session id`, {
            sessionId,
            isCurrentSession: sessionId === currentSessionId,
          });
          await drainSaveQueue();
          const updatedSessions = await deleteSession(sessionId);
          setSessions(updatedSessions);

          if (sessionId === currentSessionId) {
            const fallbackSummary = pickFallbackSessionSummary(
              sessionSummaries,
              updatedSessions,
              sessionId
            );
            if (fallbackSummary) {
              const fallbackSession = await getSession(fallbackSummary.id);
              if (fallbackSession) {
                lastPersistedSessionRef.current = fallbackSession;
                await setActiveSessionId(fallbackSession.id);
                activateSession(
                  chatService,
                  fallbackSession,
                  sessionContextActions,
                  latestActivationTokenRef
                );
                clearSessionNotice();
                closeSidebar();
                console.warn(`${SESSION_DEBUG_PREFIX} activated fallback session after delete`, {
                  deletedSessionId: sessionId,
                  replacementSessionId: fallbackSession.id,
                  remainingSessions: updatedSessions.length,
                });
                return;
              }

              showSessionNotice(t('session.error.missing'));
            }

            const nextSessionId = uuidv4();
            console.warn(`${SESSION_DEBUG_PREFIX} generated replacement session id after delete`, {
              deletedSessionId: sessionId,
              replacementSessionId: nextSessionId,
            });
            chatService.activateDefaultConversationContext();
            sessionContextActions.syncConversationState();
            resetToDraftSession(nextSessionId);
            await setActiveSessionId(nextSessionId);
            if (!fallbackSummary) {
              clearSessionNotice();
            }
            return;
          }

          clearSessionNotice();
          console.warn(`${SESSION_DEBUG_PREFIX} delete completed in renderer`, {
            deletedSessionId: sessionId,
            remainingSessions: updatedSessions.length,
          });
        } catch (error) {
          deletedSessionIdsRef.current.delete(sessionId);
          console.error(`Failed to delete session "${sessionId}":`, error);
          showSessionNotice(t('session.error.delete'));
        }
      })();
    },
    [
      chatService,
      clearSessionNotice,
      closeSidebar,
      currentSessionId,
      deletedSessionIdsRef,
      discardSessionSave,
      drainSaveQueue,
      editingSessionId,
      lastPersistedSessionRef,
      latestActivationTokenRef,
      resetEditState,
      resetToDraftSession,
      sessionContextActions,
      sessionSummaries,
      setSessions,
      showSessionNotice,
    ]
  );

  return {
    startNewChat,
    handleLoadSession,
    handleDeleteSession,
  };
};
