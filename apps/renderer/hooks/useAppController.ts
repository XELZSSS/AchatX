import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage } from '../types';
import { ChatService } from '../services/chatService';
import { t, getLanguage, applyLanguageToDocument, Language } from '../utils/i18n';
import { useChatSessions } from './useChatSessions';
import { useStreamingMessages } from './useStreamingMessages';
import { useSearchToggle } from './useSearchToggle';
import { useAppSettings } from './useAppSettings';
import { Theme, applyThemeToDocument, getTheme, setTheme as persistTheme } from '../utils/theme';
import { getUpdaterStatus, subscribeUpdaterStatus } from '../services/updaterClient';
import type { UpdaterStatus } from '../services/updaterClient';

const chatService = new ChatService();

export const useAppController = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providerState, setProviderState] = useState(() => ({
    providerSettings: chatService.getAllProviderSettings(),
    currentProviderId: chatService.getProviderId(),
  }));
  const [language, setLanguageState] = useState<Language>(() => getLanguage());
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const hasPromptedAvailableUpdateRef = useRef(false);
  const hasNotifiedBootstrapReadyRef = useRef(false);

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

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.gero;
    document.body.classList.toggle('electron', isElectron);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.gero) return;

    const shouldResetPromptFlag = (status: UpdaterStatus['status']) => {
      return status !== 'available';
    };

    const promptDownloadIfNeeded = (status: UpdaterStatus) => {
      if (shouldResetPromptFlag(status.status)) {
        hasPromptedAvailableUpdateRef.current = false;
        return;
      }
      if (hasPromptedAvailableUpdateRef.current) return;
      hasPromptedAvailableUpdateRef.current = true;
      const shouldOpenDownload = window.confirm(t('settings.update.prompt.downloadNow'));
      if (shouldOpenDownload) {
        void window.gero?.quitAndInstallUpdate?.();
      }
    };

    void getUpdaterStatus().then((status) => {
      if (status) {
        promptDownloadIfNeeded(status);
      }
    });

    const unsubscribe = subscribeUpdaterStatus((status) => {
      promptDownloadIfNeeded(status);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const streaming = useStreamingMessages({ chatService, messages, setMessages });

  const chatSessions = useChatSessions({
    chatService,
    messages,
    setMessages,
    defaultSessionTitle,
    scrollToBottom: streaming.scrollToBottom,
    syncProviderState,
    isStreaming: streaming.isStreaming,
    isLoading: streaming.isLoading,
  });
  const {
    sessions,
    filteredSessions,
    currentSessionId,
    searchQuery,
    editingSessionId,
    editTitleInput,
    setSearchQuery,
    setEditTitleInput,
    startNewChat,
    handleLoadSession,
    handleStartEdit,
    handleDeleteSession,
    handleEditInputClick,
    handleEditKeyDown,
    handleSaveEdit,
    handleCancelEdit,
    isSessionStateReady,
  } = chatSessions;

  useEffect(() => {
    applyLanguageToDocument();
    document.title = t('app.title');
  }, [language]);

  useEffect(() => {
    applyThemeToDocument();
  }, [theme]);

  useEffect(() => {
    if (hasNotifiedBootstrapReadyRef.current) return;
    if (!isSessionStateReady) return;

    hasNotifiedBootstrapReadyRef.current = true;
    if (typeof window === 'undefined' || !window.gero?.notifyBootstrapReady) return;

    const frame = window.requestAnimationFrame(() => {
      window.gero?.notifyBootstrapReady();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isSessionStateReady]);

  const tavilyAvailable = Boolean(providerSettings[currentProviderId]?.tavily?.apiKey);
  const { searchEnabled, setSearchEnabled } = useSearchToggle({
    chatService,
    tavilyAvailable,
    currentProviderId,
  });

  const handleNewChatClick = useCallback(() => {
    if (streaming.isStreaming || streaming.isLoading) return;
    startNewChat();
  }, [startNewChat, streaming.isLoading, streaming.isStreaming]);

  const handleToggleSearch = useCallback(() => {
    setSearchEnabled((prev) => !prev);
  }, [setSearchEnabled]);

  const handleThemeToggle = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    persistTheme(nextTheme);
    setThemeState(nextTheme);
  }, [theme]);

  const syncCurrentConversation = useCallback(() => {
    void chatService.startChatWithHistory(messages).catch((error) => {
      console.error('Failed to sync current conversation after settings change:', error);
    });
  }, [messages]);

  const { syncTrayLabels, handleSaveSettings, handleLanguageChange } = useAppSettings({
    chatService,
    providerSettings,
    currentProviderId,
    syncProviderState,
    setLanguageState,
    syncCurrentConversation,
  });

  useEffect(() => {
    syncTrayLabels(language);
  }, [language, syncTrayLabels]);

  const settingsModalProps = useMemo(
    () => ({
      isOpen: isSettingsOpen,
      onClose: () => setIsSettingsOpen(false),
      providerSettings,
      providerId: currentProviderId,
      modelName: currentModelName,
      apiKey: currentApiKey,
      baseUrl: currentProviderSettings?.baseUrl,
      customHeaders: currentProviderSettings?.customHeaders,
      tavily: currentProviderSettings?.tavily,
      onSave: handleSaveSettings,
    }),
    [
      currentApiKey,
      currentModelName,
      currentProviderId,
      handleSaveSettings,
      isSettingsOpen,
      currentProviderSettings,
      providerSettings,
    ]
  );

  const sidebarProps = useMemo(
    () => ({
      currentSessionId,
      sessions,
      filteredSessions,
      searchQuery,
      editingSessionId,
      editTitleInput,
      language,
      theme,
      onNewChatClick: handleNewChatClick,
      onSearchChange: setSearchQuery,
      onLoadSession: handleLoadSession,
      onStartEdit: handleStartEdit,
      onDeleteSession: handleDeleteSession,
      onEditTitleInputChange: setEditTitleInput,
      onEditInputClick: handleEditInputClick,
      onEditKeyDown: handleEditKeyDown,
      onSaveEdit: handleSaveEdit,
      onCancelEdit: handleCancelEdit,
      onThemeToggle: handleThemeToggle,
      onLanguageChange: handleLanguageChange,
      onOpenSettings: () => setIsSettingsOpen(true),
    }),
    [
      currentSessionId,
      editTitleInput,
      editingSessionId,
      filteredSessions,
      handleCancelEdit,
      handleDeleteSession,
      handleEditInputClick,
      handleEditKeyDown,
      handleLoadSession,
      handleSaveEdit,
      handleStartEdit,
      handleLanguageChange,
      handleNewChatClick,
      handleThemeToggle,
      language,
      theme,
      searchQuery,
      sessions,
      setEditTitleInput,
      setSearchQuery,
    ]
  );

  const chatMainProps = useMemo(
    () => ({
      messages,
      isStreaming: streaming.isStreaming,
      isLoading: streaming.isLoading,
      messagesContentRef: streaming.messagesContentRef,
      messagesContainerRef: streaming.messagesContainerRef,
      messagesEndRef: streaming.messagesEndRef,
      showScrollToBottom: streaming.showScrollToBottom,
      onJumpToBottom: streaming.jumpToBottom,
      onSendMessage: streaming.handleSendMessage,
      onStopStreaming: streaming.stopStreaming,
      searchEnabled,
      searchAvailable: tavilyAvailable,
      onToggleSearch: handleToggleSearch,
    }),
    [
      handleToggleSearch,
      messages,
      searchEnabled,
      streaming.handleSendMessage,
      streaming.isLoading,
      streaming.isStreaming,
      streaming.messagesContentRef,
      streaming.jumpToBottom,
      streaming.messagesContainerRef,
      streaming.messagesEndRef,
      streaming.showScrollToBottom,
      streaming.stopStreaming,
      tavilyAvailable,
    ]
  );

  return {
    settingsModalProps,
    sidebarProps,
    chatMainProps,
  };
};
