import { useCallback, useEffect, useState } from 'react';
import type { Language } from '@/shared/utils/i18n';
import { t } from '@/shared/utils/i18n';
import ButtonPrimitive from '@/shared/ui/primitives/button';

type WindowControlType = 'min' | 'max' | 'close';

const WinIcon = ({ type }: { type: WindowControlType }) => {
  switch (type) {
    case 'min':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="1" y="5" width="8" height="1" fill="currentColor" />
        </svg>
      );
    case 'max':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect
            x="1.5"
            y="1.5"
            width="7"
            height="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      );
    default:
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
  }
};

const isElectron = typeof window !== 'undefined' && !!window.axchat;
const BUTTON_CLASS =
  'titlebar-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]';

type TitleBarControl = {
  key: WindowControlType;
  label: string;
  className: string;
  onClick: () => void;
};

const renderWindowIcon = (type: WindowControlType) => <WinIcon type={type} />;

const TitleBar = ({ language }: { language: Language }) => {
  const [maximized, setMaximized] = useState(false);
  const maximizeLabel = maximized ? t('titlebar.restore') : t('titlebar.maximize');

  const handleMinimize = useCallback(() => window.axchat?.minimize(), []);
  const handleToggleMaximize = useCallback(() => window.axchat?.toggleMaximize(), []);
  const handleClose = useCallback(() => window.axchat?.close(), []);
  const controls: TitleBarControl[] = [
    {
      key: 'min',
      label: t('titlebar.minimize'),
      className: BUTTON_CLASS,
      onClick: handleMinimize,
    },
    {
      key: 'max',
      label: maximizeLabel,
      className: BUTTON_CLASS,
      onClick: handleToggleMaximize,
    },
    {
      key: 'close',
      label: t('titlebar.close'),
      className: `${BUTTON_CLASS} titlebar-btn-close`,
      onClick: handleClose,
    },
  ] as const;

  useEffect(() => {
    if (!isElectron || !window.axchat) return;
    let cleanup: (() => void) | undefined;
    void window.axchat.isMaximized().then((value) => setMaximized(value));
    cleanup = window.axchat.onMaximizeChanged((value) => setMaximized(value));
    return () => cleanup?.();
  }, []);

  if (!isElectron) return null;

  return (
    <div className="titlebar" data-language={language}>
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        {controls.map((control) => (
          <ButtonPrimitive
            key={control.key}
            className={control.className}
            onClick={control.onClick}
            aria-label={control.label}
            title={control.label}
          >
            {renderWindowIcon(control.key)}
            {control.key === 'max' && <span className="sr-only">{control.label}</span>}
          </ButtonPrimitive>
        ))}
      </div>
    </div>
  );
};

export default TitleBar;
