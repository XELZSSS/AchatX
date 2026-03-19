import { useCallback, useMemo } from 'react';
import { Button, Field } from '@/shared/ui';
import { t } from '@/shared/utils/i18n';
import type { SettingsImportPreview } from '@/application/settings/settingsTransfer';
import {
  SettingsCard,
  SettingsHint,
  SettingsToggleRow,
} from '@/presentation/components/settingsModal/formParts';
import {
  ConfigTransferPreviewCard,
  NOTICE_CLASS_BY_STATUS,
  type ConfigTransferNotice,
} from '@/presentation/components/settingsModal/VersionTabPreview';

type VersionTabProps = {
  appVersion: string;
  updateStatusText: string;
  updaterStatus:
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloaded'
    | 'not-available'
    | 'error'
    | 'disabled';
  allowHttpTargets: boolean;
  includeSecretsInExport: boolean;
  configTransferBusy: boolean;
  configTransferNotice?: ConfigTransferNotice | null;
  importPreview?: SettingsImportPreview | null;
  mutationsLockedReason?: string | null;
  onCheckForUpdates: () => Promise<void>;
  onOpenUpdateDownload: () => Promise<void>;
  onSetAllowHttpTargets: (enabled: boolean) => void;
  onSetIncludeSecretsInExport: (enabled: boolean) => void;
  onExportSettings: () => Promise<void>;
  onOpenImportSettings: () => Promise<void>;
  onApplyImportMerge: () => Promise<void>;
  onApplyImportReplace: () => Promise<void>;
  onCancelImportPreview: () => void;
  onOpenClearCache: () => void;
  clearCacheNotice?: string | null;
  clearCacheStatus?: 'success' | 'error' | null;
};

const VersionTab = ({
  appVersion,
  updateStatusText,
  updaterStatus,
  allowHttpTargets,
  includeSecretsInExport,
  configTransferBusy,
  configTransferNotice,
  importPreview,
  mutationsLockedReason,
  onCheckForUpdates,
  onOpenUpdateDownload,
  onSetAllowHttpTargets,
  onSetIncludeSecretsInExport,
  onExportSettings,
  onOpenImportSettings,
  onApplyImportMerge,
  onApplyImportReplace,
  onCancelImportPreview,
  onOpenClearCache,
  clearCacheNotice,
  clearCacheStatus,
}: VersionTabProps) => {
  const currentVersionLabel = useMemo(() => (appVersion ? `v${appVersion}` : '-'), [appVersion]);
  const handleCheckUpdates = useCallback(() => {
    void onCheckForUpdates();
  }, [onCheckForUpdates]);
  const handleOpenDownload = useCallback(() => {
    void onOpenUpdateDownload();
  }, [onOpenUpdateDownload]);
  const handleAllowHttpTargetsChange = useCallback(
    (checked: boolean) => onSetAllowHttpTargets(checked),
    [onSetAllowHttpTargets]
  );
  const handleIncludeSecretsChange = useCallback(
    (checked: boolean) => onSetIncludeSecretsInExport(checked),
    [onSetIncludeSecretsInExport]
  );
  const handleExportSettings = useCallback(() => {
    void onExportSettings();
  }, [onExportSettings]);
  const handleOpenImportSettings = useCallback(() => {
    void onOpenImportSettings();
  }, [onOpenImportSettings]);
  const handleApplyImportMerge = useCallback(() => {
    void onApplyImportMerge();
  }, [onApplyImportMerge]);
  const handleApplyImportReplace = useCallback(() => {
    void onApplyImportReplace();
  }, [onApplyImportReplace]);
  const clearCacheNoticeClass =
    clearCacheStatus === 'success' ? NOTICE_CLASS_BY_STATUS.success : NOTICE_CLASS_BY_STATUS.error;
  const configTransferNoticeClass = configTransferNotice
    ? NOTICE_CLASS_BY_STATUS[configTransferNotice.status]
    : NOTICE_CLASS_BY_STATUS.info;

  return (
    <div className="space-y-5">
      <Field label={t('settings.version.title')}>
        <SettingsCard className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="text-xs font-medium text-[var(--ink-2)]">{currentVersionLabel}</div>
            {updateStatusText ? (
              <div className="text-xs text-[var(--ink-3)]">{updateStatusText}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleCheckUpdates}
              variant="ghost"
              size="sm"
              disabled={updaterStatus === 'checking'}
            >
              {t('settings.update.check')}
            </Button>
            {updaterStatus === 'available' && (
              <Button onClick={handleOpenDownload} variant="ghost" size="sm">
                {t('settings.update.download')}
              </Button>
            )}
          </div>
        </SettingsCard>
      </Field>

      <Field label={t('settings.transfer.title')}>
        <div className="space-y-3">
          <SettingsCard className="space-y-4">
            {mutationsLockedReason ? (
              <div
                className={`rounded-md border px-2 py-1 text-[11px] ${NOTICE_CLASS_BY_STATUS.info}`}
              >
                {mutationsLockedReason}
              </div>
            ) : null}

            {configTransferNotice ? (
              <div
                className={`rounded-md border px-2 py-1 text-[11px] ${configTransferNoticeClass}`}
              >
                {configTransferNotice.message}
              </div>
            ) : null}

            <SettingsToggleRow
              checked={includeSecretsInExport}
              title={t('settings.transfer.export.includeSecrets')}
              disabled={configTransferBusy}
              onCheckedChange={handleIncludeSecretsChange}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportSettings}
                disabled={configTransferBusy}
              >
                {t('settings.transfer.export.action')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenImportSettings}
                disabled={configTransferBusy}
              >
                {t('settings.transfer.import.action')}
              </Button>
            </div>
          </SettingsCard>

          {importPreview ? (
            <ConfigTransferPreviewCard
              preview={importPreview}
              busy={configTransferBusy}
              lockedReason={mutationsLockedReason}
              onApplyImportMerge={handleApplyImportMerge}
              onApplyImportReplace={handleApplyImportReplace}
              onCancel={onCancelImportPreview}
            />
          ) : null}
        </div>
      </Field>

      <Field label={t('settings.clearCache.title')}>
        <SettingsCard className="space-y-3">
          {clearCacheNotice && (
            <div className={`rounded-md border px-2 py-1 text-[11px] ${clearCacheNoticeClass}`}>
              {clearCacheNotice}
            </div>
          )}
          <SettingsHint>{t('settings.clearCache.description')}</SettingsHint>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={onOpenClearCache}
              disabled={!!mutationsLockedReason}
              title={mutationsLockedReason ?? undefined}
            >
              {t('settings.clearCache.confirmAction')}
            </Button>
          </div>
        </SettingsCard>
      </Field>

      <Field label={t('settings.proxy.title')}>
        <SettingsCard className="space-y-4">
          <SettingsToggleRow
            checked={allowHttpTargets}
            title={t('settings.proxy.allowHttpTargets')}
            onCheckedChange={handleAllowHttpTargetsChange}
          />
        </SettingsCard>
      </Field>
    </div>
  );
};

export default VersionTab;
