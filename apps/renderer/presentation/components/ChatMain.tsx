import { memo, useMemo } from 'react';
import type { RefObject } from 'react';
import ChatBubble from '@/presentation/components/ChatBubble';
import ChatInput from '@/presentation/components/ChatInput';
import WelcomeScreen from '@/presentation/components/WelcomeScreen';
import { ChatMessage, Role } from '@/shared/types/chat';
import { t, type Language } from '@/shared/utils/i18n';
import { KeyboardArrowDownIcon } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui';

type ChatMainProps = {
  language: Language;
  sessionId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  messagesContentRef: RefObject<HTMLDivElement | null>;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  showScrollToBottom: boolean;
  onJumpToBottom: () => void;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  reasoningEnabled: boolean;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleReasoning: () => void;
  onToggleSearch: () => void;
};

const MAIN_CLASS = 'chat-main flex-1 flex flex-col h-full relative bg-transparent pt-0';
const MESSAGES_CONTAINER_CLASS = 'flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pt-0';
const MESSAGES_CONTENT_CLASS =
  'mx-auto w-full max-w-[min(64rem,100%)] px-4 py-6 min-h-full flex flex-col';
const SCROLL_BUTTON_WRAPPER_CLASS = 'mx-auto flex w-full max-w-[min(64rem,100%)] justify-end px-4';
const SCROLL_BUTTON_CLASS =
  'pointer-events-auto border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:bg-[var(--bg-1)] hover:text-[var(--ink-1)]';

type ScrollToBottomButtonProps = {
  onJumpToBottom: () => void;
};

const ScrollToBottomButton = ({ onJumpToBottom }: ScrollToBottomButtonProps) => (
  <div
    className="absolute left-0 right-0 z-20 pointer-events-none"
    style={{ bottom: 'calc(var(--chat-input-height, 120px) + 16px)' }}
  >
    <div className={SCROLL_BUTTON_WRAPPER_CLASS}>
      <IconButton
        onClick={onJumpToBottom}
        variant="subtle"
        className={SCROLL_BUTTON_CLASS}
        aria-label={t('chat.scrollToBottom')}
        title={t('chat.scrollToBottom')}
      >
        <KeyboardArrowDownIcon size={18} strokeWidth={2} />
      </IconButton>
    </div>
  </div>
);

const ChatMainComponent = ({
  language,
  sessionId,
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
  reasoningEnabled,
  searchEnabled,
  searchAvailable,
  onToggleReasoning,
  onToggleSearch,
}: ChatMainProps) => {
  const chatInputProps = useMemo(
    () => ({
      language,
      sessionId,
      onSend: onSendMessage,
      disabled: isLoading,
      isStreaming,
      onStop: onStopStreaming,
      reasoningEnabled,
      searchEnabled,
      searchAvailable,
      onToggleReasoning,
      onToggleSearch,
    }),
    [
      language,
      sessionId,
      isLoading,
      isStreaming,
      onSendMessage,
      onStopStreaming,
      onToggleReasoning,
      onToggleSearch,
      reasoningEnabled,
      searchAvailable,
      searchEnabled,
    ]
  );

  const hasMessages = messages.length > 0;
  const scrollPaddingBottom = 'calc(var(--chat-input-height, 120px) + 8px)';
  const showScrollButton = hasMessages && showScrollToBottom;
  const showChatInput = hasMessages;
  const welcomeInput = (
    <ChatInput {...chatInputProps} containerClassName="px-0 pb-0 max-w-[min(80rem,100%)]" />
  );

  return (
    <main className={MAIN_CLASS} data-language={language}>
      <div
        ref={messagesContainerRef}
        className={MESSAGES_CONTAINER_CLASS}
        style={{ scrollPaddingBottom }}
      >
        <div
          ref={messagesContentRef}
          className={MESSAGES_CONTENT_CLASS}
          style={{ paddingBottom: scrollPaddingBottom }}
        >
          {!hasMessages ? (
            <WelcomeScreen input={welcomeInput} />
          ) : (
            <>
              {messages.map((msg, index) => (
                <div key={msg.id}>
                  <ChatBubble
                    language={language}
                    message={msg}
                    isStreaming={
                      isStreaming && index === messages.length - 1 && msg.role === Role.Model
                    }
                  />
                </div>
              ))}
              <div className="flex justify-start mb-6" aria-hidden="true"></div>
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>
      </div>

      {showScrollButton && <ScrollToBottomButton onJumpToBottom={onJumpToBottom} />}
      {showChatInput && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <ChatInput {...chatInputProps} />
        </div>
      )}
    </main>
  );
};

const ChatMain = memo(ChatMainComponent);
export default ChatMain;
