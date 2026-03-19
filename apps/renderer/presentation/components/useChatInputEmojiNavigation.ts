import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import {
  EMOJI_GRID_COLUMNS,
  clamp,
  getFocusablePickerElements,
  type EmojiCategoryId,
} from '@/presentation/components/chatInputHelpers';

type EmojiCategory = {
  id: EmojiCategoryId;
};

type DisplayedEmojiGroup = {
  emojis: readonly unknown[];
};

type UseChatInputEmojiNavigationOptions = {
  isEmojiPickerOpen: boolean;
  activeEmojiCategory: EmojiCategoryId;
  emojiCategories: EmojiCategory[];
  displayedEmojiGroup: DisplayedEmojiGroup;
  displayedEmojiGroupKey: string;
  normalizedEmojiSearchTerm: string;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onSelectCategory: (categoryId: EmojiCategoryId) => void;
};

export const useChatInputEmojiNavigation = ({
  isEmojiPickerOpen,
  activeEmojiCategory,
  emojiCategories,
  displayedEmojiGroup,
  displayedEmojiGroupKey,
  normalizedEmojiSearchTerm,
  emojiPickerRef,
  onSelectCategory,
}: UseChatInputEmojiNavigationOptions) => {
  const emojiGridScrollRef = useRef<HTMLDivElement>(null);
  const emojiSearchInputRef = useRef<HTMLInputElement>(null);
  const categoryButtonRefs = useRef<Record<EmojiCategoryId, HTMLButtonElement | null>>({
    recent: null,
    'Smileys & Emotion': null,
    'People & Body': null,
    'Animals & Nature': null,
    'Food & Drink': null,
    'Travel & Places': null,
    Activities: null,
    Objects: null,
    Symbols: null,
    Flags: null,
  });
  const emojiOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusEmojiCategoryButton = useCallback((categoryId: EmojiCategoryId) => {
    categoryButtonRefs.current[categoryId]?.focus();
  }, []);

  const focusEmojiSearchInput = useCallback(() => {
    emojiSearchInputRef.current?.focus();
  }, []);

  const focusEmojiOption = useCallback(
    (index: number) => {
      const nextIndex = clamp(index, 0, displayedEmojiGroup.emojis.length - 1);
      window.requestAnimationFrame(() => {
        const target = emojiOptionRefs.current[nextIndex];
        if (!target) {
          return;
        }
        target.focus();
        target.scrollIntoView({ block: 'nearest' });
      });
    },
    [displayedEmojiGroup.emojis.length]
  );

  useEffect(() => {
    emojiOptionRefs.current = emojiOptionRefs.current.slice(0, displayedEmojiGroup.emojis.length);
  }, [displayedEmojiGroup.emojis.length]);

  useLayoutEffect(() => {
    if (isEmojiPickerOpen) {
      emojiGridScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [displayedEmojiGroupKey, isEmojiPickerOpen]);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      focusEmojiSearchInput();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusEmojiSearchInput, isEmojiPickerOpen]);

  const handleEmojiPickerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (event.key === 'Tab') {
        const focusableElements = getFocusablePickerElements(emojiPickerRef.current);
        if (focusableElements.length === 0) {
          return;
        }
        const currentIndex = focusableElements.indexOf(target as HTMLInputElement | HTMLButtonElement);
        const nextIndex = event.shiftKey
          ? (currentIndex - 1 + focusableElements.length) % focusableElements.length
          : (currentIndex + 1) % focusableElements.length;
        event.preventDefault();
        focusableElements[nextIndex]?.focus();
        return;
      }

      if (target instanceof HTMLInputElement) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (displayedEmojiGroup.emojis.length > 0) {
            window.requestAnimationFrame(() => focusEmojiOption(0));
          } else {
            focusEmojiCategoryButton(activeEmojiCategory);
          }
        }
        return;
      }

      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const categoryIndex = emojiCategories.findIndex((category) => category.id === activeEmojiCategory);
      const targetCategoryId = target.dataset.emojiCategoryId as EmojiCategoryId | undefined;
      const emojiIndex = Number.parseInt(target.dataset.emojiIndex ?? '-1', 10);

      if (targetCategoryId) {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          const nextCategory =
            emojiCategories[(categoryIndex + direction + emojiCategories.length) % emojiCategories.length];
          onSelectCategory(nextCategory.id);
          focusEmojiCategoryButton(nextCategory.id);
          return;
        }
        if (event.key === 'ArrowDown' && displayedEmojiGroup.emojis.length > 0) {
          event.preventDefault();
          window.requestAnimationFrame(() => focusEmojiOption(0));
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusEmojiSearchInput();
        }
        return;
      }

      if (Number.isNaN(emojiIndex) || emojiIndex < 0) {
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (emojiIndex < EMOJI_GRID_COLUMNS) {
          if (normalizedEmojiSearchTerm) {
            focusEmojiSearchInput();
          } else {
            focusEmojiCategoryButton(activeEmojiCategory);
          }
          return;
        }
        focusEmojiOption(emojiIndex - EMOJI_GRID_COLUMNS);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusEmojiOption(
          Math.min(emojiIndex + EMOJI_GRID_COLUMNS, displayedEmojiGroup.emojis.length - 1)
        );
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const atEdge =
          event.key === 'ArrowLeft'
            ? emojiIndex === 0
            : emojiIndex === displayedEmojiGroup.emojis.length - 1;
        const nextIndex = atEdge
          ? event.key === 'ArrowLeft'
            ? displayedEmojiGroup.emojis.length - 1
            : 0
          : emojiIndex + (event.key === 'ArrowLeft' ? -1 : 1);
        focusEmojiOption(nextIndex);
      }
    },
    [
      activeEmojiCategory,
      displayedEmojiGroup.emojis.length,
      emojiCategories,
      emojiPickerRef,
      focusEmojiCategoryButton,
      focusEmojiOption,
      focusEmojiSearchInput,
      normalizedEmojiSearchTerm,
      onSelectCategory,
    ]
  );

  return {
    emojiGridScrollRef,
    emojiSearchInputRef,
    categoryButtonRefs,
    emojiOptionRefs,
    handleEmojiPickerKeyDown,
  };
};
