import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatService } from '@/application/chat/chatService';
import { ChatMessage, ChatSession, Role } from '@/shared/types/chat';
import { isDefaultSessionTitle } from '@/shared/utils/i18n';

export type SessionContextActions = {
  setCurrentSessionId: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  syncConversationState: () => void;
};

export const SAVE_SESSION_DEBOUNCE_MS = 400;
export const SESSION_DEBUG_PREFIX = '[session-debug]';

export const toSessionSummary = (session: ChatSession): ChatSession => ({
  ...session,
  messages: [],
});

const resolveSessionTitle = (
  existingSessionTitle: string | undefined,
  messages: ChatMessage[],
  defaultSessionTitle: string
) => {
  const firstUserMessage = messages.find((message) => message.role === Role.User);
  if (!firstUserMessage) {
    return existingSessionTitle ?? defaultSessionTitle;
  }

  if (!existingSessionTitle || isDefaultSessionTitle(existingSessionTitle)) {
    return firstUserMessage.text.trim() || defaultSessionTitle;
  }

  return existingSessionTitle;
};

export const buildSessionSnapshot = ({
  currentSessionId,
  existingSessionTitle,
  existingSessionCreatedAt,
  messages,
  defaultSessionTitle,
  providerId,
  modelName,
}: {
  currentSessionId: string;
  existingSessionTitle?: string;
  existingSessionCreatedAt?: number;
  messages: ChatMessage[];
  defaultSessionTitle: string;
  providerId: ChatSession['provider'];
  modelName: string;
}): ChatSession => ({
  id: currentSessionId,
  title: resolveSessionTitle(existingSessionTitle, messages, defaultSessionTitle),
  messages,
  provider: providerId,
  model: modelName,
  createdAt: existingSessionCreatedAt ?? Date.now(),
  updatedAt: Date.now(),
});

export const upsertSessionList = (sessions: ChatSession[], session: ChatSession): ChatSession[] => {
  const summary = toSessionSummary(session);
  const next = [summary, ...sessions.filter((item) => item.id !== summary.id)];
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  return next;
};

export const hasSessionSummaryChanged = (
  prev: ChatSession | undefined,
  next: ChatSession
): boolean => {
  if (!prev) return true;
  return (
    prev.title !== next.title ||
    prev.provider !== next.provider ||
    prev.model !== next.model ||
    prev.updatedAt !== next.updatedAt
  );
};

export const hasSessionSnapshotChanged = (
  prev: ChatSession | undefined,
  next: ChatSession
): boolean => {
  if (!prev) return true;
  return (
    prev.title !== next.title ||
    prev.provider !== next.provider ||
    prev.model !== next.model ||
    prev.messages !== next.messages
  );
};

export const pickFallbackSessionSummary = (
  previousSessions: ChatSession[],
  nextSessions: ChatSession[],
  deletedSessionId: string
): ChatSession | undefined => {
  const deletedIndex = previousSessions.findIndex((session) => session.id === deletedSessionId);
  if (deletedIndex === -1) {
    return nextSessions[0];
  }
  return nextSessions[deletedIndex] ?? nextSessions[deletedIndex - 1] ?? nextSessions[0];
};

const applySessionContext = async (
  chatService: ChatService,
  session: ChatSession,
  actions: SessionContextActions,
  activationToken: number,
  latestActivationTokenRef: MutableRefObject<number>
): Promise<void> => {
  const { setCurrentSessionId, setMessages, syncConversationState } = actions;
  setCurrentSessionId(session.id);
  setMessages(session.messages);
  chatService.activateConversationContext({
    providerId: session.provider,
    modelName: session.model,
  });
  syncConversationState();
  await chatService.restoreChatWithHistory(session.messages);
  if (latestActivationTokenRef.current !== activationToken) return;
  setCurrentSessionId(session.id);
};

export const activateSession = (
  chatService: ChatService,
  session: ChatSession,
  actions: SessionContextActions,
  latestActivationTokenRef: MutableRefObject<number>
): void => {
  const activationToken = latestActivationTokenRef.current + 1;
  latestActivationTokenRef.current = activationToken;
  void applySessionContext(
    chatService,
    session,
    actions,
    activationToken,
    latestActivationTokenRef
  ).catch((error) => {
    if (latestActivationTokenRef.current !== activationToken) return;
    console.error('Failed to sync session history:', error);
  });
};

export const consumePendingSessionSave = (
  saveSessionTimerRef: MutableRefObject<number | null>,
  pendingSessionSaveRef: MutableRefObject<ChatSession | null>
): ChatSession | null => {
  if (saveSessionTimerRef.current !== null) {
    window.clearTimeout(saveSessionTimerRef.current);
    saveSessionTimerRef.current = null;
  }
  const pendingSession = pendingSessionSaveRef.current;
  pendingSessionSaveRef.current = null;
  return pendingSession;
};

export const discardPendingSessionSave = (
  saveSessionTimerRef: MutableRefObject<number | null>,
  pendingSessionSaveRef: MutableRefObject<ChatSession | null>,
  sessionId?: string
): void => {
  if (sessionId && pendingSessionSaveRef.current?.id !== sessionId) return;
  if (saveSessionTimerRef.current !== null) {
    window.clearTimeout(saveSessionTimerRef.current);
    saveSessionTimerRef.current = null;
  }
  pendingSessionSaveRef.current = null;
};
