import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatService } from '@/application/chat/chatService';
import type { ChatMessage, ChatSession } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import {
  buildSessionSnapshot,
  hasSessionSnapshotChanged,
  hasSessionSummaryChanged,
  type SessionContextActions,
  upsertSessionList,
} from '@/presentation/hooks/session/sessionHelpers';
import { useInitializeSessionState } from '@/presentation/hooks/session/useInitializeSessionState';
import { useSessionActions } from '@/presentation/hooks/session/useSessionActions';
import { useSessionPersistence } from '@/presentation/hooks/session/useSessionPersistence';
import { useSessionSearch } from '@/presentation/hooks/session/useSessionSearch';
import { useSessionTitleEditing } from '@/presentation/hooks/session/useSessionTitleEditing';

type UseChatSessionsOptions = {
  chatService: ChatService;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  defaultSessionTitle: string;
  syncProviderState: () => void;
  isStreaming: boolean;
  isLoading: boolean;
  onCloseSidebar?: () => void;
};

type CommitSessionOptions = { force?: boolean };

export const useChatSessions = ({
  chatService,
  messages,
  setMessages,
  defaultSessionTitle,
  syncProviderState,
  isStreaming,
  isLoading,
  onCloseSidebar,
}: UseChatSessionsOptions) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => uuidv4());
  const [isSessionStateReady, setIsSessionStateReady] = useState(false);
  const latestActivationTokenRef = useRef(0);

  const sessionContextActions = useMemo<SessionContextActions>(
    () => ({
      setCurrentSessionId,
      setMessages,
      syncProviderState,
    }),
    [setMessages, syncProviderState]
  );

  const {
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
  } = useSessionPersistence({ setSessions });

  const {
    editingSessionId,
    editTitleInput,
    setEditTitleInput,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditInputClick,
    handleEditKeyDown,
    resetEditState,
  } = useSessionTitleEditing({ setSessions });

  const closeSidebar = useCallback(() => {
    onCloseSidebar?.();
  }, [onCloseSidebar]);

  useInitializeSessionState({
    chatService,
    setSessions,
    setCurrentSessionId,
    setIsSessionStateReady,
    clearSessionNotice,
    showSessionNotice,
    sessionContextActions,
    latestActivationTokenRef,
    lastPersistedSessionRef,
  });

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [currentSessionId, sessions]
  );

  const activeProviderId = chatService.getProviderId();
  const activeModelName = chatService.getModelName();

  const activeSessionDraft = useMemo(() => {
    if (messages.length === 0) return null;

    return buildSessionSnapshot({
      currentSessionId,
      existingSessionTitle: currentSession?.title,
      existingSessionCreatedAt: currentSession?.createdAt,
      messages,
      defaultSessionTitle,
      providerId: activeProviderId,
      modelName: activeModelName,
    });
  }, [
    activeModelName,
    activeProviderId,
    currentSession?.createdAt,
    currentSession?.title,
    currentSessionId,
    defaultSessionTitle,
    messages,
  ]);

  const sessionSummaries = useMemo(() => {
    if (!activeSessionDraft) {
      return sessions;
    }

    return hasSessionSummaryChanged(currentSession, activeSessionDraft)
      ? upsertSessionList(sessions, activeSessionDraft)
      : sessions;
  }, [activeSessionDraft, currentSession, sessions]);

  const { searchQuery, setSearchQuery, filteredSessions } = useSessionSearch({
    sessionSummaries,
  });

  const resetToDraftSession = useCallback(
    (nextSessionId: string) => {
      if (saveSessionTimerRef.current !== null) {
        window.clearTimeout(saveSessionTimerRef.current);
        saveSessionTimerRef.current = null;
      }

      pendingSessionSaveRef.current = null;
      lastPersistedSessionRef.current = null;
      chatService.resetChat();
      setMessages([]);
      setCurrentSessionId(nextSessionId);
      setSearchQuery('');
      closeSidebar();
    },
    [
      chatService,
      closeSidebar,
      lastPersistedSessionRef,
      pendingSessionSaveRef,
      saveSessionTimerRef,
      setMessages,
      setSearchQuery,
    ]
  );

  useEffect(() => {
    if (!activeSessionDraft || deletedSessionIdsRef.current.has(activeSessionDraft.id)) {
      return;
    }

    pendingSessionSaveRef.current = activeSessionDraft;
    if (isStreaming || isLoading) {
      return;
    }

    if (!hasSessionSnapshotChanged(lastPersistedSessionRef.current ?? undefined, activeSessionDraft)) {
      return;
    }

    scheduleSessionSave(activeSessionDraft);
  }, [
    activeSessionDraft,
    deletedSessionIdsRef,
    isLoading,
    isStreaming,
    lastPersistedSessionRef,
    pendingSessionSaveRef,
    scheduleSessionSave,
  ]);

  const { startNewChat, handleLoadSession, handleDeleteSession } = useSessionActions({
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
  });

  const commitCurrentSession = useCallback(
    (options: CommitSessionOptions = {}) => {
      const { force = false } = options;
      const draft = pendingSessionSaveRef.current ?? activeSessionDraft;
      if (!draft) {
        return;
      }

      if (!force && !hasSessionSnapshotChanged(lastPersistedSessionRef.current ?? undefined, draft)) {
        return;
      }

      void persistSessionSnapshot(draft);
      pendingSessionSaveRef.current = null;
      if (saveSessionTimerRef.current !== null) {
        window.clearTimeout(saveSessionTimerRef.current);
        saveSessionTimerRef.current = null;
      }
    },
    [activeSessionDraft, lastPersistedSessionRef, pendingSessionSaveRef, persistSessionSnapshot, saveSessionTimerRef]
  );

  const sessionActionsDisabled = isStreaming || isLoading;
  const sessionActionsDisabledReason = sessionActionsDisabled ? t('sidebar.busyActionHint') : null;

  return {
    sessions: sessionSummaries,
    filteredSessions,
    currentSessionId,
    searchQuery,
    editingSessionId,
    editTitleInput,
    setSearchQuery,
    setEditTitleInput,
    startNewChat,
    handleLoadSession,
    handleDeleteSession,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditInputClick,
    handleEditKeyDown,
    isSessionStateReady,
    commitCurrentSession,
    sessionActionsDisabled,
    sessionActionsDisabledReason,
    sessionNotice,
  };
};
