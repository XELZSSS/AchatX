import { Dispatch, SetStateAction, useCallback } from 'react';
import { ChatService } from '@/application/chat/chatService';
import { ProviderId } from '@/shared/types/chat';
import { ProviderSettingsMap, SaveSettingsPayload } from '@/application/settings/settingsTypes';
import { Language, LanguagePreference, setLanguagePreference, t } from '@/shared/utils/i18n';
import { Theme, ThemePreference, setThemePreference } from '@/shared/utils/theme';
import { persistAppSettings } from '@/infrastructure/persistence/appSettingsStore';
import type { AppliedSettingsImport } from '@/application/settings/settingsTransfer';
import type { ProviderSettings } from '@/infrastructure/providers/defaults';

type UseAppSettingsOptions = {
  chatService: ChatService;
  providerSettings: ProviderSettingsMap;
  currentProviderId: ProviderId;
  syncProviderState: () => void;
  setLanguagePreferenceState: Dispatch<SetStateAction<LanguagePreference>>;
  setLanguageState: Dispatch<SetStateAction<Language>>;
  setThemePreferenceState: Dispatch<SetStateAction<ThemePreference>>;
  setThemeState: Dispatch<SetStateAction<Theme>>;
  commitCurrentSession: (options?: { force?: boolean }) => void;
  startNewChat: () => void;
};

const haveConversationSettingsChanged = (
  previousSettings: ProviderSettings | undefined,
  nextSettings: ProviderSettings
): boolean => {
  if (!previousSettings) {
    return true;
  }

  return (
    previousSettings.modelName !== nextSettings.modelName ||
    previousSettings.requestMode !== nextSettings.requestMode ||
    (previousSettings.apiKey ?? '') !== (nextSettings.apiKey ?? '') ||
    (previousSettings.baseUrl ?? '') !== (nextSettings.baseUrl ?? '') ||
    (previousSettings.geminiCliProjectId ?? '') !== (nextSettings.geminiCliProjectId ?? '') ||
    (previousSettings.googleCloudProject ?? '') !== (nextSettings.googleCloudProject ?? '') ||
    JSON.stringify(previousSettings.customHeaders ?? []) !==
      JSON.stringify(nextSettings.customHeaders ?? []) ||
    JSON.stringify(previousSettings.tavily ?? {}) !== JSON.stringify(nextSettings.tavily ?? {}) ||
    JSON.stringify(previousSettings.embedding ?? {}) !==
      JSON.stringify(nextSettings.embedding ?? {}) ||
    Boolean(previousSettings.chatAgentEnabled) !== Boolean(nextSettings.chatAgentEnabled) ||
    (previousSettings.chatAgentPrompt ?? '') !== (nextSettings.chatAgentPrompt ?? '') ||
    Boolean(previousSettings.chatAgentSearchEnabled) !==
      Boolean(nextSettings.chatAgentSearchEnabled)
  );
};

