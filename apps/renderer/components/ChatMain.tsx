import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import WelcomeScreen from './WelcomeScreen';
import { ChatMessage, Role } from '../types';
import { useVirtualList } from '../hooks/useVirtualList';
import { t } from '../utils/i18n';

type ChatMainProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  showScrollToBottom: boolean;
  onJumpToBottom: () => void;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleSearch: () => void;
};

const ChatMainComponent: React.FC<ChatMainProps> = ({
  messages,
  isStreaming,
  isLoading,
  messagesContainerRef,
  messagesEndRef,
  showScrollToBottom,
  onJumpToBottom,
  onSendMessage,
  onStopStreaming,
  searchEnabled,
  searchAvailable,
  onToggleSearch,
}) => {
  const lastSkippedMeasureIndexRef = useRef<number | null>(null);
  const pendingFinalMeasureIndexRef = useRef<number | null>(null);
  const previousIsStreamingRef = useRef(isStreaming);

  const chatInputProps = useMemo(
    () => ({
      onSend: onSendMessage,
      disabled: isLoading,
      isStreaming,
      onStop: onStopStreaming,
      searchEnabled,
      searchAvailable,
      onToggleSearch,
    }),
    [
      isLoading,
      isStreaming,
      onSendMessage,
      onStopStreaming,
      onToggleSearch,
      searchAvailable,
      searchEnabled,
    ]
  );
  const hasMessages = messages.length > 0;
  const estimateMessageSize = useMemo(
    () => (msg: ChatMessage) => {
      const base = msg.role === Role.User ? 84 : 96;
      const textLines = Math.max(1, Math.ceil((msg.text?.length ?? 0) / 56));
      const reasoningLines = Math.max(0, Math.ceil((msg.reasoning?.length ?? 0) / 64));
      const imageHeight = msg.imageUrl || msg.imageDataUrl ? 300 : 0;
      return base + textLines * 20 + reasoningLines * 16 + imageHeight;
    },
    []
  );
  const { visibleItems, topSpacerHeight, bottomSpacerHeight, measureItem } =
    useVirtualList<ChatMessage>({
      items: messages,
      containerRef: messagesContainerRef,
      estimateSize: estimateMessageSize,
      getItemKey: (msg) => msg.id,
      overscan: messages.length,
    });

  useEffect(() => {
    if (previousIsStreamingRef.current && !isStreaming) {
      pendingFinalMeasureIndexRef.current = lastSkippedMeasureIndexRef.current;
    }
    previousIsStreamingRef.current = isStreaming;
  }, [isStreaming]);

  return (
    <main className="chat-main flex-1 flex flex-col h-full relative bg-transparent pt-0">
      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth pt-0"
        style={{ scrollPaddingBottom: 'calc(var(--chat-input-height, 120px) + 8px)' }}
      >
        <div
          className="mx-auto w-full max-w-[min(64rem,100%)] px-4 py-8 min-h-full flex flex-col"
          style={{ paddingBottom: 'calc(var(--chat-input-height, 120px) + 8px)' }}
        >
          {!hasMessages ? (
            <WelcomeScreen
              input={
                <ChatInput
                  {...chatInputProps}
                  containerClassName="px-0 pb-0 max-w-[min(80rem,100%)]"
                />
              }
            />
          ) : (
            <>
              <div style={{ height: `${topSpacerHeight}px` }} />
              {visibleItems.map(({ item: msg, index }) => (
                <div
                  key={msg.id}
                  ref={(node) => {
                    if (!node) return;
                    const isStreamingTailModel =
                      isStreaming && index === messages.length - 1 && msg.role === Role.Model;

                    if (isStreamingTailModel) {
                      // Keep virtual list on estimated size while streaming to reduce layout jitter.
                      lastSkippedMeasureIndexRef.current = index;
                      return;
                    }

                    measureItem(index, node);

                    if (pendingFinalMeasureIndexRef.current === index) {
                      // Force one final precise measure after stream end.
                      measureItem(index, node);
                      pendingFinalMeasureIndexRef.current = null;
                    }
                  }}
                >
                  <ChatBubble
                    message={msg}
                    isStreaming={
                      isStreaming && index === messages.length - 1 && msg.role === Role.Model
                    }
                  />
                </div>
              ))}
              <div style={{ height: `${bottomSpacerHeight}px` }} />
              {isStreaming && <div className="flex justify-start mb-6"></div>}
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      {hasMessages && showScrollToBottom && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ bottom: 'calc(var(--chat-input-height, 120px) + 16px)' }}
        >
          <div className="mx-auto flex w-full max-w-[min(64rem,100%)] justify-end px-4">
            <button
              type="button"
              onClick={onJumpToBottom}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-2)] shadow-sm transition-colors hover:text-[var(--ink-1)]"
              aria-label={t('chat.scrollToBottom')}
              title={t('chat.scrollToBottom')}
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      )}
      {hasMessages && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <ChatInput {...chatInputProps} />
        </div>
      )}
    </main>
  );
};

const ChatMain = React.memo(ChatMainComponent);
export default ChatMain;
