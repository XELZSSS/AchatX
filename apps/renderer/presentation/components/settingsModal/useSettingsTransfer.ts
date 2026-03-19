import { useCallback, useEffect, useState } from 'react';
import { t } from '@/shared/utils/i18n';
import {
  applyParsedSettingsImport,
  createSettingsExportContent,
  parseSettingsImport,
  type AppliedSettingsImport,
  type ParsedSettingsImport,
} from '@/application/settings/settingsTransfer';
import { getConfigTransferErrorMessage } from '@/presentation/components/settingsModal/SettingsModalParts';
import type { ConfigTransferNotice } from '@/presentation/components/settingsModal/VersionTabPreview';

type UseSettingsTransferProps = {
  isOpen: boolean;
  appSettings: ReturnType<typeof import('@/application/settings/settingsTransfer').buildResolvedAppSettingsSnapshot>;
  providerSettings: Record<string, import('@/infrastructure/providers/defaults').ProviderSettings>;
  includeSecretsInExport: boolean;
  interactionLockReason: string | null;
  onImportSettings: (value: AppliedSettingsImport) => void;
};

export const useSettingsTransfer = ({
  isOpen,
  appSettings,
  providerSettings,
  includeSecretsInExport,
  interactionLockReason,
  onImportSettings,
}: UseSettingsTransferProps) => {
  const [configTransferBusy, setConfigTransferBusy] = useState(false);
  const [configTransferNotice, setConfigTransferNotice] = useState<ConfigTransferNotice | null>(null);
  const [pendingImport, setPendingImport] = useState<ParsedSettingsImport | null>(null);

  useEffect(() => {
    if (isOpen) return;
    setConfigTransferBusy(false);
    setConfigTransferNotice(null);
    setPendingImport(null);
  }, [isOpen]);

  const handleExportSettings = useCallback(async () => {
    setConfigTransferBusy(true);
    setConfigTransferNotice(null);
    try {
      if (!window.axchat?.exportSettingsTransfer) {
        throw new Error(t('settings.transfer.error.generic'));
      }
      const contents = createSettingsExportContent({
        appSettings,
        providerSettings,
        includeSecrets: includeSecretsInExport,
      });
      const result = await window.axchat.exportSettingsTransfer({ contents });
      if (!result?.canceled) {
        setConfigTransferNotice({ status: 'success', message: t('settings.transfer.export.success') });
      }
    } catch (error) {
      setConfigTransferNotice({ status: 'error', message: getConfigTransferErrorMessage(error) });
    } finally {
      setConfigTransferBusy(false);
    }
  }, [appSettings, includeSecretsInExport, providerSettings]);

  const handleOpenImportSettings = useCallback(async () => {
    setConfigTransferBusy(true);
    setConfigTransferNotice(null);
    try {
      if (!window.axchat?.importSettingsTransfer) {
        throw new Error(t('settings.transfer.error.generic'));
      }
      const result = await window.axchat.importSettingsTransfer();
      if (!result || result.canceled) {
        return;
      }
      const contents = typeof result.contents === 'string' ? result.contents : '';
      const fileName = result.fileName ?? t('settings.transfer.import.unknownFile');
      setPendingImport(parseSettingsImport({ fileName, contents }));
      setConfigTransferNotice({ status: 'info', message: t('settings.transfer.import.previewReady') });
    } catch (error) {
      setPendingImport(null);
      setConfigTransferNotice({ status: 'error', message: getConfigTransferErrorMessage(error) });
    } finally {
      setConfigTransferBusy(false);
    }
  }, []);

  const handleApplyImportedSettings = useCallback(
    async (mode: 'merge' | 'replace') => {
      if (!pendingImport) return;
      if (interactionLockReason) {
        setConfigTransferNotice({ status: 'error', message: interactionLockReason });
        return;
      }
      setConfigTransferBusy(true);
      setConfigTransferNotice(null);
      try {
        const appliedSettings = applyParsedSettingsImport({
          mode,
          imported: pendingImport,
          currentAppSettings: appSettings,
          currentProviderSettings: providerSettings,
        });
        onImportSettings(appliedSettings);
        setPendingImport(null);
        setConfigTransferNotice({
          status: 'success',
          message:
            mode === 'merge'
              ? t('settings.transfer.import.mergeSuccess')
              : t('settings.transfer.import.replaceSuccess'),
        });
      } catch (error) {
        setConfigTransferNotice({ status: 'error', message: getConfigTransferErrorMessage(error) });
      } finally {
        setConfigTransferBusy(false);
      }
    },
    [appSettings, interactionLockReason, onImportSettings, pendingImport, providerSettings]
  );

  const handleCancelImportPreview = useCallback(() => {
    setPendingImport(null);
    setConfigTransferNotice(null);
  }, []);

  return {
    configTransferBusy,
    configTransferNotice,
    pendingImport,
    handleApplyImportedSettings,
    handleCancelImportPreview,
    handleExportSettings,
    handleOpenImportSettings,
  };
};
