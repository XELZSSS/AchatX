import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/chatService';
import { ChatMessage, Role } from '../types';
import { t } from '../utils/i18n';
import {
  appendThinkStreamChunk,
  createThinkStreamParserState,
  finalizeThinkStreamParserState,
} from '../utils/streaming';
import { formatMessageTime } from '../utils/time';

type UseStreamingMessagesOptions = {
  chatService: ChatService;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};
type MessageOverrides = Omit<Partial<ChatMessage>, 'role' | 'text'>;

export const useStreamingMessages = ({
  chatService,
  messages,
  setMessages,
}: UseStreamingMessagesOptions) => {
  const STREAM_SCROLL_THROTTLE_MS = 80;
  const NEAR_BOTTOM_THRESHOLD_PX = 96;
  const FORCE_SCROLL_MAX_SETTLE_FRAMES = 120;
  const FORCE_SCROLL_STABLE_FRAMES = 3;
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
  const messagesRef = useRef(messages);
  const pendingAutoScrollBehaviorRef = useRef<ScrollBehavior | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const forceScrollFrameRef = useRef<number | null>(null);
  const pendingForceRequestFrameRef = useRef<number | null>(null);
  const lastAutoScrollAtRef = useRef(0);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const commitMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        return next;
      });
    },
    [setMessages]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth', force = false) => {
    const container = messagesContainerRef.current;
    if (!force && !messagesEndRef.current && container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      return;
    }

    if (force && container) {
      if (forceScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(forceScrollFrameRef.current);
        forceScrollFrameRef.current = null;
      }

      let stableFrames = 0;
      const scrollAndSettle = (remainingFrames: number) => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: remainingFrames === FORCE_SCROLL_MAX_SETTLE_FRAMES ? behavior : 'auto',
        });

        const distanceToBottom =
          container.scrollHeight - (container.scrollTop + container.clientHeight);
        if (distanceToBottom <= NEAR_BOTTOM_THRESHOLD_PX) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }

        if (remainingFrames <= 0 || stableFrames >= FORCE_SCROLL_STABLE_FRAMES) {
          isNearBottomRef.current = true;
          setShowScrollToBottom(false);
          forceScrollFrameRef.current = null;
          return;
        }
        forceScrollFrameRef.current = window.requestAnimationFrame(() =>
          scrollAndSettle(remainingFrames - 1)
        );
      };

      scrollAndSettle(FORCE_SCROLL_MAX_SETTLE_FRAMES);
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const requestForceScrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      if (pendingForceRequestFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingForceRequestFrameRef.current);
      }
      pendingForceRequestFrameRef.current = window.requestAnimationFrame(() => {
        pendingForceRequestFrameRef.current = null;
        scrollToBottom(behavior, true);
      });
    },
    [scrollToBottom]
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const updateNearBottomState = () => {
      const distanceToBottom =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      const nextIsNearBottom = distanceToBottom <= NEAR_BOTTOM_THRESHOLD_PX;
      isNearBottomRef.current = nextIsNearBottom;
      setShowScrollToBottom(!nextIsNearBottom && messagesRef.current.length > 0);
    };

    updateNearBottomState();
    const onScroll = () => updateNearBottomState();
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setShowScrollToBottom(false);
      return;
    }
    setShowScrollToBottom(!isNearBottomRef.current);
  }, [messages.length]);

  const scheduleAutoScroll = useCallback(
    (behavior: ScrollBehavior) => {
      pendingAutoScrollBehaviorRef.current = behavior;
      if (autoScrollFrameRef.current !== null) return;

      const flush = () => {
        const pendingBehavior = pendingAutoScrollBehaviorRef.current;
        if (!pendingBehavior) {
          autoScrollFrameRef.current = null;
          return;
        }

        const now = window.performance.now();
        if (isStreaming && !isNearBottomRef.current) {
          pendingAutoScrollBehaviorRef.current = null;
          autoScrollFrameRef.current = null;
          return;
        }
        if (isStreaming && now - lastAutoScrollAtRef.current < STREAM_SCROLL_THROTTLE_MS) {
          autoScrollFrameRef.current = window.requestAnimationFrame(flush);
          return;
        }

        pendingAutoScrollBehaviorRef.current = null;
        lastAutoScrollAtRef.current = now;
        scrollToBottom(pendingBehavior);
        autoScrollFrameRef.current = null;

        if (pendingAutoScrollBehaviorRef.current) {
          autoScrollFrameRef.current = window.requestAnimationFrame(flush);
        }
      };

      autoScrollFrameRef.current = window.requestAnimationFrame(flush);
    },
    [isStreaming, scrollToBottom]
  );

  const updateMessageById = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      commitMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === messageId);
        if (index === -1) return prev;
        const current = prev[index];
        const nextMessage = { ...current, ...updates };
        if (
          nextMessage.text === current.text &&
          nextMessage.reasoning === current.reasoning &&
          nextMessage.isError === current.isError
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

      commitMessages((prev) => [...prev, userMessage, modelMessage]);
      requestForceScrollToBottom('auto');

      return modelMessageId;
    },
    [buildMessage, commitMessages, requestForceScrollToBottom]
  );

  const buildFriendlyErrorMessage = useCallback((rawMessage: string): string => {
    const rawLower = rawMessage.toLowerCase();
    let friendlyError = t('error.generic');

    if (rawLower.includes('api key') || rawLower.includes('403')) {
      friendlyError = t('error.auth');
    } else if (rawLower.includes('quota') || rawLower.includes('429')) {
      friendlyError = t('error.quota');
    } else if (rawLower.includes('safety') || rawLower.includes('blocked')) {
      friendlyError = t('error.safety');
    } else if (
      rawLower.includes('fetch') ||
      rawLower.includes('network') ||
      rawLower.includes('failed to fetch')
    ) {
      friendlyError = t('error.network');
    } else if (rawLower.includes('503') || rawLower.includes('overloaded')) {
      friendlyError = t('error.overloaded');
    }

    return `**${friendlyError}**

**${t('error.troubleshooting')}**
1. ${t('error.step1')}
2. ${t('error.step2')}
3. ${t('error.step3')}

<details>
<summary>${t('error.technicalDetails')}</summary>

\`\`\`
${rawMessage}
\`\`\`
</details>`;
  }, []);

  const upsertModelErrorMessage = useCallback(
    (modelMessageId: string, finalMessageText: string) => {
      const fallbackErrorMessage = buildMessage(Role.Model, finalMessageText, { isError: true });
      commitMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === modelMessageId);
        if (index === -1) {
          return [...prev, fallbackErrorMessage];
        }
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

  const syncHistory = useCallback(() => {
    void chatService.startChatWithHistory(messagesRef.current).catch((error) => {
      console.error('Failed to synchronize chat history:', error);
    });
  }, [chatService]);

  useEffect(() => {
    if (!isStreaming) return;
    scheduleAutoScroll('auto');
  }, [isStreaming, messages, scheduleAutoScroll]);

  useEffect(() => {
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      if (forceScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(forceScrollFrameRef.current);
        forceScrollFrameRef.current = null;
      }
      if (pendingForceRequestFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingForceRequestFrameRef.current);
        pendingForceRequestFrameRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      stopRequestedRef.current = false;
      const modelMessageId = startPendingModelResponse(text);
      setIsStreaming(true);
      setIsLoading(true);

      try {
        let fullResponseClean = '';
        let fullResponseReasoning = '';
        let isFirstChunk = true;
        let pendingBuffer = '';
        let isFlushScheduled = false;
        let parserState = createThinkStreamParserState();

        const flushBufferedResponse = () => {
          isFlushScheduled = false;
          if (!pendingBuffer) return;
          parserState = appendThinkStreamChunk(parserState, pendingBuffer);
          const parsed = finalizeThinkStreamParserState(parserState);
          fullResponseClean = parsed.cleaned;
          fullResponseReasoning = parsed.reasoning;
          pendingBuffer = '';
          updateMessageById(modelMessageId, {
            text: fullResponseClean,
            reasoning: fullResponseReasoning || undefined,
          });
        };

        const scheduleFlush = () => {
          if (isFlushScheduled) return;
          isFlushScheduled = true;
          requestAnimationFrame(flushBufferedResponse);
        };

        for await (const chunk of chatService.sendMessageStream(text)) {
          if (stopRequestedRef.current) {
            break;
          }
          if (isFirstChunk) {
            setIsLoading(false);
            isFirstChunk = false;
          }

          pendingBuffer += chunk;
          scheduleFlush();
        }
        flushBufferedResponse();
        updateMessageById(modelMessageId, {
          text: fullResponseClean,
          reasoning: fullResponseReasoning || undefined,
        });
      } catch (error: unknown) {
        console.error('Chat error:', error);

        const rawMessage = error instanceof Error ? error.message : String(error);
        const finalMessageText = buildFriendlyErrorMessage(rawMessage);
        upsertModelErrorMessage(modelMessageId, finalMessageText);
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
        syncHistory();
      }
    },
    [
      buildFriendlyErrorMessage,
      chatService,
      startPendingModelResponse,
      syncHistory,
      updateMessageById,
      upsertModelErrorMessage,
    ]
  );

  const stopStreaming = useCallback(() => {
    stopRequestedRef.current = true;
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const jumpToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    scrollToBottom('smooth', true);
  }, [scrollToBottom]);

  return {
    messagesEndRef,
    messagesContainerRef,
    isStreaming,
    isLoading,
    showScrollToBottom,
    scrollToBottom,
    requestForceScrollToBottom,
    jumpToBottom,
    handleSendMessage,
    stopStreaming,
  };
};
