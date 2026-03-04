import React from 'react';
import { Button, Field, Toggle } from '../ui';
import { t } from '../../utils/i18n';

type VersionTabProps = {
  appVersion: string;
  updateStatusText: string;
  updaterStatus: 'checking' | 'available' | 'downloaded' | 'not-available' | 'error' | 'disabled';
  staticProxyHttp2Enabled: boolean;
  onCheckForUpdates: () => Promise<void>;
  onOpenUpdateDownload: () => Promise<void>;
  onSetStaticProxyHttp2Enabled: (enabled: boolean) => void;
};

const VersionTab: React.FC<VersionTabProps> = ({
  appVersion,
  updateStatusText,
  updaterStatus,
  staticProxyHttp2Enabled,
  onCheckForUpdates,
  onOpenUpdateDownload,
  onSetStaticProxyHttp2Enabled,
}) => {
  return (
    <div className="space-y-4">
      <Field label={t('settings.version.title')}>
        <div className="space-y-3">
          <div className="text-xs text-[var(--ink-2)]">
            {t('settings.version.current')}: {appVersion ? `v${appVersion}` : '-'}
          </div>
          <div className="text-xs text-[var(--ink-3)]">{updateStatusText}</div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void onCheckForUpdates()}
              variant="ghost"
              size="sm"
              disabled={updaterStatus === 'checking'}
            >
              {t('settings.update.check')}
            </Button>
            {updaterStatus === 'available' && (
              <Button onClick={() => void onOpenUpdateDownload()} variant="ghost" size="sm">
                {t('settings.update.download')}
              </Button>
            )}
          </div>
        </div>
      </Field>

      <Field label={t('settings.proxy.title')}>
        <label className="flex items-start gap-2 text-xs text-[var(--ink-3)]">
          <Toggle
            checked={staticProxyHttp2Enabled}
            onChange={(event) => onSetStaticProxyHttp2Enabled(event.target.checked)}
          />
          <span>
            {t('settings.proxy.staticHttp2')}
            <span className="mt-1 block text-[11px] text-[var(--ink-3)]">
              {t('settings.proxy.staticHttp2.help')}
            </span>
          </span>
        </label>
      </Field>
    </div>
  );
};

export default VersionTab;
