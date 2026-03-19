import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type UseChatInputLayoutOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
};

export const useChatInputLayout = ({
  containerRef,
  textareaRef,
  input,
}: UseChatInputLayoutOptions) => {
  const lastHeightRef = useRef<number | null>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [textareaRef]);

  const updateChatInputHeight = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const nextHeight = containerRef.current.offsetHeight;
    if (lastHeightRef.current === nextHeight) {
      return;
    }

    lastHeightRef.current = nextHeight;
    document.documentElement.style.setProperty('--chat-input-height', `${nextHeight}px`);
  }, [containerRef]);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, input]);

  useEffect(() => {
    updateChatInputHeight();
    const observer = new ResizeObserver(() => updateChatInputHeight());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateChatInputHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateChatInputHeight);
    };
  }, [containerRef, updateChatInputHeight]);
};
