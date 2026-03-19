import { useCallback, useRef, useState } from 'react';
import { t } from '@/shared/utils/i18n';
import type { ProviderSettings } from '@/infrastructure/providers/defaults';
import type { useSettingsController } from '@/presentation/components/settingsModal/useSettingsController';
import { Button } from '@/shared/ui';
import { CloseIcon, SaveOutlinedIcon } from '@/shared/ui/icons';

const AUTHOR_NAME = 'XELZSSS';
const FOOTER_BUTTON_CLASS = 'inline-flex items-center justify-center';
const SAVE_BUTTON_CLASS = `${FOOTER_BUTTON_CLASS} gap-2`;
const HEADER_CLOSE_BUTTON_CLASS =
  'rounded-md bg-transparent p-0 text-[var(--ink-3)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]';

type UpdaterStatus = import('@/infrastructure/updater/updaterClient').UpdaterStatus;
type PassiveUpdaterStatus = Exclude<UpdaterStatus['status'], 'available'>;
type ClearCacheStatus = 'success' | 'error' | null;

type SettingsModalHeaderProps = {
  modalTitleId: string;
  onClose: () => void;
};

type SettingsModalFooterProps = {
  onOpenAuthorPage: () => void;
  onClose: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  saveHint: string;
};

type ValidationSummaryProps = {
  issues: Array<{ tab: string; field?: string; message: string }>;
  overflowCount: number;
};

export const getUpdateStatusText = (updaterStatus: UpdaterStatus): string => {
  const passiveStatusTextMap: Record<PassiveUpdaterStatus, string> = {
    idle: '',
    checking: t('settings.update.status.checking'),
    'not-available': t('settings.update.status.latest'),
    error: t('settings.update.status.failed'),
    disabled: t('settings.update.status.disabled'),
  };

  if (updaterStatus.status === 'available') {
    return updaterStatus.availableVersion
      ? `${t('settings.update.status.availableVersionPrefix')} v${updaterStatus.availableVersion}${t('settings.update.status.availableVersionSuffix')}`
      : t('settings.update.status.available');
  }

  return passiveStatusTextMap[updaterStatus.status];
};

export const getConfigTransferErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : t('settings.transfer.error.generic');

export const buildProviderSettingsFromModalState = (
  state: ReturnType<typeof useSettingsController>['state']['provider']
): ProviderSettings => ({
  apiKey: state.apiKey,
  modelName: state.modelName,
  requestMode: state.requestMode,
  baseUrl: state.baseUrl,
  geminiCliProjectId: state.geminiCliProjectId,
  googleCloudProject: state.googleCloudProject,
  customHeaders: state.customHeaders,
  tavily: state.tavily,
  embedding: state.embedding,
  chatAgentEnabled: state.chatAgentEnabled,
  chatAgentPrompt: state.chatAgentPrompt,
  chatAgentPromptParts: state.chatAgentPromptParts,
  chatAgentSearchEnabled: state.chatAgentSearchEnabled,
});

export const useClearCacheFeedback = () => {
  const [clearCacheNotice, setClearCacheNotice] = useState<string | null>(null);
  const [clearCacheStatus, setClearCacheStatus] = useState<ClearCacheStatus>(null);
  const resetTimerRef = useRef<number | null>(null);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setClearCacheNotice(null);
      setClearCacheStatus(null);
      resetTimerRef.current = null;
    }, 2500);
  }, []);

  const setFeedback = useCallback(
    (notice: string, status: Exclude<ClearCacheStatus, null>) => {
      setClearCacheNotice(notice);
      setClearCacheStatus(status);
      scheduleReset();
    },
    [scheduleReset]
  );

  return {
    clearCacheNotice,
    clearCacheStatus,
    showClearCacheSuccess: () => setFeedback(t('settings.clearCache.success'), 'success'),
    showClearCacheError: () => setFeedback(t('settings.clearCache.failed'), 'error'),
  };
};

export const SettingsModalHeader = ({ modalTitleId, onClose }: SettingsModalHeaderProps) => (
  <div className="flex items-center justify-between px-4 py-3">
    <h2
      id={modalTitleId}
      className="text-[13px] font-normal tracking-[-0.018em] text-[var(--ink-1)]"
    >
      {t('settings.modal.title')}
    </h2>
    <Button
      onClick={onClose}
      variant="ghost"
      size="icon"
      className={HEADER_CLOSE_BUTTON_CLASS}
      aria-label={t('settings.modal.cancel')}
    >
      <CloseIcon size={16} strokeWidth={2} />
    </Button>
  </div>
);

export const SettingsModalFooter = ({
  onOpenAuthorPage,
  onClose,
  onSave,
  saveDisabled,
  saveHint,
}: SettingsModalFooterProps) => (
  <div className="flex items-center justify-end gap-3 px-4 py-3">
    <div className="mr-auto text-[11px] tracking-[0.01em] text-[var(--ink-3)]">{saveHint}</div>
    <Button onClick={onOpenAuthorPage} variant="ghost" size="sm" className={FOOTER_BUTTON_CLASS}>
      {AUTHOR_NAME}
    </Button>
    <Button onClick={onClose} variant="ghost" size="sm" className={FOOTER_BUTTON_CLASS}>
      {t('settings.modal.cancel')}
    </Button>
    <Button
      onClick={onSave}
      variant="primary"
      size="sm"
      disabled={saveDisabled}
      title={saveDisabled ? saveHint : undefined}
      className={SAVE_BUTTON_CLASS}
    >
      <SaveOutlinedIcon size={14} strokeWidth={2} />
      {t('settings.modal.save')}
    </Button>
  </div>
);

export const SettingsValidationSummary = ({ issues, overflowCount }: ValidationSummaryProps) => (
  <div className="mx-4 rounded-md border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--ink-1)]">
    <div className="font-medium text-[var(--status-error)]">{t('settings.validation.error.title')}</div>
    <div className="mt-1 space-y-1 text-[var(--ink-2)]">
      {issues.map((issue) => (
        <div key={`${issue.tab}-${issue.field ?? 'tab'}-${issue.message}`}>{issue.message}</div>
      ))}
      {overflowCount > 0 ? (
        <div>{t('settings.validation.moreErrors').replace('{count}', String(overflowCount))}</div>
      ) : null}
    </div>
  </div>
);
