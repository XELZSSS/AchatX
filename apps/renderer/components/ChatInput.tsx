import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, StopCircle } from 'lucide-react';
import { t } from '../utils/i18n';
import { IconButton } from './ui';
import { readAppStorage, removeAppStorage, writeAppStorage } from '../services/storageKeys';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  containerClassName?: string;
  searchEnabled: boolean;
  searchAvailable: boolean;
  onToggleSearch: () => void;
}

const ChatInputComponent: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  isStreaming,
  onStop,
  containerClassName,
  searchEnabled,
  searchAvailable,
  onToggleSearch,
}) => {
  const [input, setInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftSaveTimerRef = useRef<number | null>(null);

  const clearDraftTimer = () => {
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    const savedDraft = readAppStorage('inputDraft');
    if (savedDraft) {
      setInput(savedDraft);
    }
  }, []);

  useEffect(() => {
    return () => clearDraftTimer();
  }, []);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      document.documentElement.style.setProperty(
        '--chat-input-height',
        `${containerRef.current.offsetHeight}px`
      );
    });
  }, [input]);

  useEffect(() => {
    const updateHeight = () => {
      if (!containerRef.current) return;
      document.documentElement.style.setProperty(
        '--chat-input-height',
        `${containerRef.current.offsetHeight}px`
      );
    };
    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    clearDraftTimer();
    draftSaveTimerRef.current = window.setTimeout(() => {
      writeAppStorage('inputDraft', newValue);
      clearDraftTimer();
    }, 350);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || (disabled && !isStreaming)) return;

    if (isStreaming) {
      onStop();
      return;
    }

    onSend(input);
    setInput('');
    clearDraftTimer();
    removeAppStorage('inputDraft');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const searchToggleLabel = searchEnabled ? t('input.search.disable') : t('input.search.enable');
  const sendActionLabel = isStreaming ? t('input.stop') : t('input.send');

  return (
    <div
      ref={containerRef}
      className={`mx-auto w-full max-w-[min(64rem,100%)] px-4 pb-6 ${containerClassName ?? ''}`}
    >
      <div className="relative flex items-end gap-2 bg-[var(--bg-2)] border border-[var(--line-1)] rounded-xl p-2 transition-colors duration-160 ease-out">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-[var(--ink-1)] placeholder:text-[var(--ink-3)] text-sm px-3 py-2.5 max-h-[150px] resize-none focus:outline-none scrollbar-hide"
          rows={1}
          disabled={disabled && !isStreaming}
        />
        <div className="flex items-center gap-2 pb-2.5 pr-1">
          <button
            type="button"
            onClick={onToggleSearch}
            disabled={!searchAvailable || (disabled && !isStreaming)}
            aria-pressed={searchEnabled}
            aria-label={searchToggleLabel}
            title={searchToggleLabel}
            className={`p-1 rounded-lg transition-colors duration-160 ease-out ${
              searchEnabled
                ? 'text-[#3b82f6]'
                : 'text-[var(--ink-3)] hover:text-[#3b82f6]'
            } ${
              searchAvailable && !(disabled && !isStreaming)
                ? ''
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (isStreaming) {
                onStop();
                return;
              }
              handleSubmit();
            }}
            disabled={(!input.trim() && !isStreaming) || (disabled && !isStreaming)}
            aria-label={sendActionLabel}
            title={sendActionLabel}
            className={`p-1 rounded-lg transition-colors duration-160 ease-out ${
              input.trim() || isStreaming
                ? 'text-[#3b82f6] hover:text-[#2563eb]'
                : 'text-[var(--ink-3)]'
            } ${
              (!input.trim() && !isStreaming) || (disabled && !isStreaming)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {isStreaming ? (
              <div className="animate-pulse">
                <StopCircle size={18} />
              </div>
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatInput = React.memo(ChatInputComponent);
export default ChatInput;