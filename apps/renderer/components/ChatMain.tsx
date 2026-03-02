import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import WelcomeScreen from './WelcomeScreen';
import { ChatMessage, Role } from '../types';
import { t } from '../utils/i18n';

type ChatMainProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  messagesContentRef: React.RefObject<HTMLDivElement>;
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
  messagesContentRef,
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
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const hasShownWelcomeRef = useRef(false);
  const previousMessageIdsRef = useRef<string[]>([]);

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

  useEffect(() => {
    previousMessageIdsRef.current = messages.map((message) => message.id);
  }, [messages]);

  const shouldAnimateWelcome = !hasMessages && !hasShownWelcomeRef.current;
  if (shouldAnimateWelcome) {
    hasShownWelcomeRef.current = true;
  }

  const previousMessageIds = previousMessageIdsRef.current;
  const isAppendOnlyUpdate =
    previousMessageIds.length <= messages.length &&
    previousMessageIds.every((id, index) => messages[index]?.id === id);

  return (
    <main className="chat-main flex-1 flex flex-col h-full relative bg-transparent pt-0">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth pt-0"
        style={{ scrollPaddingBottom: 'calc(var(--chat-input-height, 120px) + 8px)' }}
      >
        <div
          ref={messagesContentRef}
          className="mx-auto w-full max-w-[min(64rem,100%)] px-4 py-6 min-h-full flex flex-col"
          style={{ paddingBottom: 'calc(var(--chat-input-height, 120px) + 8px)' }}
        >
          {!hasMessages ? (
            <WelcomeScreen
              animateOnMount={shouldAnimateWelcome}
              input={
                <ChatInput
                  {...chatInputProps}
                  containerClassName="px-0 pb-0 max-w-[min(80rem,100%)]"
                />
              }
            />
          ) : (
            <>
              {messages.map((msg, index) => {
                const isNewInAppend =
                  isAppendOnlyUpdate && index >= previousMessageIds.length;
                const shouldAnimateMessage =
                  isNewInAppend && !seenMessageIdsRef.current.has(msg.id);
                seenMessageIdsRef.current.add(msg.id);

                return (
                  <div key={msg.id}>
                    <ChatBubble
                      message={msg}
                      animateOnMount={shouldAnimateMessage}
                      isStreaming={
                        isStreaming && index === messages.length - 1 && msg.role === Role.Model
                      }
                    />
                  </div>
                );
              })}
              {isStreaming && <div className="flex justify-start mb-6"></div>}
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>
      </div>

      {hasMessages && showScrollToBottom && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ bottom: 'calc(var(--chat-input-height, 120px) + 16px)' }}
        >
          <div className="mx-auto flex w-full max-w-[min(64rem,100%)] justify-end px-4">
            <button
              type="button"
              onClick={onJumpToBottom}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-2)] transition-colors duration-160 ease-out hover:text-[var(--ink-1)]"
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