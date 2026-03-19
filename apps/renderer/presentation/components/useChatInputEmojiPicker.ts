import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { removeAppStorage, writeAppStorage } from '@/infrastructure/persistence/storageKeys';
import {
  TWEMOJI_GROUP_ORDER,
  type TwemojiEntry,
  type TwemojiGroup,
} from '@/shared/data/twemojiCatalog';
import {
  EMOJI_PICKER_DEFAULT_WIDTH,
  EMOJI_PICKER_FALLBACK_HEIGHT,
  EMOJI_PICKER_GAP,
  EMOJI_PICKER_MIN_WIDTH,
  EMOJI_PICKER_VIEWPORT_PADDING,
  buildNextRecentEmojiStats,
  clamp,
  getInitialEmojiCategory,
  getSupportedEmojiCatalog,
  readPersistedRecentEmojiStats,
  sortRecentEmojiStats,
  type EmojiCategoryId,
  type EmojiPickerPosition,
  type RecentEmojiStat,
} from '@/presentation/components/chatInputHelpers';
import { t } from '@/shared/utils/i18n';
import { buildChatInputEmojiData } from '@/presentation/components/chatInputEmojiData';
import { useChatInputEmojiDismiss } from '@/presentation/components/useChatInputEmojiDismiss';
import { useChatInputEmojiNavigation } from '@/presentation/components/useChatInputEmojiNavigation';

type UseChatInputEmojiPickerOptions = {
  input: string;
  setInput: (value: string) => void;
  persistDraft: (value: string) => void;
  isInputDisabled: boolean;
};

