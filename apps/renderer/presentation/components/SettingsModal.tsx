import { useCallback, useId, useMemo, useState } from 'react';
import { GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import { t, type Language, type LanguagePreference } from '@/shared/utils/i18n';
import type { AccentPreference, Theme, ThemePreference } from '@/shared/utils/theme';
import { useSettingsController } from '@/presentation/components/settingsModal/useSettingsController';
import {
  ProviderSettingsMap,
  SaveSettingsPayload,
} from '@/presentation/components/settingsModal/types';
import { ConfirmDialog, Modal, Tabs } from '@/shared/ui';
import {
  buildResolvedAppSettingsSnapshot,
  type AppliedSettingsImport,
} from '@/application/settings/settingsTransfer';
import { normalizeProviderSettingsRecord } from '@/infrastructure/persistence/providerSettingsStore';
import { checkForUpdates, openUpdateDownload } from '@/infrastructure/updater/updaterClient';
import {
  SettingsModalFooter,
  SettingsModalHeader,
  SettingsValidationSummary,
  buildProviderSettingsFromModalState,
  getUpdateStatusText,
  useClearCacheFeedback,
} from '@/presentation/components/settingsModal/SettingsModalParts';
import { SettingsModalTabContent } from '@/presentation/components/settingsModal/SettingsModalTabContent';
import { useSettingsClearCache } from '@/presentation/components/settingsModal/useSettingsClearCache';
import { useSettingsTransfer } from '@/presentation/components/settingsModal/useSettingsTransfer';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerSettings: ProviderSettingsMap;
  providerId: ProviderId;
  modelName: string;
  currentConversationModelName: string;
  apiKey: string;
  requestMode?: OpenAIRequestMode;
  language: Language;
  languagePreference: LanguagePreference;
  theme: Theme;
  themePreference: ThemePreference;
  accentPreference: AccentPreference;
  baseUrl?: string;
  geminiCliProjectId?: string;
  googleCloudProject?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  embedding?: GeminiEmbeddingConfig;
  chatAgentEnabled?: boolean;
  chatAgentPrompt?: string;
  chatAgentPromptParts?: { identity: string; role: string; setting: string };
  chatAgentSearchEnabled?: boolean;
  onSave: (value: SaveSettingsPayload) => void;
  onImportSettings: (value: AppliedSettingsImport) => void;
  appVersion: string;
  updaterStatus: import('@/infrastructure/updater/updaterClient').UpdaterStatus;
  interactionLockReason?: string | null;
}

