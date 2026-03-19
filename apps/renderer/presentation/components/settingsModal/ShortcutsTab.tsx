import { Fragment, memo } from 'react';
import { t } from '@/shared/utils/i18n';

type ShortcutItem = {
  keys: string[];
  description: string;
};

const KEY_CAPS_CLASS = 'flex flex-wrap items-center gap-1';
const KEY_CAP_CLASS =
  'rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] px-2 py-1 text-[11px] font-medium text-[var(--ink-2)]';
const KEY_JOINER_CLASS = 'text-[10px] text-[var(--ink-3)]';
const SHORTCUT_CARD_CLASS =
  'flex flex-col gap-1 rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between';

const getShortcutItems = (): ShortcutItem[] => [
  { keys: ['Enter'], description: t('settings.modal.shortcuts.sendOrGenerate') },
  { keys: ['Shift', 'Enter'], description: t('settings.modal.shortcuts.newLine') },
  { keys: ['Esc'], description: t('settings.modal.shortcuts.closeSettings') },
  { keys: ['Arrow', 'Home', 'End'], description: t('settings.modal.shortcuts.switchTabs') },
  { keys: ['Arrow', 'Enter'], description: t('settings.modal.shortcuts.selectDropdown') },
];

const KeyCaps = ({ keys }: { keys: string[] }) => (
  <div className={KEY_CAPS_CLASS}>
    {keys.map((key, index) => (
      <Fragment key={`${key}-${index}`}>
        <kbd className={KEY_CAP_CLASS}>{key}</kbd>
        {index < keys.length - 1 && (
          <span className={KEY_JOINER_CLASS} aria-hidden="true">
            +
          </span>
        )}
      </Fragment>
    ))}
  </div>
);

const ShortcutRow = ({ item }: { item: ShortcutItem }) => (
  <div className={SHORTCUT_CARD_CLASS}>
    <KeyCaps keys={item.keys} />
    <div className="text-xs text-[var(--ink-2)]">{item.description}</div>
  </div>
);

const ShortcutsTab = () => {
  const items = getShortcutItems();

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {items.map((item) => (
          <ShortcutRow key={`${item.keys.join('-')}-${item.description}`} item={item} />
        ))}
      </div>
    </div>
  );
};

export default memo(ShortcutsTab);
