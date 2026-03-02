import React from 'react';
import { t } from '../../utils/i18n';

type ShortcutItem = {
  keys: string[];
  description: string;
};

const shortcutItems = (): ShortcutItem[] => [
  { keys: ['Enter'], description: t('settings.modal.shortcuts.sendOrGenerate') },
  { keys: ['Shift', 'Enter'], description: t('settings.modal.shortcuts.newLine') },
  { keys: ['Esc'], description: t('settings.modal.shortcuts.closeSettings') },
  { keys: ['Arrow', 'Home', 'End'], description: t('settings.modal.shortcuts.switchTabs') },
  { keys: ['Arrow', 'Enter'], description: t('settings.modal.shortcuts.selectDropdown') },
];

const KeyCaps: React.FC<{ keys: string[] }> = ({ keys }) => (
  <div className="flex flex-wrap items-center gap-1">
    {keys.map((key, index) => (
      <React.Fragment key={`${key}-${index}`}>
        <kbd className="rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] px-2 py-1 text-[11px] font-medium text-[var(--ink-2)]">
          {key}
        </kbd>
        {index < keys.length - 1 && (
          <span className="text-[10px] text-[var(--ink-3)]" aria-hidden="true">
            +
          </span>
        )}
      </React.Fragment>
    ))}
  </div>
);

const ShortcutsTab: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-[var(--ink-2)]">
          {t('settings.modal.shortcuts.title')}
        </h3>
        <p className="text-xs text-[var(--ink-3)]">{t('settings.modal.shortcuts.hint')}</p>
      </div>

      <div className="space-y-2">
        {shortcutItems().map((item) => (
          <div
            key={`${item.keys.join('-')}-${item.description}`}
            className="flex flex-col gap-1 rounded-lg border border-[var(--line-1)] bg-[var(--bg-2)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <KeyCaps keys={item.keys} />
            <div className="text-xs text-[var(--ink-2)]">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShortcutsTab;