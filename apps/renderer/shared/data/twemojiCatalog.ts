import twemojiActivitiesJson from '@/shared/data/twemojiCatalog.activities.json';
import twemojiFlagsJson from '@/shared/data/twemojiCatalog.flags.json';
import twemojiFoodJson from '@/shared/data/twemojiCatalog.food.json';
import twemojiNatureJson from '@/shared/data/twemojiCatalog.nature.json';
import twemojiObjectsJson from '@/shared/data/twemojiCatalog.objects.json';
import twemojiPeopleJson from '@/shared/data/twemojiCatalog.people.json';
import twemojiSmileysJson from '@/shared/data/twemojiCatalog.smileys.json';
import twemojiSymbolsJson from '@/shared/data/twemojiCatalog.symbols.json';
import twemojiTravelJson from '@/shared/data/twemojiCatalog.travel.json';

export type TwemojiGroup =
  | 'Smileys & Emotion'
  | 'People & Body'
  | 'Animals & Nature'
  | 'Food & Drink'
  | 'Travel & Places'
  | 'Activities'
  | 'Objects'
  | 'Symbols'
  | 'Flags';

export type TwemojiEntry = {
  id: string;
  unicode: string;
  glyph: string;
  label: string;
  group: TwemojiGroup;
  keywords: string[];
  hasSkinTones: boolean;
};

const RAW_TWEMOJI_CATALOG = [
  ...twemojiSmileysJson,
  ...twemojiPeopleJson,
  ...twemojiNatureJson,
  ...twemojiFoodJson,
  ...twemojiTravelJson,
  ...twemojiActivitiesJson,
  ...twemojiObjectsJson,
  ...twemojiSymbolsJson,
  ...twemojiFlagsJson,
] as TwemojiEntry[];

const isPickerSafeTwemojiEntry = (entry: TwemojiEntry): boolean => {
  if (entry.group !== 'People & Body') {
    return true;
  }

  return !entry.glyph.includes('\u200d') && !/facing right/i.test(entry.label) && !entry.glyph.includes('➡');
};

const deduplicateTwemojiEntries = (entries: TwemojiEntry[]): TwemojiEntry[] => {
  const seenGlyphs = new Set<string>();
  return entries.filter((entry) => {
    if (seenGlyphs.has(entry.glyph)) {
      return false;
    }
    seenGlyphs.add(entry.glyph);
    return true;
  });
};

export const TWEMOJI_CATALOG = deduplicateTwemojiEntries(
  RAW_TWEMOJI_CATALOG.filter(isPickerSafeTwemojiEntry)
);

export const TWEMOJI_GROUP_ORDER = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
] as const satisfies readonly TwemojiGroup[];

export const TWEMOJI_BY_GROUP = new Map<TwemojiGroup, TwemojiEntry[]>(
  TWEMOJI_GROUP_ORDER.map((group) => [
    group,
    TWEMOJI_CATALOG.filter((entry) => entry.group === group),
  ])
);
