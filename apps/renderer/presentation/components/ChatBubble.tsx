import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Role, ChatMessage } from '@/shared/types/chat';
import { t, type Language } from '@/shared/utils/i18n';
import {
  CitationsSection,
  REASONING_PANEL_BASE_CLASS,
  REASONING_PANEL_CLOSED_CLASS,
  REASONING_PANEL_OPEN_CLASS,
  TextContent,
  ToolCallsSection,
  ToolResultsSection,
  TypingIndicator,
} from '@/presentation/components/chatBubbleParts';

interface ChatBubbleProps {
  language: Language;
  message: ChatMessage;
  isStreaming?: boolean;
  animateOnMount?: boolean;
}

const ChatBubble = ({ language, message, isStreaming = false }: ChatBubbleProps) => {
  const isUser = message.role === Role.User;
  const isError = message.isError;
  const hasText = message.text && message.text.length > 0;
  const toolCalls = !isUser ? (message.toolCalls ?? []) : [];
  const toolResults = !isUser ? (message.toolResults ?? []) : [];
  const citations = !isUser ? (message.citations ?? []) : [];
  const reasoningText = !isUser ? (message.reasoning?.trim() ?? '') : '';
  const hasReasoning = reasoningText.length > 0;
  const hasToolCalls = toolCalls.length > 0;
  const hasToolResults = toolResults.length > 0;
  const hasCitations = citations.length > 0;
  const [areCitationsOpen, setAreCitationsOpen] = useState(false);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const prevStreamingRef = useRef(isStreaming);
  const reasoningSeenRef = useRef(false);
  const collapseTimerRef = useRef<number | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCollapseTimer();
    };
  }, [clearCollapseTimer]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isStreaming && hasReasoning && !reasoningSeenRef.current) {
      clearCollapseTimer();
      setIsReasoningOpen(true);
      reasoningSeenRef.current = true;
    }

    if (prevStreamingRef.current && !isStreaming) {
      clearCollapseTimer();
      reasoningSeenRef.current = false;
    }

    prevStreamingRef.current = isStreaming;
  }, [clearCollapseTimer, hasReasoning, isStreaming]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const containerAlignment = isUser ? 'justify-end flex-row pr-3' : 'justify-start flex-row';
  const messageAlignment = isUser ? 'items-end max-w-[min(38rem,100%)]' : 'items-start';
  const messageContentClass = isUser
    ? 'text-[var(--ink-1)]'
    : isError
      ? 'rounded-lg rounded-tl-sm border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-[var(--text-on-brand)]'
      : 'text-[var(--ink-2)]';
  const reasoningToggleLabel = `${isStreaming ? t('reasoning.streaming') : t('reasoning.title')} ${
    isReasoningOpen ? t('reasoning.collapse') : t('reasoning.expand')
  }`;

  return (
    <div className="flex w-full mb-6 justify-center" data-language={language}>
      <div className={`flex min-w-0 w-full max-w-[min(64rem,100%)] gap-4 ${containerAlignment}`}>
        <div className={`flex min-w-0 flex-col w-full max-w-[min(52rem,100%)] ${messageAlignment}`}>
          <div className={`py-1 ${messageContentClass}`}>
            {isUser ? (
              <TextContent
                as="p"
                text={message.text}
                className="whitespace-pre-wrap break-words leading-relaxed text-sm"
              />
            ) : (
              <div className="min-w-0">
                {hasReasoning && (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearCollapseTimer();
                        setIsReasoningOpen((prev) => !prev);
                      }}
                      className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
                    >
                      {reasoningToggleLabel}
                    </button>
                  </div>
                )}

                {hasReasoning && (
                  <div
                    className={`${REASONING_PANEL_BASE_CLASS} ${
                      isReasoningOpen ? REASONING_PANEL_OPEN_CLASS : REASONING_PANEL_CLOSED_CLASS
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--ink-3)]">
                        <TextContent
                          as="p"
                          text={reasoningText}
                          className="whitespace-pre-wrap break-words leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {hasToolCalls && <ToolCallsSection toolCalls={toolCalls} />}
                {hasToolResults && <ToolResultsSection toolResults={toolResults} />}
                {!hasText && isStreaming && <TypingIndicator />}
                {hasText && (
                  <TextContent
                    as="p"
                    text={message.text}
                    className="whitespace-pre-wrap break-words leading-relaxed text-sm text-[var(--ink-2)]"
                  />
                )}

                {hasCitations && (
                  <CitationsSection
                    citations={citations}
                    areCitationsOpen={areCitationsOpen}
                    onToggle={() => setAreCitationsOpen((prev) => !prev)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const areChatBubbleEqual = (prev: ChatBubbleProps, next: ChatBubbleProps): boolean => {
  if (prev.language !== next.language) return false;
  if (prev.isStreaming !== next.isStreaming) return false;

  const prevMessage = prev.message;
  const nextMessage = next.message;
  return (
    prevMessage.id === nextMessage.id &&
    prevMessage.role === nextMessage.role &&
    prevMessage.text === nextMessage.text &&
    prevMessage.reasoning === nextMessage.reasoning &&
    prevMessage.isError === nextMessage.isError &&
    prevMessage.timeLabel === nextMessage.timeLabel &&
    prevMessage.timestamp === nextMessage.timestamp &&
    prevMessage.toolCalls === nextMessage.toolCalls &&
    prevMessage.toolResults === nextMessage.toolResults &&
    prevMessage.citations === nextMessage.citations
  );
};

export default memo(ChatBubble, areChatBubbleEqual);
