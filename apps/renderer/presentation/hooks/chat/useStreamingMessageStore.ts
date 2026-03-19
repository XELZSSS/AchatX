import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { formatMessageTime } from '@/shared/utils/time';
import { ChatMessage, Role } from '@/shared/types/chat';
import {
  areValuesShallowEqual,
  type CachedMessageIndex,
  type MessageOverrides,
} from '@/presentation/hooks/chat/streamingMessageHelpers';

type UseStreamingMessageStoreOptions = {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  performScrollToBottom: (behavior?: ScrollBehavior) => void;
  autoScrollEnabledRef: MutableRefObject<boolean>;
  isNearBottomRef: MutableRefObject<boolean>;
};

export const useStreamingMessageStore = ({
  setMessages,
  messagesRef,
  performScrollToBottom,
  autoScrollEnabledRef,
  isNearBottomRef,
}: UseStreamingMessageStoreOptions) => {
  const lastUpdatedMessageIndexRef = useRef<CachedMessageIndex | null>(null);

  const commitMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const next = updater(messagesRef.current);
      messagesRef.current = next;
      setMessages(next);
    },
    [messagesRef, setMessages]
  );

  const updateMessageById = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      commitMessages((prev) => {
        const cached = lastUpdatedMessageIndexRef.current;
        const cachedIndex =
          cached?.id === messageId && prev[cached.index]?.id === messageId ? cached.index : -1;
        const index =
          cachedIndex >= 0 ? cachedIndex : prev.findIndex((message) => message.id === messageId);

        if (cachedIndex < 0 && index >= 0) {
          lastUpdatedMessageIndexRef.current = { id: messageId, index };
        }
        if (index === -1) {
          return prev;
        }

        const current = prev[index];
        const nextMessage = { ...current, ...updates };
        if (
          nextMessage.text === current.text &&
          nextMessage.reasoning === current.reasoning &&
          nextMessage.isError === current.isError &&
          areValuesShallowEqual(nextMessage.toolCalls ?? null, current.toolCalls ?? null) &&
          areValuesShallowEqual(nextMessage.toolResults ?? null, current.toolResults ?? null) &&
          areValuesShallowEqual(nextMessage.citations ?? null, current.citations ?? null)
        ) {
          return prev;
        }

        const next = [...prev];
        next[index] = nextMessage;
        return next;
      });
    },
    [commitMessages]
  );

  const removeMessageById = useCallback(
    (messageId: string) => {
      commitMessages((prev) => prev.filter((message) => message.id !== messageId));
      if (lastUpdatedMessageIndexRef.current?.id === messageId) {
        lastUpdatedMessageIndexRef.current = null;
      }
    },
    [commitMessages]
  );

  const buildMessage = useCallback(
    (role: Role, text: string, overrides: MessageOverrides = {}): ChatMessage => {
      const { id, timestamp, timeLabel, ...rest } = overrides;
      const resolvedTimestamp = timestamp ?? Date.now();
      return {
        id: id ?? uuidv4(),
        role,
        text,
        timestamp: resolvedTimestamp,
        timeLabel: timeLabel ?? formatMessageTime(resolvedTimestamp),
        ...rest,
      };
    },
    []
  );

  const startPendingModelResponse = useCallback(
    (prompt: string): string => {
      const modelMessageId = uuidv4();
      const userMessage = buildMessage(Role.User, prompt);
      const modelMessage = buildMessage(Role.Model, '', { id: modelMessageId });

      commitMessages((prev) => {
        const modelMessageIndex = prev.length + 1;
        lastUpdatedMessageIndexRef.current = { id: modelMessageId, index: modelMessageIndex };
        return [...prev, userMessage, modelMessage];
      });

      const shouldAutoScroll = isNearBottomRef.current;
      autoScrollEnabledRef.current = shouldAutoScroll;
      if (shouldAutoScroll) {
        performScrollToBottom('auto');
      }

      return modelMessageId;
    },
    [autoScrollEnabledRef, buildMessage, commitMessages, isNearBottomRef, performScrollToBottom]
  );

  const upsertModelErrorMessage = useCallback(
    (modelMessageId: string, finalMessageText: string) => {
      const fallbackErrorMessage = buildMessage(Role.Model, finalMessageText, { isError: true });
      commitMessages((prev) => {
        const cached = lastUpdatedMessageIndexRef.current;
        const cachedIndex =
          cached?.id === modelMessageId && prev[cached.index]?.id === modelMessageId
            ? cached.index
            : -1;
        const index =
          cachedIndex >= 0 ? cachedIndex : prev.findIndex((message) => message.id === modelMessageId);

        if (index === -1) {
          return [...prev, fallbackErrorMessage];
        }

        lastUpdatedMessageIndexRef.current = { id: modelMessageId, index };
        const next = [...prev];
        next[index] = {
          ...next[index],
          text: finalMessageText,
          reasoning: undefined,
          isError: true,
        };
        return next;
      });
    },
    [buildMessage, commitMessages]
  );

  return {
    updateMessageById,
    removeMessageById,
    startPendingModelResponse,
    upsertModelErrorMessage,
  };
};