const AUTHOR_URL = 'https://github.com/XELZSSS';
const SettingsModal = ({
  isOpen,
  onClose,
  providerSettings,
  providerId,
  modelName,
  currentConversationModelName,
  apiKey,
  requestMode,
  language,
  languagePreference,
  theme,
  themePreference,
  accentPreference,
  baseUrl,
  geminiCliProjectId,
  googleCloudProject,
  customHeaders,
  tavily,
  embedding,
  chatAgentEnabled,
  chatAgentPrompt,
  chatAgentPromptParts,
  chatAgentSearchEnabled,
  onSave,
  onImportSettings,
  appVersion,
  updaterStatus,
  interactionLockReason = null,
}: SettingsModalProps) => {
  const modalTitleId = useId();
  const tabsIdPrefix = useId();
  const controller = useSettingsController({
    isOpen,
    onClose,
    onSave,
    providerSettings,
    providerId,
    modelName,
    apiKey,
    requestMode,
    languagePreference,
    themePreference,
    accentPreference,
    baseUrl,
    geminiCliProjectId,
    googleCloudProject,
    customHeaders,
    tavily,
    embedding,
    chatAgentEnabled,
    chatAgentPrompt,
    chatAgentPromptParts,
    chatAgentSearchEnabled,
    saveBlockedReason: interactionLockReason,
  });

  const {
    state,
    tabs,
    activeMeta,
    providerOptions,
    validation,
    isDirty,
    handleSave,
    requestClose,
    showDiscardChangesPrompt,
    confirmDiscardChanges,
    cancelDiscardChanges,
    showValidationSummary,
    onTabChange,
  } = controller;

  const handleCheckForUpdates = useCallback(() => checkForUpdates(), []);
  const handleOpenUpdateDownload = useCallback(() => openUpdateDownload(), []);
  const handleOpenAuthorPage = useCallback(async () => {
    if (typeof window !== 'undefined' && window.orlinx?.openExternal) {
      await window.orlinx.openExternal(AUTHOR_URL);
      return;
    }
    window.open(AUTHOR_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const { clearCacheNotice, clearCacheStatus, showClearCacheSuccess, showClearCacheError } =
    useClearCacheFeedback();
  const [includeSecretsInExport, setIncludeSecretsInExport] = useState(false);
  const {
    clearCacheConfirmDescription,
    isClearCacheConfirmOpen,
    handleOpenClearCacheConfirm,
    handleCancelClearCache,
    handleConfirmClearCache,
  } = useSettingsClearCache({
    distribution: updaterStatus.distribution,
    interactionLockReason,
    showClearCacheSuccess,
    showClearCacheError,
  });
  const updateStatusText = getUpdateStatusText(updaterStatus);
  const currentAppSettings = useMemo(
    () => buildResolvedAppSettingsSnapshot({ ...state.app }),
    [state.app]
  );
  const effectiveProviderSettings = useMemo(
    () =>
      normalizeProviderSettingsRecord({
        ...providerSettings,
        [state.provider.providerId]: buildProviderSettingsFromModalState(state.provider),
      }),
    [providerSettings, state.provider]
  );
  const saveDisabled = !isDirty || !!interactionLockReason;
  const saveHint =
    interactionLockReason ?? (isDirty ? t('settings.modal.info') : t('settings.modal.noChanges'));
  const validationSummary = validation.errors.slice(0, 3);
  const validationOverflowCount = Math.max(validation.errors.length - validationSummary.length, 0);
  const {
    configTransferBusy,
    configTransferNotice,
    pendingImport,
    handleApplyImportedSettings,
    handleCancelImportPreview,
    handleExportSettings,
    handleOpenImportSettings,
  } = useSettingsTransfer({
    isOpen,
    appSettings: currentAppSettings,
    providerSettings: effectiveProviderSettings,
    includeSecretsInExport,
    interactionLockReason,
    onImportSettings,
  });
  return (
    <>
      <Modal
        isOpen={isOpen}
        title={t('settings.modal.title')}
        className="max-w-[min(64rem,calc(100vw-2rem))]"
        onClose={requestClose}
      >
        <div className="w-full">
          <SettingsModalHeader modalTitleId={modalTitleId} onClose={requestClose} />
          {showValidationSummary && validationSummary.length > 0 ? (
            <SettingsValidationSummary
              issues={validationSummary}
              overflowCount={validationOverflowCount}
            />
          ) : null}
          <div className="flex h-[76vh] min-h-0 flex-col gap-4 overflow-hidden px-4 py-3 sm:flex-row">
            <Tabs
              items={tabs}
              activeId={state.ui.activeTab}
              onChange={onTabChange}
              idPrefix={tabsIdPrefix}
              className="border-0 sm:border-r-0 sm:pr-2"
            />
            <div
              className="settings-modal-scroll-panel settings-modal-scrollbar-hide min-h-0 min-w-0 flex-1 overflow-y-auto pl-1 pr-2 pt-1 sm:pl-4 sm:pr-5 sm:pt-1"
              role="tabpanel"
              id={`${tabsIdPrefix}-panel-${state.ui.activeTab}`}
              aria-labelledby={`${tabsIdPrefix}-tab-${state.ui.activeTab}`}
            >
              <SettingsModalTabContent
                controller={controller}
                activeMeta={activeMeta}
                providerOptions={providerOptions}
                language={language}
                theme={theme}
                accentPreference={state.app.accentPreference}
                currentConversationModelName={currentConversationModelName}
                appVersion={appVersion}
                updaterStatus={updaterStatus}
                updateStatusText={updateStatusText}
                includeSecretsInExport={includeSecretsInExport}
                configTransferBusy={configTransferBusy}
                configTransferNotice={configTransferNotice}
                pendingImportPreview={pendingImport?.preview ?? null}
                interactionLockReason={interactionLockReason}
                clearCacheNotice={clearCacheNotice}
                clearCacheStatus={clearCacheStatus}
                onCheckForUpdates={handleCheckForUpdates}
                onOpenUpdateDownload={handleOpenUpdateDownload}
                onExportSettings={handleExportSettings}
                onOpenImportSettings={handleOpenImportSettings}
                onApplyImportMerge={() => handleApplyImportedSettings('merge')}
                onApplyImportReplace={() => handleApplyImportedSettings('replace')}
                onCancelImportPreview={handleCancelImportPreview}
                onOpenClearCache={handleOpenClearCacheConfirm}
                onSetIncludeSecretsInExport={setIncludeSecretsInExport}
              />
            </div>
          </div>
          <SettingsModalFooter
            onOpenAuthorPage={handleOpenAuthorPage}
            onClose={requestClose}
            onSave={handleSave}
            saveDisabled={saveDisabled}
            saveHint={saveHint}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDiscardChangesPrompt}
        showOverlay={false}
        title={t('settings.modal.unsaved.title')}
        description={t('settings.modal.unsaved.description')}
        confirmLabel={t('settings.modal.unsaved.confirm')}
        cancelLabel={t('settings.modal.cancel')}
        onConfirm={confirmDiscardChanges}
        onCancel={cancelDiscardChanges}
      />

      <ConfirmDialog
        isOpen={isOpen && isClearCacheConfirmOpen}
        showOverlay={false}
        title={t('settings.clearCache.cardTitle')}
        description={clearCacheConfirmDescription}
        confirmLabel={t('settings.clearCache.confirmAction')}
        cancelLabel={t('settings.modal.cancel')}
        onConfirm={handleConfirmClearCache}
        onCancel={handleCancelClearCache}
        danger
      />
    </>
  );
};

export default SettingsModal;

