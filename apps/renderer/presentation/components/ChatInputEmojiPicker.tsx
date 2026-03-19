import { createPortal } from 'react-dom';
import type { ChangeEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';
import { t } from '@/shared/utils/i18n';
import type { TwemojiEntry } from '@/shared/data/twemojiCatalog';
import { Input } from '@/shared/ui';
import { CloseIcon, SearchIcon } from '@/shared/ui/icons';
import {
  ACTIVE_EMOJI_TAB_CLASS,
  EMOJI_BUTTON_CLASS,
  EMOJI_PICKER_CLASS,
  EMOJI_PICKER_DEFAULT_WIDTH,
  EMOJI_PICKER_MIN_WIDTH,
  EMOJI_PICKER_VIEWPORT_PADDING,
  EMOJI_TAB_CLASS,
  EMOJI_UTILITY_BUTTON_CLASS,
  INACTIVE_EMOJI_TAB_CLASS,
  clamp,
  getEmojiTooltip,
  type EmojiCategoryId,
  type EmojiPickerPosition,
} from '@/presentation/components/chatInputHelpers';
import { TwemojiPickerGlyph } from '@/presentation/components/chatInputParts';

type EmojiCategory = {
  id: EmojiCategoryId;
  label: string;
  emojis: readonly TwemojiEntry[];
};

type DisplayedEmojiGroup = {
  id: string;
  label: string;
  emojis: readonly TwemojiEntry[];
};

type ChatInputEmojiPickerProps = {
  isOpen: boolean;
  pickerRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  gridScrollRef: RefObject<HTMLDivElement | null>;
  categoryButtonRefs: RefObject<Record<EmojiCategoryId, HTMLButtonElement | null>>;
  emojiOptionRefs: RefObject<Array<HTMLButtonElement | null>>;
  position: EmojiPickerPosition | null;
  searchTerm: string;
  normalizedSearchTerm: string;
  activeCategory: EmojiCategoryId;
  categories: EmojiCategory[];
  recentEmojiEntries: TwemojiEntry[];
  displayedEmojiGroup: DisplayedEmojiGroup;
  displayedEmojiGroupKey: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSearchClear: () => void;
  onMouseDownPreserveFocus: (event: MouseEvent<HTMLButtonElement>) => void;
  onClearRecentEmojis: () => void;
  onSelectCategory: (categoryId: EmojiCategoryId) => void;
  onInsertEmoji: (entry: TwemojiEntry) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

const getPickerWidth = (position: EmojiPickerPosition | null) =>
  position?.width ??
  clamp(
    Math.min(EMOJI_PICKER_DEFAULT_WIDTH, window.innerWidth - EMOJI_PICKER_VIEWPORT_PADDING * 2),
    EMOJI_PICKER_MIN_WIDTH,
    EMOJI_PICKER_DEFAULT_WIDTH
  );

export const ChatInputEmojiPicker = ({
  isOpen,
  pickerRef,
  searchInputRef,
  gridScrollRef,
  categoryButtonRefs,
  emojiOptionRefs,
  position,
  searchTerm,
  normalizedSearchTerm,
  activeCategory,
  categories,
  recentEmojiEntries,
  displayedEmojiGroup,
  displayedEmojiGroupKey,
  onSearchChange,
  onSearchClear,
  onMouseDownPreserveFocus,
  onClearRecentEmojis,
  onSelectCategory,
  onInsertEmoji,
  onKeyDown,
}: ChatInputEmojiPickerProps) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      id="chat-input-emoji-picker"
      ref={pickerRef}
      className={EMOJI_PICKER_CLASS}
      style={{
        top: position?.top ?? EMOJI_PICKER_VIEWPORT_PADDING,
        left: position?.left ?? EMOJI_PICKER_VIEWPORT_PADDING,
        width: getPickerWidth(position),
        opacity: position ? 1 : 0,
        pointerEvents: position ? 'auto' : 'none',
      }}
      role="dialog"
      aria-label={t('input.emoji.picker')}
      onKeyDown={onKeyDown}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
            size={16}
            strokeWidth={2}
          />
          <Input
            ref={searchInputRef}
            compact
            value={searchTerm}
            onChange={onSearchChange}
            placeholder={t('input.emoji.searchPlaceholder')}
            className="w-full pl-8 pr-8 text-xs"
            aria-label={t('input.emoji.searchPlaceholder')}
          />
          {searchTerm ? (
            <button
              type="button"
              onMouseDown={onMouseDownPreserveFocus}
              onClick={onSearchClear}
              className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-3)] transition-colors duration-160 ease-out hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]"
              aria-label={t('input.emoji.searchClear')}
              title={t('input.emoji.searchClear')}
            >
              <CloseIcon size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {!normalizedSearchTerm && activeCategory === 'recent' && recentEmojiEntries.length > 0 ? (
          <button
            type="button"
            className={EMOJI_UTILITY_BUTTON_CLASS}
            onMouseDown={onMouseDownPreserveFocus}
            onClick={onClearRecentEmojis}
          >
            {t('input.emoji.clearRecent')}
          </button>
        ) : null}
      </div>

      <div className="mb-2 grid grid-cols-5 gap-1">
        {categories.map((category) => (
          <button
            key={category.id}
            ref={(node) => {
              categoryButtonRefs.current[category.id] = node;
            }}
            type="button"
            className={`${EMOJI_TAB_CLASS} ${
              category.id === activeCategory ? ACTIVE_EMOJI_TAB_CLASS : INACTIVE_EMOJI_TAB_CLASS
            }`}
            onMouseDown={onMouseDownPreserveFocus}
            onClick={() => onSelectCategory(category.id)}
            aria-pressed={category.id === activeCategory}
            data-emoji-category-id={category.id}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div key={displayedEmojiGroupKey} className="fx-content-soft-swap">
        {displayedEmojiGroup.emojis.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-[var(--ink-3)]">
            {normalizedSearchTerm ? t('input.emoji.emptySearch') : t('input.emoji.emptyRecent')}
          </div>
        ) : (
          <div
            ref={gridScrollRef}
            className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto scrollbar-hide"
          >
            {displayedEmojiGroup.emojis.map((entry, index) => (
              <button
                key={`${displayedEmojiGroup.id}-${entry.id}`}
                ref={(node) => {
                  emojiOptionRefs.current[index] = node;
                }}
                type="button"
                className={EMOJI_BUTTON_CLASS}
                onMouseDown={onMouseDownPreserveFocus}
                onClick={() => onInsertEmoji(entry)}
                aria-label={getEmojiTooltip(entry)}
                title={getEmojiTooltip(entry)}
                data-emoji-index={index}
              >
                <TwemojiPickerGlyph entry={entry} />
                <span className="sr-only">{entry.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 h-4 rounded-b-xl bg-gradient-to-t from-[var(--bg-1)] to-transparent opacity-70" />
      <div className="sr-only">{displayedEmojiGroup.label}</div>
    </div>,
    document.body
  );
};