export const useAppSettings = ({
  chatService,
  providerSettings,
  currentProviderId,
  syncProviderState,
  setLanguagePreferenceState,
  setLanguageState,
  setThemePreferenceState,
  setThemeState,
  commitCurrentSession,
  startNewChat,
}: UseAppSettingsOptions) => {
  const syncTrayLabels = useCallback((language: Language) => {
    void window.axchat?.setTrayLanguage?.(language);
    void window.axchat?.setTrayLabels?.({
      open: t('tray.open'),
      hide: t('tray.hide'),
      toggleDevTools: t('tray.toggleDevTools'),
      quit: t('tray.quit'),
    });
  }, []);

  const handleSaveSettings = useCallback(
    (value: SaveSettingsPayload) => {
      const resolvedLanguage = setLanguagePreference(value.app.languagePreference);
      const resolvedTheme = setThemePreference(value.app.themePreference);
      setLanguagePreferenceState(value.app.languagePreference);
      setLanguageState(resolvedLanguage);
      setThemePreferenceState(value.app.themePreference);
      setThemeState(resolvedTheme);
      syncTrayLabels(resolvedLanguage);
      persistAppSettings(value.app);

      const previousTargetSettings = providerSettings[value.provider.providerId];
      const nextTargetSettings: ProviderSettings = {
        ...previousTargetSettings,
        apiKey: value.provider.apiKey,
        modelName: value.provider.modelName,
        requestMode: value.provider.requestMode,
        baseUrl: value.provider.baseUrl,
        geminiCliProjectId: value.provider.geminiCliProjectId,
        googleCloudProject: value.provider.googleCloudProject,
        customHeaders: value.provider.customHeaders,
        tavily: value.provider.tavily,
        embedding: value.provider.embedding,
        chatAgentEnabled: value.provider.chatAgentEnabled,
        chatAgentPrompt: value.provider.chatAgentPrompt,
        chatAgentPromptParts: value.provider.chatAgentPromptParts,
        chatAgentSearchEnabled: value.provider.chatAgentSearchEnabled,
      };
      const shouldRestartConversation =
        value.app.activeProviderId !== currentProviderId ||
        haveConversationSettingsChanged(previousTargetSettings, nextTargetSettings);

      if (shouldRestartConversation) {
        commitCurrentSession({ force: true });
      }

      chatService.updateProviderSettings(value.provider.providerId, nextTargetSettings);

      if (value.app.activeProviderId !== chatService.getProviderId()) {
        chatService.setProvider(value.app.activeProviderId);
      }

      if (shouldRestartConversation) {
        startNewChat();
      }

      syncProviderState();
      void window.axchat?.setProxyAllowHttpTargets?.(value.app.allowHttpTargets);
    },
    [
      chatService,
      commitCurrentSession,
      currentProviderId,
      providerSettings,
      setLanguagePreferenceState,
      setLanguageState,
      setThemePreferenceState,
      setThemeState,
      startNewChat,
      syncProviderState,
      syncTrayLabels,
    ]
  );

  const handleLanguageChange = useCallback(
    (nextLanguagePreference: LanguagePreference) => {
      const resolvedLanguage = setLanguagePreference(nextLanguagePreference);
      setLanguagePreferenceState(nextLanguagePreference);
      setLanguageState(resolvedLanguage);
      syncTrayLabels(resolvedLanguage);
    },
    [setLanguagePreferenceState, setLanguageState, syncTrayLabels]
  );

  const handleImportSettings = useCallback(
    ({ appSettings, providerSettings: importedProviderSettings }: AppliedSettingsImport) => {
      const resolvedLanguage = setLanguagePreference(appSettings.languagePreference);
      const resolvedTheme = setThemePreference(appSettings.themePreference);
      setLanguagePreferenceState(appSettings.languagePreference);
      setLanguageState(resolvedLanguage);
      setThemePreferenceState(appSettings.themePreference);
      setThemeState(resolvedTheme);
      syncTrayLabels(resolvedLanguage);
      persistAppSettings(appSettings);
      void window.axchat?.setProxyAllowHttpTargets?.(appSettings.allowHttpTargets);

      const shouldRestartConversation =
        appSettings.activeProviderId !== currentProviderId ||
        haveConversationSettingsChanged(
          providerSettings[appSettings.activeProviderId],
          importedProviderSettings[appSettings.activeProviderId]
        );

      if (shouldRestartConversation) {
        commitCurrentSession({ force: true });
      }

      chatService.replaceAllProviderSettings(
        importedProviderSettings,
        appSettings.activeProviderId
      );
      syncProviderState();
      if (shouldRestartConversation) {
        startNewChat();
      }
    },
    [
      chatService,
      commitCurrentSession,
      currentProviderId,
      providerSettings,
      setLanguagePreferenceState,
      setLanguageState,
      setThemePreferenceState,
      setThemeState,
      startNewChat,
      syncProviderState,
      syncTrayLabels,
    ]
  );

  return {
    syncTrayLabels,
    handleSaveSettings,
    handleLanguageChange,
    handleImportSettings,
  };
};
