import {
  TWEMOJI_GROUP_ORDER,
  type TwemojiEntry,
  type TwemojiGroup,
} from '@/shared/data/twemojiCatalog';
import {
  TWEMOJI_BY_ID,
  TWEMOJI_GROUP_LABEL_KEYS,
  matchesEmojiSearch,
  type EmojiCategoryId,
  type RecentEmojiStat,
} from '@/presentation/components/chatInputHelpers';
import { t } from '@/shared/utils/i18n';

type BuildChatInputEmojiDataOptions = {
  supportedEmojiCatalog: TwemojiEntry[];
  supportedEmojisByGroup: Map<TwemojiGroup, TwemojiEntry[]>;
  supportedEmojiIds: Set<string>;
  recentEmojiStats: RecentEmojiStat[];
  activeEmojiCategory: EmojiCategoryId;
  emojiSearchTerm: string;
};

export const buildChatInputEmojiData = ({
  supportedEmojiCatalog,
  supportedEmojisByGroup,
  supportedEmojiIds,
  recentEmojiStats,
  activeEmojiCategory,
  emojiSearchTerm,
}: BuildChatInputEmojiDataOptions) => {
  const recentEmojiEntries = recentEmojiStats
    .map((item) => TWEMOJI_BY_ID.get(item.id))
    .filter((entry): entry is TwemojiEntry => !!entry && supportedEmojiIds.has(entry.id));

  const emojiCategories = [
    {
      id: 'recent',
      label: t('input.emoji.category.recent'),
      emojis: recentEmojiEntries,
    },
    ...TWEMOJI_GROUP_ORDER.map((group) => ({
      id: group,
      label: t(TWEMOJI_GROUP_LABEL_KEYS[group]),
      emojis: supportedEmojisByGroup.get(group) ?? [],
    })),
  ] satisfies Array<{ id: EmojiCategoryId; label: string; emojis: readonly TwemojiEntry[] }>;

  const activeEmojiGroup =
    emojiCategories.find((category) => category.id === activeEmojiCategory) ?? emojiCategories[0];
  const normalizedEmojiSearchTerm = emojiSearchTerm.trim().toLowerCase();
  const searchedEmojis = normalizedEmojiSearchTerm
    ? supportedEmojiCatalog.filter((entry) => matchesEmojiSearch(entry, normalizedEmojiSearchTerm))
    : [];
  const displayedEmojiGroup = normalizedEmojiSearchTerm
    ? { id: 'search' as const, label: t('input.emoji.searchResults'), emojis: searchedEmojis }
    : activeEmojiGroup;

  return {
    recentEmojiEntries,
    emojiCategories,
    normalizedEmojiSearchTerm,
    displayedEmojiGroup,
    displayedEmojiGroupKey: `${activeEmojiCategory}:${normalizedEmojiSearchTerm}`,
  };
};
