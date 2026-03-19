import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UpdaterStatus } from '@/infrastructure/updater/updaterClient';
import { ChatMessage } from '@/shared/types/chat';
import { chatService } from '@/application/chat/chatService';
import {
  t,
  getLanguage,
  getLanguagePreference,
  Language,
  LanguagePreference,
} from '@/shared/utils/i18n';
import { useChatSessions } from '@/presentation/hooks/session/useChatSessions';
import { useStreamingMessages } from '@/presentation/hooks/chat/useStreamingMessages';
import { useSearchToggle } from '@/presentation/hooks/search/useSearchToggle';
import { useReasoningToggle } from '@/presentation/hooks/reasoning/useReasoningToggle';
import {
  cleanupLegacyAppStorage,
  readAppStorage,
  writeAppStorage,
} from '@/infrastructure/persistence/storageKeys';
import { useAppSettings } from '@/presentation/hooks/settings/useAppSettings';
import {
  Theme,
  ThemePreference,
  getTheme,
  getThemePreference,
} from '@/shared/utils/theme';
import {
  useAppMetadataSync,
  useDocumentAppearance,
  useElectronBodyClass,
  useSystemLanguageSync,
  useSystemThemeSync,
  useTrayLanguageSync,
  useUpdaterDownloadPrompt,
} from '@/presentation/hooks/app/appControllerEffects';
import { DEFAULT_UPDATER_STATUS } from '@/infrastructure/updater/updaterClient';
import { hasSearchConfig } from '@/infrastructure/providers/tavily';
import {
  useChatMainProps,
  useSettingsModalProps,
  useSidebarProps,
} from '@/presentation/hooks/app/appControllerViewModels';

export const useAppController = () => {
  const initialProviderId = chatService.getProviderId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providerState, setProviderState] = useState(() => ({
    providerSettings: chatService.getAllProviderSettings(),
    currentProviderId: initialProviderId,
  }));
  const [language, setLanguageState] = useState<Language>(() => getLanguage());
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(() =>
    getLanguagePreference()
  );
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    getThemePreference()
  );
  const [appVersion, setAppVersion] = useState<string>(() => readAppStorage('appVersion') ?? '');
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>(() => {
    const cached = readAppStorage('updaterStatus');
    if (!cached) return DEFAULT_UPDATER_STATUS;
    try {
      const parsed = JSON.parse(cached) as UpdaterStatus;
      return parsed.status ? parsed : DEFAULT_UPDATER_STATUS;
    } catch {
      return DEFAULT_UPDATER_STATUS;
    }
  });

  const syncProviderState = useCallback(() => {
    setProviderState({
      providerSettings: chatService.getAllProviderSettings(),
      currentProviderId: chatService.getProviderId(),
    });
  }, []);

  const { providerSettings, currentProviderId } = providerState;
  const currentProviderSettings = providerSettings[currentProviderId];
  const currentModelName = currentProviderSettings?.modelName ?? chatService.getModelName();
  const currentApiKey = currentProviderSettings?.apiKey ?? '';
  const defaultSessionTitle = t('sidebar.newChat');
  const searchAvailable = hasSearchConfig(providerSettings[currentProviderId]?.tavily);

  useEffect(() => {
    cleanupLegacyAppStorage();
  }, []);

  useElectronBodyClass();
  useUpdaterDownloadPrompt();
  useDocumentAppearance(language, theme);
  useAppMetadataSync({ setAppVersion, setUpdaterStatus });

  const commitCurrentSessionNowRef = useRef<(() => void) | null>(null);
  const commitCurrentSessionNow = useCallback(() => {
    commitCurrentSessionNowRef.current?.();
  }, []);

  const streaming = useStreamingMessages({
    chatService,
    messages,
    setMessages,
    commitCurrentSessionNow,
  });

  const chatSessions = useChatSessions({
    chatService,
    messages,
    setMessages,
    defaultSessionTitle,
    syncProviderState,
    isStreaming: streaming.isStreaming,
    isLoading: streaming.isLoading,
  });

  const { startNewChat, commitCurrentSession, currentSessionId } = chatSessions;

  useEffect(() => {
    commitCurrentSessionNowRef.current = () => commitCurrentSession({ force: true });
  }, [commitCurrentSession]);

  const { searchEnabled, setSearchEnabled } = useSearchToggle({
    chatService,
    tavilyAvailable: searchAvailable,
    currentProviderId,
  });
  const { reasoningEnabled, setReasoningEnabled } = useReasoningToggle({
    chatService,
    currentProviderId,
  });

  const handleNewChatClick = useCallback(() => {
    if (streaming.isStreaming || streaming.isLoading) return;
    startNewChat();
  }, [startNewChat, streaming.isLoading, streaming.isStreaming]);

  const handleToggleSearch = useCallback(() => {
    setSearchEnabled((prev) => !prev);
  }, [setSearchEnabled]);

  const handleToggleReasoning = useCallback(() => {
    setReasoningEnabled((prev) => !prev);
  }, [setReasoningEnabled]);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const settingsInteractionLockReason =
    streaming.isStreaming || streaming.isLoading ? t('settings.modal.busy') : null;

  const { syncTrayLabels, handleSaveSettings, handleImportSettings } = useAppSettings({
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
  });

  useTrayLanguageSync(language, syncTrayLabels);
  useSystemLanguageSync({
    languagePreference,
    setLanguage: setLanguageState,
    syncTrayLabels,
  });
  useSystemThemeSync({
    themePreference,
    setTheme: setThemeState,
  });

  const settingsModalProps = useSettingsModalProps({
    isSettingsOpen,
    providerSettings,
    currentProviderId,
    currentModelName,
    currentApiKey,
    language,
    languagePreference,
    theme,
    themePreference,
    currentProviderSettings,
    settingsInteractionLockReason,
    handleCloseSettings,
    handleSaveSettings,
    handleImportSettings,
    appVersion,
    updaterStatus,
  });

  const sidebarProps = useSidebarProps({
    chatSessions,
    language,
    handleNewChatClick,
    handleOpenSettings,
  });

  const chatMainProps = useChatMainProps({
    messages,
    currentSessionId,
    streaming,
    language,
    reasoningEnabled,
    searchEnabled,
    tavilyAvailable: searchAvailable,
    handleToggleReasoning,
    handleToggleSearch,
  });

  return {
    language,
    settingsModalProps,
    sidebarProps,
    chatMainProps,
  };
};
