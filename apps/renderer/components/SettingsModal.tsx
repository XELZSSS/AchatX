import React, { useEffect, useId, useState } from 'react';
import { Save, X } from 'lucide-react';
import { ProviderId, TavilyConfig } from '../types';
import { t } from '../utils/i18n';
import ProviderTab from './settingsModal/ProviderTab';
import SearchTab from './settingsModal/SearchTab';
import ShortcutsTab from './settingsModal/ShortcutsTab';
import { useSettingsController } from './settingsModal/useSettingsController';
import { ProviderSettingsMap, SaveSettingsPayload } from './settingsModal/types';
import { Button, Modal, Tabs } from './ui';
import {
  checkForUpdates,
  DEFAULT_UPDATER_STATUS,
  getUpdaterStatus,
  openUpdateDownload,
  subscribeUpdaterStatus,
} from '../services/updaterClient';
import type { UpdaterStatus } from '../services/updaterClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerSettings: ProviderSettingsMap;
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  onSave: (value: SaveSettingsPayload) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  providerSettings,
  providerId,
  modelName,
  apiKey,
  baseUrl,
  customHeaders,
  tavily,
  onSave,
}) => {
  const modalTitleId = useId();
  const tabsIdPrefix = useId();
  const [appVersion, setAppVersion] = useState<string>('');
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>(DEFAULT_UPDATER_STATUS);
  const updaterStatusTextMap: Partial<Record<UpdaterStatus['status'], string>> = {
    checking: t('settings.update.status.checking'),
    'not-available': t('settings.update.status.latest'),
    error: t('settings.update.status.failed'),
    disabled: t('settings.update.status.disabled'),
  };

  const {
    state,
    tabs,
    overlayRef,
    portalContainer,
    providerOptions,
    activeMeta,
    handleSave,
    onTabChange,
    providerActions,
    searchActions,
  } = useSettingsController({
    isOpen,
    onClose,
    onSave,
    providerSettings,
    providerId,
    modelName,
    apiKey,
    baseUrl,
    customHeaders,
    tavily,
  });

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadVersion = async () => {
      const version = await window.gero?.getAppVersion?.();
      if (active && version) {
        setAppVersion(version);
      }
    };
    const loadUpdaterStatus = async () => {
      const status = await getUpdaterStatus();
      if (active) setUpdaterStatus(status);
    };
    void loadVersion();
    void loadUpdaterStatus();
    const unsubscribe = subscribeUpdaterStatus((status) => {
      if (!active) return;
      setUpdaterStatus(status);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isOpen]);

  const handleCheckForUpdates = async () => {
    await checkForUpdates();
  };

  const handleOpenUpdateDownload = async () => {
    await openUpdateDownload();
  };

  const getUpdateStatusText = (): string => {
    if (updaterStatus.status === 'available') {
      return updaterStatus.availableVersion
        ? `${t('settings.update.status.availableVersionPrefix')} v${updaterStatus.availableVersion}${t('settings.update.status.availableVersionSuffix')}`
        : t('settings.update.status.available');
    }
    return updaterStatusTextMap[updaterStatus.status] ?? '';
  };

  return (
    <Modal
      isOpen={isOpen}
      className="max-w-2xl"
      overlayRef={overlayRef}
      onClose={onClose}
      ariaLabelledBy={modalTitleId}
    >
      <div className="w-full">
        <div className="flex items-center justify-between p-3 pb-2">
          <h2 id={modalTitleId} className="text-sm font-semibold text-[var(--ink-1)]">
            {t('settings.modal.title')}
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="!px-1.5 !py-1 !bg-transparent hover:!bg-[var(--bg-2)] text-[var(--ink-3)] hover:text-[var(--ink-1)]"
            aria-label={t('settings.modal.cancel')}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="flex h-[72vh] flex-col gap-4 overflow-hidden p-4 sm:flex-row">
          <Tabs
            items={tabs}
            activeId={state.activeTab}
            onChange={onTabChange}
            idPrefix={tabsIdPrefix}
          />

          <div
            className="flex-1 overflow-y-auto pl-2 pr-4 pt-1 sm:pl-4 sm:pr-6 sm:pt-2"
            role="tabpanel"
            id={`${tabsIdPrefix}-panel-${state.activeTab}`}
            aria-labelledby={`${tabsIdPrefix}-tab-${state.activeTab}`}
          >
            {state.activeTab === 'provider' && (
              <ProviderTab
                providerId={state.providerId}
                providerOptions={providerOptions}
                modelName={state.modelName}
                apiKey={state.apiKey}
                baseUrl={state.baseUrl}
                customHeaders={state.customHeaders}
                showApiKey={state.showApiKey}
                toolCallMaxRounds={state.toolCallMaxRounds}
                supportsBaseUrl={activeMeta?.supportsBaseUrl}
                supportsCustomHeaders={activeMeta?.supportsCustomHeaders}
                supportsRegion={activeMeta?.supportsRegion}
                portalContainer={portalContainer}
                onProviderChange={providerActions.onProviderChange}
                onModelNameChange={providerActions.onModelNameChange}
                onApiKeyChange={providerActions.onApiKeyChange}
                onToggleApiKeyVisibility={providerActions.onToggleApiKeyVisibility}
                onClearApiKey={providerActions.onClearApiKey}
                onToolCallMaxRoundsChange={providerActions.onToolCallMaxRoundsChange}
                onToolCallMaxRoundsBlur={providerActions.onToolCallMaxRoundsBlur}
                onBaseUrlChange={providerActions.onBaseUrlChange}
                onAddCustomHeader={providerActions.onAddCustomHeader}
                onSetCustomHeaderKey={providerActions.onSetCustomHeaderKey}
                onSetCustomHeaderValue={providerActions.onSetCustomHeaderValue}
                onRemoveCustomHeader={providerActions.onRemoveCustomHeader}
                onSetRegionBaseUrl={providerActions.onSetRegionBaseUrl}
              />
            )}

            {state.activeTab === 'search' && activeMeta?.supportsTavily && (
              <SearchTab
                tavily={state.tavily}
                showTavilyKey={state.showTavilyKey}
                portalContainer={portalContainer}
                onSetTavilyField={searchActions.onSetTavilyField}
                onToggleTavilyKeyVisibility={searchActions.onToggleTavilyKeyVisibility}
              />
            )}

            {state.activeTab === 'shortcuts' && <ShortcutsTab />}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-3 pt-2">
          <div className="mr-auto text-xs text-[var(--ink-3)]">{getUpdateStatusText()}</div>
          <Button
            onClick={handleCheckForUpdates}
            variant="ghost"
            size="sm"
            disabled={updaterStatus.status === 'checking'}
          >
            {t('settings.update.check')}
          </Button>
          {updaterStatus.status === 'available' && (
            <Button onClick={handleOpenUpdateDownload} variant="ghost" size="sm">
              {t('settings.update.download')}
            </Button>
          )}
          <div className="flex h-8 items-center text-xs text-[var(--ink-3)]">
            {appVersion ? `v${appVersion}` : ''}
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            {t('settings.modal.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Save size={14} />
            {t('settings.modal.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;