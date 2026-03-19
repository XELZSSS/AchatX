import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ChatMessage } from '@/shared/types/chat';

const AUTO_SCROLL_NEAR_BOTTOM_THRESHOLD_PX = 96;

const resolveNearBottomThreshold = (container: HTMLDivElement): number => {
  const style = window.getComputedStyle(container);
  const scrollPaddingBottom = Number.parseFloat(style.scrollPaddingBottom || '0');
  return Math.max(
    AUTO_SCROLL_NEAR_BOTTOM_THRESHOLD_PX,
    Number.isFinite(scrollPaddingBottom) ? scrollPaddingBottom + 16 : 0
  );
};

type UseStreamingViewportOptions = {
  messages: ChatMessage[];
  messagesRef: MutableRefObject<ChatMessage[]>;
};

export const useStreamingViewport = ({ messages, messagesRef }: UseStreamingViewportOptions) => {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const autoScrollEnabledRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastObservedContentHeightRef = useRef<number | null>(null);
  const contentResizeFrameRef = useRef<number | null>(null);

  const messagesContentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const performScrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior });
    window.requestAnimationFrame(() => {
      const latestContainer = messagesContainerRef.current;
      if (latestContainer) {
        latestContainer.scrollTop = latestContainer.scrollHeight;
      }
    });

    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  const jumpToBottom = useCallback(() => {
    performScrollToBottom('auto');
  }, [performScrollToBottom]);

  const updateNearBottomState = useCallback((source: 'scroll' | 'content') => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    const nextIsNearBottom = distanceToBottom <= resolveNearBottomThreshold(container);
    isNearBottomRef.current = nextIsNearBottom;
    if (source === 'scroll') {
      autoScrollEnabledRef.current = nextIsNearBottom;
    }
    setShowScrollToBottom(!nextIsNearBottom && messagesRef.current.length > 0);
  }, [messagesRef]);

  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length === 0) {
      const frameId = window.requestAnimationFrame(() => {
        setShowScrollToBottom(false);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const frameId = window.requestAnimationFrame(() => {
      updateNearBottomState('content');
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [messages, messagesRef, updateNearBottomState]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateNearBottomState('content');
    });
    const handleScroll = () => updateNearBottomState('scroll');
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateNearBottomState]);

  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) {
      return;
    }

    const scheduleContentResizeSync = (callback: () => void) => {
      if (contentResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(contentResizeFrameRef.current);
      }
      contentResizeFrameRef.current = window.requestAnimationFrame(() => {
        contentResizeFrameRef.current = null;
        callback();
      });
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextHeight = Math.round(entry.contentRect.height);
      const previousHeight = lastObservedContentHeightRef.current;
      lastObservedContentHeightRef.current = nextHeight;
      if (previousHeight === null || previousHeight === nextHeight) {
        return;
      }

      const shouldKeepBottomAnchor =
        autoScrollEnabledRef.current || isNearBottomRef.current || showScrollToBottom === false;

      scheduleContentResizeSync(() => {
        if (shouldKeepBottomAnchor) {
          performScrollToBottom('auto');
        } else {
          updateNearBottomState('content');
        }
      });
    });

    observer.observe(content);
    return () => {
      observer.disconnect();
      if (contentResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(contentResizeFrameRef.current);
        contentResizeFrameRef.current = null;
      }
    };
  }, [performScrollToBottom, showScrollToBottom, updateNearBottomState]);

  useEffect(() => {
    return () => {
      if (contentResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(contentResizeFrameRef.current);
      }
    };
  }, []);

  return {
    messagesContentRef,
    messagesEndRef,
    messagesContainerRef,
    showScrollToBottom,
    jumpToBottom,
    performScrollToBottom,
    autoScrollEnabledRef,
    isNearBottomRef,
  };
};
