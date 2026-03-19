import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ChatService } from '@/application/chat/chatService';
import { appendThinkStreamChunk, finalizeThinkStreamParserState } from '@/shared/utils/streaming';
import {
  debugLogRequestPolicy,
  decideRequestPolicyFromPrompt,
  downgradeRequestPolicy,
  type RequestPolicy,
} from '@/infrastructure/providers/requestPolicy';
import type { ChatMessage } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import {
  buildFriendlyErrorMessage,
  createStreamAccumulator,
  delayWithAbort,
  getErrorMessage,
  hasPersistableMessageContent,
  isAbortLikeError,
  resetStreamAccumulator,
  type StreamAccumulator,
} from '@/presentation/hooks/chat/streamingMessageHelpers';
import { useStreamingMessageStore } from '@/presentation/hooks/chat/useStreamingMessageStore';
import { useStreamingViewport } from '@/presentation/hooks/chat/useStreamingViewport';

type UseStreamingMessagesOptions = {
  chatService: ChatService;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  commitCurrentSessionNow?: () => void;
};

export const useStreamingMessages = ({
  chatService,
  messages,
  setMessages,
  commitCurrentSessionNow,
}: UseStreamingMessagesOptions) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const stopRequestedRef = useRef(false);
  const messagesRef = useRef(messages);
  const activeStreamAbortControllerRef = useRef<AbortController | null>(null);
  const streamAccumulatorRef = useRef<StreamAccumulator | null>(null);

  const {
    messagesContentRef,
    messagesEndRef,
    messagesContainerRef,
    showScrollToBottom,
    jumpToBottom,
    performScrollToBottom,
    autoScrollEnabledRef,
    isNearBottomRef,
  } = useStreamingViewport({ messages, messagesRef });

  const {
    updateMessageById,
    removeMessageById,
    startPendingModelResponse,
    upsertModelErrorMessage,
  } = useStreamingMessageStore({
    setMessages,
    messagesRef,
    performScrollToBottom,
    autoScrollEnabledRef,
    isNearBottomRef,
  });

  const syncHistory = useCallback(() => {
    void chatService.startChatWithHistory(messagesRef.current).catch((error) => {
      console.error('Failed to synchronize chat history:', error);
    });
  }, [chatService]);

  const flushBufferedStreamResponse = useCallback(
    (modelMessageId: string, accumulator: StreamAccumulator) => {
      if (!accumulator.pendingBuffer) {
        return;
      }

      accumulator.parserState = appendThinkStreamChunk(
        accumulator.parserState,
        accumulator.pendingBuffer
      );
      const parsed = finalizeThinkStreamParserState(accumulator.parserState);
      accumulator.cleaned = parsed.cleaned;
      accumulator.reasoning = parsed.reasoning;
      accumulator.pendingBuffer = '';

      updateMessageById(modelMessageId, {
        text: accumulator.cleaned,
        reasoning: accumulator.reasoning || undefined,
      });

      if (autoScrollEnabledRef.current) {
        window.requestAnimationFrame(() => {
          if (autoScrollEnabledRef.current) {
            performScrollToBottom('auto');
          }
        });
      }
    },
    [autoScrollEnabledRef, performScrollToBottom, updateMessageById]
  );

  const stopStreaming = useCallback(() => {
    stopRequestedRef.current = true;
    autoScrollEnabledRef.current = false;
    activeStreamAbortControllerRef.current?.abort();
    activeStreamAbortControllerRef.current = null;
    resetStreamAccumulator(streamAccumulatorRef.current);
    streamAccumulatorRef.current = null;
  }, [autoScrollEnabledRef]);

  useEffect(() => {
    return () => {
      activeStreamAbortControllerRef.current?.abort();
      activeStreamAbortControllerRef.current = null;
      resetStreamAccumulator(streamAccumulatorRef.current);
      streamAccumulatorRef.current = null;
    };
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      stopRequestedRef.current = false;
      activeStreamAbortControllerRef.current?.abort();

      const abortController = new AbortController();
      activeStreamAbortControllerRef.current = abortController;
      const modelMessageId = startPendingModelResponse(text);

      setIsStreaming(true);
      setIsLoading(true);

      let requestPolicy: RequestPolicy = decideRequestPolicyFromPrompt(text);

      const streamAttempt = async (policy: RequestPolicy) => {
        const accumulator = createStreamAccumulator();
        streamAccumulatorRef.current = accumulator;
        debugLogRequestPolicy(chatService.getProviderId(), policy);

        for await (const chunk of chatService.sendMessageStream(text, abortController.signal, policy)) {
          if (stopRequestedRef.current) {
            break;
          }
          if (accumulator.isFirstChunk) {
            setIsLoading(false);
            accumulator.isFirstChunk = false;
          }
          accumulator.pendingBuffer += chunk;
          flushBufferedStreamResponse(modelMessageId, accumulator);
        }

        flushBufferedStreamResponse(modelMessageId, accumulator);
        const responseMetadata = chatService.consumePendingResponseMetadata();
        updateMessageById(modelMessageId, {
          text: accumulator.cleaned,
          reasoning: accumulator.reasoning || undefined,
          citations: responseMetadata?.citations,
        });
        resetStreamAccumulator(accumulator);
        if (streamAccumulatorRef.current === accumulator) {
          streamAccumulatorRef.current = null;
        }
      };

      try {
        try {
          await streamAttempt(requestPolicy);
        } catch (error: unknown) {
          if (isAbortLikeError(error, stopRequestedRef.current)) {
            throw error;
          }

          console.error('Chat error, retrying once:', error);
          setIsLoading(false);
          updateMessageById(modelMessageId, {
            text: t('error.retrying'),
            reasoning: undefined,
            isError: false,
          });
          requestPolicy = downgradeRequestPolicy(requestPolicy);
          await delayWithAbort(3000, abortController.signal);
          await streamAttempt(requestPolicy);
        }
      } catch (error: unknown) {
        if (!isAbortLikeError(error, stopRequestedRef.current)) {
          console.error('Chat error:', error);
          upsertModelErrorMessage(modelMessageId, buildFriendlyErrorMessage(getErrorMessage(error)));
        }
      } finally {
        if (activeStreamAbortControllerRef.current === abortController) {
          activeStreamAbortControllerRef.current = null;
        }

        if (stopRequestedRef.current) {
          const stoppedMessage = messagesRef.current.find((message) => message.id === modelMessageId);
          if (!hasPersistableMessageContent(stoppedMessage)) {
            removeMessageById(modelMessageId);
          }
        }

        setIsStreaming(false);
        setIsLoading(false);
        autoScrollEnabledRef.current = false;
        if (messagesRef.current.length > 0) {
          syncHistory();
          commitCurrentSessionNow?.();
        }
      }
    },
    [
      autoScrollEnabledRef,
      chatService,
      commitCurrentSessionNow,
      flushBufferedStreamResponse,
      removeMessageById,
      startPendingModelResponse,
      syncHistory,
      updateMessageById,
      upsertModelErrorMessage,
    ]
  );

  return {
    messagesContentRef,
    messagesEndRef,
    messagesContainerRef,
    isStreaming,
    isLoading,
    showScrollToBottom,
    jumpToBottom,
    handleSendMessage,
    stopStreaming,
  };
};
