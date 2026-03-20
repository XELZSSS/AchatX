import {
  readAppStorage,
  removeAppStorage,
  writeAppStorage,
} from '@/infrastructure/persistence/storageKeys';
import {
  TWEMOJI_CATALOG,
  type TwemojiEntry,
  type TwemojiGroup,
} from '@/shared/data/twemojiCatalog';
import { isEmojiCompositeGlyphSupported, isEmojiGlyphSupported } from '@/shared/utils/emojiSupport';

export const CONTAINER_CLASS = 'mx-auto w-full max-w-[min(64rem,100%)] px-4 pb-6';
export const INPUT_SHELL_CLASS =
  'relative flex items-center gap-1.5 rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] px-2 py-1.5';
export const TEXTAREA_CLASS =
  'w-full bg-transparent text-[var(--ink-1)] placeholder:text-[var(--ink-3)] text-sm leading-6 px-3 py-2 max-h-[150px] resize-none focus:outline-none scrollbar-hide';
export const ACTION_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]';
export const EMOJI_PICKER_CLASS =
  'fixed z-30 rounded-xl border border-[var(--line-1)] bg-[var(--bg-1)] p-2.5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] fx-panel-bloom';
export const EMOJI_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors duration-160 ease-out hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]';
export const EMOJI_TAB_CLASS =
  'h-7 rounded-md px-1 py-0.5 text-center text-[10px] leading-none whitespace-nowrap transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]';
export const ACTIVE_EMOJI_TAB_CLASS = 'bg-[var(--bg-2)] text-[var(--ink-1)]';
export const INACTIVE_EMOJI_TAB_CLASS =
  'text-[var(--ink-3)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]';
export const EMOJI_UTILITY_BUTTON_CLASS =
  'inline-flex items-center rounded-md px-2 py-1 text-[11px] text-[var(--ink-3)] transition-colors duration-160 ease-out hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]';
export const RECENT_EMOJIS_LIMIT = 16;
export const EMOJI_PICKER_GAP = 18;
export const EMOJI_PICKER_VIEWPORT_PADDING = 12;
export const EMOJI_PICKER_DEFAULT_WIDTH = 380;
export const EMOJI_PICKER_MIN_WIDTH = 320;
export const EMOJI_PICKER_FALLBACK_HEIGHT = 244;
export const EMOJI_GRID_COLUMNS = 8;
export const EMOJI_TAB_COLUMNS = 5;
export const DEFAULT_EMOJI_CATEGORY: TwemojiGroup = 'Smileys & Emotion';
export const TWEMOJI_GROUP_LABEL_KEYS: Record<TwemojiGroup, string> = {
  'Smileys & Emotion': 'input.emoji.category.smileys',
  'People & Body': 'input.emoji.category.people',
  'Animals & Nature': 'input.emoji.category.nature',
  'Food & Drink': 'input.emoji.category.food',
  'Travel & Places': 'input.emoji.category.travel',
  Activities: 'input.emoji.category.activities',
  Objects: 'input.emoji.category.objects',
  Symbols: 'input.emoji.category.symbols',
  Flags: 'input.emoji.category.flags',
};
export const TWEMOJI_BY_ID = new Map(TWEMOJI_CATALOG.map((entry) => [entry.id, entry]));

export type EmojiCategoryId = 'recent' | TwemojiGroup;
export type EmojiPickerPosition = {
  top: number;
  left: number;
  width: number;
};
export type RecentEmojiStat = {
  id: string;
  count: number;
  lastUsedAt: number;
};

type SessionDraftMap = Record<string, string>;

const parseSessionDraftMap = (value: string | null): SessionDraftMap | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    );
  } catch {
    return null;
  }
};

export const readSessionDraft = (sessionId: string): string => {
  const stored = readAppStorage('inputDraft');
  const drafts = parseSessionDraftMap(stored);
  return drafts?.[sessionId] ?? '';
};

export const writeSessionDraft = (sessionId: string, value: string): void => {
  const drafts = parseSessionDraftMap(readAppStorage('inputDraft')) ?? {};
  const nextValue = value.trim().length > 0 ? value : '';
  if (nextValue) {
    drafts[sessionId] = value;
  } else {
    delete drafts[sessionId];
  }
  if (Object.keys(drafts).length === 0) {
    removeAppStorage('inputDraft');
    return;
  }
  writeAppStorage('inputDraft', JSON.stringify(drafts));
};

export const sortRecentEmojiStats = (stats: RecentEmojiStat[]): RecentEmojiStat[] =>
  [...stats]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return right.lastUsedAt - left.lastUsedAt;
    })
    .slice(0, RECENT_EMOJIS_LIMIT);

export const parseRecentEmojiStats = (value: string | null): RecentEmojiStat[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed.filter((item): item is RecentEmojiStat => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RecentEmojiStat).id === 'string' &&
        TWEMOJI_BY_ID.has((item as RecentEmojiStat).id) &&
        Number.isFinite((item as RecentEmojiStat).count) &&
        Number.isFinite((item as RecentEmojiStat).lastUsedAt)
      );
    });
    return sortRecentEmojiStats(
      sanitized.map((item) => ({
        id: item.id,
        count: Math.max(1, Math.floor(item.count)),
        lastUsedAt: Math.max(0, Math.floor(item.lastUsedAt)),
      }))
    );
  } catch {
    return [];
  }
};

export const readPersistedRecentEmojiStats = (): RecentEmojiStat[] =>
  parseRecentEmojiStats(readAppStorage('recentEmojis'));

export const getInitialEmojiCategory = (recentEmojiStats: RecentEmojiStat[]): EmojiCategoryId =>
  recentEmojiStats.length > 0 ? 'recent' : DEFAULT_EMOJI_CATEGORY;

export const getSupportedEmojiCatalog = (): TwemojiEntry[] => {
  const filteredCatalog = TWEMOJI_CATALOG.filter(
    (entry) => isEmojiGlyphSupported(entry.glyph) && isEmojiCompositeGlyphSupported(entry.glyph)
  );
  return filteredCatalog.length > 0 ? filteredCatalog : TWEMOJI_CATALOG;
};

export const buildNextRecentEmojiStats = (
  recentEmojiStats: RecentEmojiStat[],
  entry: TwemojiEntry
): RecentEmojiStat[] => {
  const now = Date.now();
  const current = recentEmojiStats.find((item) => item.id === entry.id);
  const rest = recentEmojiStats.filter((item) => item.id !== entry.id);
  return [{ id: entry.id, count: (current?.count ?? 0) + 1, lastUsedAt: now }, ...rest];
};

export const matchesEmojiSearch = (entry: TwemojiEntry, normalizedSearchTerm: string): boolean =>
  entry.glyph.includes(normalizedSearchTerm) ||
  entry.label.toLowerCase().includes(normalizedSearchTerm) ||
  entry.unicode.toLowerCase().includes(normalizedSearchTerm) ||
  entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedSearchTerm));

export const getEmojiTooltip = (entry: TwemojiEntry): string => entry.label;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getFocusablePickerElements = (
  container: HTMLDivElement | null
): Array<HTMLInputElement | HTMLButtonElement> => {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input:not([disabled]), button:not([disabled])'
    )
  );
};
