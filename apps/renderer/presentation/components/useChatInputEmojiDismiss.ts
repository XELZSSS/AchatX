import { useEffect } from 'react';
import type { RefObject } from 'react';

type UseChatInputEmojiDismissOptions = {
  isInputDisabled: boolean;
  isEmojiPickerOpen: boolean;
  closeEmojiPicker: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  emojiButtonRef: RefObject<HTMLButtonElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
};

export const useChatInputEmojiDismiss = ({
  isInputDisabled,
  isEmojiPickerOpen,
  closeEmojiPicker,
  textareaRef,
  emojiButtonRef,
  emojiPickerRef,
}: UseChatInputEmojiDismissOptions) => {
  useEffect(() => {
    if (!isInputDisabled) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      closeEmojiPicker();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [closeEmojiPicker, isInputDisabled]);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (emojiButtonRef.current?.contains(target) || emojiPickerRef.current?.contains(target)) {
        return;
      }
      closeEmojiPicker();
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeEmojiPicker();
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeEmojiPicker, emojiButtonRef, emojiPickerRef, isEmojiPickerOpen, textareaRef]);
};
