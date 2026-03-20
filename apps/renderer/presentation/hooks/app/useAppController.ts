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
import { readAppStorage, writeAppStorage } from '@/infrastructure/persistence/storageKeys';
import { useAppSettings } from '@/presentation/hooks/settings/useAppSettings';
import {
  AccentPreference,
  Theme,
  ThemePreference,
  getAccentPreference,
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
} from '@/presentation/hooks/app/appControllerEffects';
import { DEFAULT_UPDATER_STATUS } from '@/infrastructure/updater/updaterClient';
import { hasSearchConfig } from '@/infrastructure/providers/tavily';
import {
  useChatMainProps,
  useSettingsModalProps,
  useSidebarProps,
} from '@/presentation/hooks/app/appControllerViewModels';

export const useAppController = () => {
  const initialDefaultProviderId = chatService.getDefaultProviderId();
  const initialConversationContext = chatService.getConversationContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [defaultProviderState, setDefaultProviderState] = useState(() => ({
    providerSettings: chatService.getAllProviderSettings(),
    currentProviderId: initialDefaultProviderId,
  }));
  const [conversationState, setConversationState] = useState(() => ({
    currentProviderId: initialConversationContext.providerId,
    currentModelName: initialConversationContext.modelName,
  }));
  const [language, setLanguageState] = useState<Language>(() => getLanguage());
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(() =>
    getLanguagePreference()
  );
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    getThemePreference()
  );
  const [accentPreference, setAccentPreferenceState] = useState<AccentPreference>(() =>
    getAccentPreference()
  );
  const [appVersion, setAppVersion] = useState<string>(() => readAppStorage('appVersion') ?? '');
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>(() => {
    const cached = readAppStorage('updaterStatus');
    if (!cached) return DEFAULT_UPDATER_STATUS;
    try {
      const parsed = JSON.parse(cached) as Partial<UpdaterStatus>;
      return parsed.status ? { ...DEFAULT_UPDATER_STATUS, ...parsed } : DEFAULT_UPDATER_STATUS;
    } catch {
      return DEFAULT_UPDATER_STATUS;
    }
  });

  const syncDefaultProviderState = useCallback(() => {
    setDefaultProviderState({
      providerSettings: chatService.getAllProviderSettings(),
      currentProviderId: chatService.getDefaultProviderId(),
    });
  }, []);

  const syncConversationState = useCallback(() => {
    const context = chatService.getConversationContext();
    setConversationState({
      currentProviderId: context.providerId,
      currentModelName: context.modelName,
    });
  }, []);

  const { providerSettings, currentProviderId: defaultProviderId } = defaultProviderState;
  const { currentProviderId: conversationProviderId, currentModelName: conversationModelName } =
    conversationState;
  const currentProviderSettings = providerSettings[defaultProviderId];
  const currentModelName = currentProviderSettings?.modelName ?? '';
  const currentApiKey = currentProviderSettings?.apiKey ?? '';
  const defaultSessionTitle = t('sidebar.newChat');
  const searchAvailable = hasSearchConfig(providerSettings[conversationProviderId]?.tavily);

  useElectronBodyClass();
  useDocumentAppearance(language, theme, accentPreference);
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
    syncConversationState,
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
    currentProviderId: conversationProviderId,
  });
  const { reasoningEnabled, setReasoningEnabled } = useReasoningToggle({
    chatService,
    currentProviderId: conversationProviderId,
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
    syncDefaultProviderState,
    syncConversationState,
    setLanguagePreferenceState,
    setLanguageState,
    setThemePreferenceState,
    setThemeState,
    setAccentPreferenceState,
    hasMessages: messages.length > 0,
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
    currentProviderId: defaultProviderId,
    currentModelName,
    currentConversationModelName: conversationModelName,
    currentApiKey,
    language,
    languagePreference,
    theme,
    themePreference,
    accentPreference,
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
