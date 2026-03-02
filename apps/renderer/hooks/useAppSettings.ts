import { Dispatch, SetStateAction, useCallback } from 'react';
import { ChatService } from '../services/chatService';
import { ProviderId } from '../types';
import { ProviderSettingsMap, SaveSettingsPayload } from '../services/settingsTypes';
import { Language, setLanguage, t } from '../utils/i18n';

type UseAppSettingsOptions = {
  chatService: ChatService;
  providerSettings: ProviderSettingsMap;
  currentProviderId: ProviderId;
  syncProviderState: () => void;
  setLanguageState: Dispatch<SetStateAction<Language>>;
  syncCurrentConversation: () => void;
};

export const useAppSettings = ({
  chatService,
  providerSettings,
  currentProviderId,
  syncProviderState,
  setLanguageState,
  syncCurrentConversation,
}: UseAppSettingsOptions) => {
  const syncTrayLabels = useCallback((language: Language) => {
    window.gero?.setTrayLanguage?.(language);
    window.gero?.setTrayLabels?.({
      open: t('tray.open'),
      hide: t('tray.hide'),
      toggleDevTools: t('tray.toggleDevTools'),
      quit: t('tray.quit'),
    });
  }, []);

  const handleSaveSettings = useCallback(
    (value: SaveSettingsPayload) => {
      chatService.setProvider(value.providerId);
      const updatedSettings = chatService.updateProviderSettings(value.providerId, {
        apiKey: value.apiKey,
        modelName: value.modelName,
        baseUrl: value.baseUrl,
        customHeaders: value.customHeaders,
        tavily: value.tavily,
      });
      syncProviderState();
      const prev = providerSettings[value.providerId];
      const shouldSyncConversation =
        value.providerId !== currentProviderId ||
        !prev ||
        prev.modelName !== updatedSettings.modelName ||
        (prev.apiKey ?? '') !== (updatedSettings.apiKey ?? '') ||
        (prev.baseUrl ?? '') !== (updatedSettings.baseUrl ?? '') ||
        JSON.stringify(prev.customHeaders ?? []) !==
          JSON.stringify(updatedSettings.customHeaders ?? []) ||
        JSON.stringify(prev.tavily ?? {}) !== JSON.stringify(updatedSettings.tavily ?? {});
      if (shouldSyncConversation) {
        syncCurrentConversation();
      }
    },
    [chatService, currentProviderId, providerSettings, syncCurrentConversation, syncProviderState]
  );

  const handleLanguageChange = useCallback(
    (nextLanguage: Language) => {
      setLanguage(nextLanguage);
      setLanguageState(nextLanguage);
      syncTrayLabels(nextLanguage);
    },
    [setLanguageState, syncTrayLabels]
  );

  return {
    syncTrayLabels,
    handleSaveSettings,
    handleLanguageChange,
  };
};
