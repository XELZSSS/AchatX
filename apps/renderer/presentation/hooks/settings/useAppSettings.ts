import { Dispatch, SetStateAction, useCallback } from 'react';
import { ChatService } from '@/application/chat/chatService';
import { ProviderSettingsMap, SaveSettingsPayload } from '@/application/settings/settingsTypes';
import { Language, LanguagePreference, setLanguagePreference, t } from '@/shared/utils/i18n';
import {
  AccentPreference,
  Theme,
  ThemePreference,
  setAccentPreference,
  setThemePreference,
} from '@/shared/utils/theme';
import { persistAppSettings } from '@/infrastructure/persistence/appSettingsStore';
import type { AppliedSettingsImport } from '@/application/settings/settingsTransfer';
import type { ProviderSettings } from '@/infrastructure/providers/defaults';

type UseAppSettingsOptions = {
  chatService: ChatService;
  providerSettings: ProviderSettingsMap;
  syncDefaultProviderState: () => void;
  syncConversationState: () => void;
  setLanguagePreferenceState: Dispatch<SetStateAction<LanguagePreference>>;
  setLanguageState: Dispatch<SetStateAction<Language>>;
  setThemePreferenceState: Dispatch<SetStateAction<ThemePreference>>;
  setThemeState: Dispatch<SetStateAction<Theme>>;
  setAccentPreferenceState: Dispatch<SetStateAction<AccentPreference>>;
  hasMessages: boolean;
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
  syncDefaultProviderState,
  syncConversationState,
  setLanguagePreferenceState,
  setLanguageState,
  setThemePreferenceState,
  setThemeState,
  setAccentPreferenceState,
  hasMessages,
}: UseAppSettingsOptions) => {
  const syncTrayLabels = useCallback((language: Language) => {
    void window.orlinx?.setTrayLanguage?.(language);
    void window.orlinx?.setTrayLabels?.({
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
      const resolvedAccent = setAccentPreference(value.app.accentPreference);
      setLanguagePreferenceState(value.app.languagePreference);
      setLanguageState(resolvedLanguage);
      setThemePreferenceState(value.app.themePreference);
      setThemeState(resolvedTheme);
      setAccentPreferenceState(resolvedAccent);
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

      const shouldRefreshEditedProvider = haveConversationSettingsChanged(
        previousTargetSettings,
        nextTargetSettings
      );

      if (shouldRefreshEditedProvider) {
        chatService.updateProviderSettings(value.provider.providerId, nextTargetSettings);
      }

      if (!hasMessages) {
        chatService.resetChat();
        chatService.activateDefaultConversationContext();
      }

      syncDefaultProviderState();
      syncConversationState();
      void window.orlinx?.setProxyAllowHttpTargets?.(value.app.allowHttpTargets);
    },
    [
      chatService,
      hasMessages,
      providerSettings,
      setLanguagePreferenceState,
      setLanguageState,
      setThemePreferenceState,
      setThemeState,
      setAccentPreferenceState,
      syncDefaultProviderState,
      syncConversationState,
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
      const resolvedAccent = setAccentPreference(appSettings.accentPreference);
      setLanguagePreferenceState(appSettings.languagePreference);
      setLanguageState(resolvedLanguage);
      setThemePreferenceState(appSettings.themePreference);
      setThemeState(resolvedTheme);
      setAccentPreferenceState(resolvedAccent);
      syncTrayLabels(resolvedLanguage);
      persistAppSettings(appSettings);
      void window.orlinx?.setProxyAllowHttpTargets?.(appSettings.allowHttpTargets);

      chatService.replaceAllProviderSettings(importedProviderSettings);

      if (!hasMessages) {
        chatService.resetChat();
        chatService.activateDefaultConversationContext();
      }

      syncDefaultProviderState();
      syncConversationState();
    },
    [
      chatService,
      hasMessages,
      setLanguagePreferenceState,
      setLanguageState,
      setThemePreferenceState,
      setThemeState,
      setAccentPreferenceState,
      syncDefaultProviderState,
      syncConversationState,
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

