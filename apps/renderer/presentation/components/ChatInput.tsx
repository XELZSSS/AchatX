import { memo, useCallback, useEffect, useRef } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { t, type Language } from '@/shared/utils/i18n';
import {
  PsychologyAltOutlinedIcon,
  PublicIcon,
  SendRoundedIcon,
  SentimentSatisfiedAltOutlinedIcon,
  StopCircleOutlinedIcon,
} from '@/shared/ui/icons';
import {
  CONTAINER_CLASS,
  INPUT_SHELL_CLASS,
  TEXTAREA_CLASS,
} from '@/presentation/components/chatInputHelpers';
import { ChatInputActionButton } from '@/presentation/components/chatInputParts';
import { ChatInputEmojiPicker } from '@/presentation/components/ChatInputEmojiPicker';
import { useChatInputDraft } from '@/presentation/components/useChatInputDraft';
import { useChatInputEmojiPicker } from '@/presentation/components/useChatInputEmojiPicker';
import { useChatInputLayout } from '@/presentation/components/useChatInputLayout';

interface ChatInputProps {
  language: Language;
  sessionId: string;
  onSend: (message: string) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  containerClassName?: string;
  reasoningEnabled: boolean;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleReasoning: () => void;
  onToggleSearch: () => void;
}

const ChatInputComponent = ({
  language,
  sessionId,
  onSend,
  disabled,
  isStreaming,
  onStop,
  containerClassName,
  reasoningEnabled,
  searchEnabled,
  searchAvailable,
  onToggleReasoning,
  onToggleSearch,
}: ChatInputProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleDraftRestoredRef = useRef<(nextDraft: string) => void>(() => {});
  const isInputDisabled = disabled && !isStreaming;
  const isSearchDisabled = isInputDisabled || !searchAvailable;
  const reasoningButtonToneClass = reasoningEnabled
    ? 'text-[var(--ink-1)]'
    : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]';

  const {
    clearDraft,
    input,
    persistDraft,
    setInput,
  } = useChatInputDraft({
    sessionId,
    onSessionDraftRestored: (nextDraft) => handleDraftRestoredRef.current(nextDraft),
  });

  const {
    textareaRef,
    emojiButtonRef,
    isEmojiPickerOpen,
    handleDraftRestored,
    handleInputChange,
    syncSelection,
    handleEmojiButtonMouseDown,
    handleEmojiPickerToggle,
    emojiButtonToneClass,
    emojiToggleLabel,
    emojiPickerProps,
  } = useChatInputEmojiPicker({
    input,
    setInput,
    persistDraft,
    isInputDisabled,
  });
  useEffect(() => {
    handleDraftRestoredRef.current = handleDraftRestored;
  }, [handleDraftRestored]);

  useChatInputLayout({ containerRef, textareaRef, input });

  const hasInput = input.trim().length > 0;
  const isSendDisabled = isInputDisabled || (!hasInput && !isStreaming);
  const searchButtonToneClass = searchEnabled
    ? 'text-[var(--ink-1)]'
    : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]';
  const sendButtonToneClass =
    hasInput || isStreaming
      ? 'text-[var(--ink-1)]'
      : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]';

  const stopStreaming = useCallback(() => {
    onStop();
  }, [onStop]);

  const handleSubmit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      if (!hasInput || isInputDisabled) {
        return;
      }
      if (isStreaming) {
        stopStreaming();
        return;
      }

      onSend(input);
      setInput('');
      emojiPickerProps.onSearchClear();
      clearDraft();
    },
    [
      clearDraft,
      emojiPickerProps,
      hasInput,
      input,
      isInputDisabled,
      isStreaming,
      onSend,
      setInput,
      stopStreaming,
    ]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleSendClick = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
      return;
    }
    handleSubmit();
  }, [handleSubmit, isStreaming, stopStreaming]);

  return (
    <div
      ref={containerRef}
      data-language={language}
      className={`${CONTAINER_CLASS} ${containerClassName ?? ''}`}
    >
      <div className={INPUT_SHELL_CLASS}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onSelect={syncSelection}
          onClick={syncSelection}
          onKeyUp={syncSelection}
          className={TEXTAREA_CLASS}
          rows={1}
          placeholder={t('input.placeholder.chat')}
          disabled={isInputDisabled}
        />
        <div className="flex shrink-0 items-center gap-1 pr-0.5">
          <div>
            <ChatInputActionButton
              buttonRef={emojiButtonRef}
              onClick={handleEmojiPickerToggle}
              onMouseDown={handleEmojiButtonMouseDown}
              disabled={isInputDisabled}
              label={emojiToggleLabel}
              toneClassName={emojiButtonToneClass}
              ariaPressed={isEmojiPickerOpen}
              ariaExpanded={isEmojiPickerOpen}
              ariaHasPopup
              ariaControls={isEmojiPickerOpen ? 'chat-input-emoji-picker' : undefined}
            >
              <SentimentSatisfiedAltOutlinedIcon size={18} strokeWidth={2} />
            </ChatInputActionButton>
          </div>
          <ChatInputActionButton
            onClick={onToggleReasoning}
            disabled={isInputDisabled}
            label={reasoningEnabled ? t('input.reasoning.disable') : t('input.reasoning.enable')}
            toneClassName={reasoningButtonToneClass}
            ariaPressed={reasoningEnabled}
          >
            <PsychologyAltOutlinedIcon size={18} strokeWidth={2} />
          </ChatInputActionButton>
          <ChatInputActionButton
            onClick={onToggleSearch}
            disabled={isSearchDisabled}
            label={searchEnabled ? t('input.search.disable') : t('input.search.enable')}
            toneClassName={searchButtonToneClass}
            ariaPressed={searchEnabled}
          >
            <PublicIcon size={18} strokeWidth={2} />
          </ChatInputActionButton>
          <ChatInputActionButton
            onClick={handleSendClick}
            disabled={isSendDisabled}
            label={isStreaming ? t('input.stop') : t('input.send')}
            toneClassName={sendButtonToneClass}
          >
            {isStreaming ? (
              <StopCircleOutlinedIcon size={18} strokeWidth={2} />
            ) : (
              <SendRoundedIcon size={18} strokeWidth={2} />
            )}
          </ChatInputActionButton>
        </div>
      </div>

      <ChatInputEmojiPicker {...emojiPickerProps} />
    </div>
  );
};

const ChatInput = memo(ChatInputComponent);
export default ChatInput;