export const useChatInputEmojiPicker = ({
  input,
  setInput,
  persistDraft,
  isInputDisabled,
}: UseChatInputEmojiPickerOptions) => {
  const [supportedEmojiCatalog] = useState<TwemojiEntry[]>(getSupportedEmojiCatalog);
  const [recentEmojiStats, setRecentEmojiStats] = useState<RecentEmojiStat[]>(
    readPersistedRecentEmojiStats
  );
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<EmojiCategoryId>(() =>
    getInitialEmojiCategory(readPersistedRecentEmojiStats())
  );
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<EmojiPickerPosition | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiSearchTerm, setEmojiSearchTerm] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const supportedEmojiIds = new Set(supportedEmojiCatalog.map((entry) => entry.id));
  const supportedEmojisByGroup = new Map<TwemojiGroup, TwemojiEntry[]>(
    TWEMOJI_GROUP_ORDER.map((group) => [
      group,
      supportedEmojiCatalog.filter((entry) => entry.group === group),
    ])
  );

  const closeEmojiPicker = useCallback(() => {
    setIsEmojiPickerOpen(false);
    setEmojiPickerPosition(null);
    setEmojiSearchTerm('');
  }, []);

  const handleDraftRestored = useCallback(
    (nextDraft: string) => {
      selectionRef.current = { start: nextDraft.length, end: nextDraft.length };
      closeEmojiPicker();
    },
    [closeEmojiPicker]
  );
  useChatInputEmojiDismiss({
    isInputDisabled,
    isEmojiPickerOpen,
    closeEmojiPicker,
    textareaRef,
    emojiButtonRef,
    emojiPickerRef,
  });

  const updateEmojiPickerPosition = useCallback(() => {
    const button = emojiButtonRef.current;
    if (!button) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const pickerRect = emojiPickerRef.current?.getBoundingClientRect();
    const width = clamp(
      Math.min(EMOJI_PICKER_DEFAULT_WIDTH, window.innerWidth - EMOJI_PICKER_VIEWPORT_PADDING * 2),
      EMOJI_PICKER_MIN_WIDTH,
      EMOJI_PICKER_DEFAULT_WIDTH
    );
    const height = Math.round(pickerRect?.height ?? EMOJI_PICKER_FALLBACK_HEIGHT);
    const maxLeft = Math.max(
      EMOJI_PICKER_VIEWPORT_PADDING,
      window.innerWidth - width - EMOJI_PICKER_VIEWPORT_PADDING
    );
    const maxTop = Math.max(
      EMOJI_PICKER_VIEWPORT_PADDING,
      window.innerHeight - height - EMOJI_PICKER_VIEWPORT_PADDING
    );
    const left = clamp(buttonRect.right - width, EMOJI_PICKER_VIEWPORT_PADDING, maxLeft);
    const spaceAbove = buttonRect.top - EMOJI_PICKER_VIEWPORT_PADDING;
    const spaceBelow = window.innerHeight - buttonRect.bottom - EMOJI_PICKER_VIEWPORT_PADDING;
    const preferOpenUp = spaceAbove >= height + EMOJI_PICKER_GAP || spaceAbove >= spaceBelow;
    const top = preferOpenUp
      ? clamp(buttonRect.top - height - EMOJI_PICKER_GAP, EMOJI_PICKER_VIEWPORT_PADDING, maxTop)
      : clamp(buttonRect.bottom + EMOJI_PICKER_GAP, EMOJI_PICKER_VIEWPORT_PADDING, maxTop);

    setEmojiPickerPosition((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === width
        ? prev
        : { top, left, width }
    );
  }, []);

  const {
    recentEmojiEntries,
    emojiCategories,
    normalizedEmojiSearchTerm,
    displayedEmojiGroup,
    displayedEmojiGroupKey,
  } = buildChatInputEmojiData({
    supportedEmojiCatalog,
    supportedEmojisByGroup,
    supportedEmojiIds,
    recentEmojiStats,
    activeEmojiCategory,
    emojiSearchTerm,
  });

  const {
    emojiGridScrollRef,
    emojiSearchInputRef,
    categoryButtonRefs,
    emojiOptionRefs,
    handleEmojiPickerKeyDown,
  } = useChatInputEmojiNavigation({
    isEmojiPickerOpen,
    activeEmojiCategory,
    emojiCategories,
    displayedEmojiGroup,
    displayedEmojiGroupKey,
    normalizedEmojiSearchTerm,
    emojiPickerRef,
    onSelectCategory: setActiveEmojiCategory,
  });

  useLayoutEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }
    updateEmojiPickerPosition();
  }, [
    activeEmojiCategory,
    emojiSearchTerm,
    isEmojiPickerOpen,
    recentEmojiStats.length,
    updateEmojiPickerPosition,
  ]);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    let frameId = 0;
    const schedulePositionUpdate = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateEmojiPickerPosition();
      });
    };
    const handleWindowScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && emojiPickerRef.current?.contains(target)) {
        return;
      }
      schedulePositionUpdate();
    };

    schedulePositionUpdate();
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', handleWindowScroll, { capture: true, passive: true });
    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', handleWindowScroll, true);
    };
  }, [isEmojiPickerOpen, updateEmojiPickerPosition]);

  const syncSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    selectionRef.current = {
      start: textarea.selectionStart ?? textarea.value.length,
      end: textarea.selectionEnd ?? textarea.value.length,
    };
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setInput(newValue);
      selectionRef.current = {
        start: event.target.selectionStart ?? newValue.length,
        end: event.target.selectionEnd ?? newValue.length,
      };
      persistDraft(newValue);
    },
    [persistDraft, setInput]
  );

  const handleEmojiButtonMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      syncSelection();
    },
    [syncSelection]
  );

  const handleEmojiPickerToggle = useCallback(() => {
    if (isInputDisabled) {
      return;
    }
    setIsEmojiPickerOpen((prev) => {
      const nextOpen = !prev;
      setEmojiPickerPosition(null);
      if (nextOpen) {
        setActiveEmojiCategory(getInitialEmojiCategory(recentEmojiStats));
      }
      return nextOpen;
    });
  }, [isInputDisabled, recentEmojiStats]);

  const persistRecentEmojiStats = useCallback((nextRecentEmojiStats: RecentEmojiStat[]) => {
    const sortedStats = sortRecentEmojiStats(nextRecentEmojiStats);
    setRecentEmojiStats(sortedStats);
    writeAppStorage('recentEmojis', JSON.stringify(sortedStats));
  }, []);

  const handleClearRecentEmojis = useCallback(() => {
    persistRecentEmojiStats([]);
    removeAppStorage('recentEmojis');
  }, [persistRecentEmojiStats]);

  const handleEmojiInsert = useCallback(
    (entry: TwemojiEntry) => {
      const selectionStart = selectionRef.current.start;
      const selectionEnd = selectionRef.current.end;
      const fallbackPosition = input.length;
      const start = Number.isFinite(selectionStart) ? selectionStart : fallbackPosition;
      const end = Number.isFinite(selectionEnd) ? selectionEnd : start;
      const nextValue = `${input.slice(0, start)}${entry.glyph}${input.slice(end)}`;
      const nextCaretPosition = start + entry.glyph.length;

      setInput(nextValue);
      persistDraft(nextValue);
      persistRecentEmojiStats(buildNextRecentEmojiStats(recentEmojiStats, entry));
      selectionRef.current = { start: nextCaretPosition, end: nextCaretPosition };
      closeEmojiPicker();

      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });
    },
    [closeEmojiPicker, input, persistDraft, persistRecentEmojiStats, recentEmojiStats, setInput]
  );

  return {
    textareaRef,
    emojiButtonRef,
    isEmojiPickerOpen,
    handleDraftRestored,
    handleInputChange,
    syncSelection,
    handleEmojiButtonMouseDown,
    handleEmojiPickerToggle,
    emojiButtonToneClass: isEmojiPickerOpen
      ? 'text-[var(--ink-1)]'
      : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]',
    emojiToggleLabel: isEmojiPickerOpen ? t('input.emoji.close') : t('input.emoji.open'),
    emojiPickerProps: {
      isOpen: isEmojiPickerOpen,
      pickerRef: emojiPickerRef,
      searchInputRef: emojiSearchInputRef,
      gridScrollRef: emojiGridScrollRef,
      categoryButtonRefs,
      emojiOptionRefs,
      position: emojiPickerPosition,
      searchTerm: emojiSearchTerm,
      normalizedSearchTerm: normalizedEmojiSearchTerm,
      activeCategory: activeEmojiCategory,
      categories: emojiCategories,
      recentEmojiEntries,
      displayedEmojiGroup,
      displayedEmojiGroupKey,
      onSearchChange: (event: ChangeEvent<HTMLInputElement>) => setEmojiSearchTerm(event.target.value),
      onSearchClear: () => setEmojiSearchTerm(''),
      onMouseDownPreserveFocus: handleEmojiButtonMouseDown,
      onClearRecentEmojis: handleClearRecentEmojis,
      onSelectCategory: setActiveEmojiCategory,
      onInsertEmoji: handleEmojiInsert,
      onKeyDown: handleEmojiPickerKeyDown,
    },
  };
};
