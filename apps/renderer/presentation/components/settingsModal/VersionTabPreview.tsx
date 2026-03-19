import { Button } from '@/shared/ui';
import { t } from '@/shared/utils/i18n';
import type { SettingsImportPreview } from '@/application/settings/settingsTransfer';
import { SettingsCard, SettingsHint } from '@/presentation/components/settingsModal/formParts';

export const NOTICE_CLASS_BY_STATUS = {
  info: 'border-[var(--line-1)] bg-[var(--bg-2)] text-[var(--ink-1)]',
  success: 'border-[var(--status-success)]/40 bg-[var(--status-success)]/15 text-[var(--ink-1)]',
  error: 'border-[var(--status-error)]/40 bg-[var(--status-error)]/15 text-[var(--ink-1)]',
} as const;

export type ConfigTransferNotice = {
  status: 'info' | 'success' | 'error';
  message: string;
};

type ConfigTransferPreviewCardProps = {
  preview: SettingsImportPreview;
  busy: boolean;
  lockedReason?: string | null;
  onApplyImportMerge: () => void;
  onApplyImportReplace: () => void;
  onCancel: () => void;
};

const formatPreviewDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatPreferenceLabel = (value: string | undefined): string => {
  if (value === 'system') return t('language.system');
  if (value === 'en') return t('language.en');
  if (value === 'zh-CN') return t('language.zhCN');
  if (value === 'light') return t('theme.light');
  if (value === 'dark') return t('theme.dark');
  return value ?? '-';
};

export const ConfigTransferPreviewCard = ({
  preview,
  busy,
  lockedReason,
  onApplyImportMerge,
  onApplyImportReplace,
  onCancel,
}: ConfigTransferPreviewCardProps) => {
  const actionsDisabled = busy || !!lockedReason;

  return (
    <SettingsCard className="space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-medium text-[var(--ink-1)]">{preview.fileName}</div>
        <div className="text-[11px] text-[var(--ink-3)]">
          {t('settings.transfer.preview.exportedAt')}: {formatPreviewDate(preview.exportedAt)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-[11px] text-[var(--ink-2)]">
          <div>
            {t('settings.transfer.preview.providerCount')}: {preview.providerCount}
          </div>
          <div>
            {t('settings.transfer.preview.activeProvider')}: {preview.appSettings.activeProviderId ?? '-'}
          </div>
          <div>
            {t('settings.transfer.preview.language')}:{' '}
            {formatPreferenceLabel(preview.appSettings.languagePreference)}
          </div>
          <div>
            {t('settings.transfer.preview.theme')}:{' '}
            {formatPreferenceLabel(preview.appSettings.themePreference)}
          </div>
        </div>

        <div className="space-y-1 text-[11px] text-[var(--ink-2)]">
          <div>
            {t('settings.transfer.preview.includesSecrets')}:{' '}
            {preview.includesSecrets
              ? t('settings.transfer.value.yes')
              : t('settings.transfer.value.no')}
          </div>
          <div>
            {t('settings.transfer.preview.toolCallRounds')}: {preview.appSettings.toolCallMaxRounds ?? '-'}
          </div>
          <div>
            {t('settings.transfer.preview.allowHttpTargets')}:{' '}
            {preview.appSettings.allowHttpTargets === undefined
              ? '-'
              : preview.appSettings.allowHttpTargets
                ? t('settings.transfer.value.enabled')
                : t('settings.transfer.value.disabled')}
          </div>
        </div>
      </div>

      <SettingsHint>
        {preview.includesSecrets
          ? t('settings.transfer.preview.secretWarning')
          : t('settings.transfer.preview.secretFreeWarning')}
      </SettingsHint>

      <div className="text-[11px] text-[var(--ink-3)]">
        {preview.providerIds.length > 0
          ? preview.providerIds.join(', ')
          : t('settings.transfer.preview.noProviders')}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onApplyImportMerge}
          disabled={actionsDisabled}
          title={lockedReason ?? undefined}
        >
          {t('settings.transfer.import.merge')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onApplyImportReplace}
          disabled={actionsDisabled}
          title={lockedReason ?? undefined}
        >
          {t('settings.transfer.import.replace')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {t('settings.transfer.import.cancel')}
        </Button>
      </div>
    </SettingsCard>
  );
};
