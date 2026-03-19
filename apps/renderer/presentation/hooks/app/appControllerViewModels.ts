import { useMemo } from 'react';
import type { ChatMessage } from '@/shared/types/chat';
import type { Language, LanguagePreference } from '@/shared/utils/i18n';
import type { Theme, ThemePreference } from '@/shared/utils/theme';
import type { ProviderSettingsMap } from '@/application/settings/settingsTypes';
import type { AppliedSettingsImport } from '@/application/settings/settingsTransfer';
import type { useStreamingMessages } from '@/presentation/hooks/chat/useStreamingMessages';
import type { useChatSessions } from '@/presentation/hooks/session/useChatSessions';
import type { useAppSettings } from '@/presentation/hooks/settings/useAppSettings';

type StreamingState = ReturnType<typeof useStreamingMessages>;
type ChatSessionsState = ReturnType<typeof useChatSessions>;
type AppSettingsState = ReturnType<typeof useAppSettings>;

type UseSettingsModalPropsOptions = {
  isSettingsOpen: boolean;
  providerSettings: ProviderSettingsMap;
  currentProviderId: keyof ProviderSettingsMap;
  currentModelName: string;
  currentApiKey: string;
  language: Language;
  languagePreference: LanguagePreference;
  theme: Theme;
  themePreference: ThemePreference;
  currentProviderSettings: ProviderSettingsMap[keyof ProviderSettingsMap] | undefined;
  settingsInteractionLockReason: string | null;
  handleCloseSettings: () => void;
  handleSaveSettings: AppSettingsState['handleSaveSettings'];
  handleImportSettings: (value: AppliedSettingsImport) => void;
  appVersion: string;
  updaterStatus: import('@/infrastructure/updater/updaterClient').UpdaterStatus;
};

export const useSettingsModalProps = ({
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
}: UseSettingsModalPropsOptions) => {
  return useMemo(
    () => ({
      isOpen: isSettingsOpen,
      onClose: handleCloseSettings,
      providerSettings,
      providerId: currentProviderId,
      modelName: currentModelName,
      apiKey: currentApiKey,
      requestMode: currentProviderSettings?.requestMode,
      language,
      languagePreference,
      theme,
      themePreference,
      interactionLockReason: settingsInteractionLockReason,
      baseUrl: currentProviderSettings?.baseUrl,
      geminiCliProjectId: currentProviderSettings?.geminiCliProjectId,
      googleCloudProject: currentProviderSettings?.googleCloudProject,
      customHeaders: currentProviderSettings?.customHeaders,
      tavily: currentProviderSettings?.tavily,
      embedding: currentProviderSettings?.embedding,
      chatAgentPrompt: currentProviderSettings?.chatAgentPrompt,
      chatAgentPromptParts: currentProviderSettings?.chatAgentPromptParts,
      chatAgentEnabled: currentProviderSettings?.chatAgentEnabled,
      chatAgentSearchEnabled: currentProviderSettings?.chatAgentSearchEnabled,
      onSave: handleSaveSettings,
      onImportSettings: handleImportSettings,
      appVersion,
      updaterStatus,
    }),
    [
      appVersion,
      currentApiKey,
      currentModelName,
      currentProviderId,
      currentProviderSettings,
      handleCloseSettings,
      handleImportSettings,
      handleSaveSettings,
      isSettingsOpen,
      language,
      languagePreference,
      providerSettings,
      theme,
      themePreference,
      updaterStatus,
      settingsInteractionLockReason,
    ]
  );
};

type UseSidebarPropsOptions = {
  chatSessions: ChatSessionsState;
  language: Language;
  handleNewChatClick: () => void;
  handleOpenSettings: () => void;
};

export const useSidebarProps = ({
  chatSessions,
  language,
  handleNewChatClick,
  handleOpenSettings,
}: UseSidebarPropsOptions) => {
  const {
    currentSessionId,
    sessions,
    filteredSessions,
    searchQuery,
    editingSessionId,
    editTitleInput,
    sessionActionsDisabled,
    sessionActionsDisabledReason,
    sessionNotice,
    setSearchQuery,
    setEditTitleInput,
    handleLoadSession,
    handleStartEdit,
    handleDeleteSession,
    handleEditInputClick,
    handleEditKeyDown,
    handleSaveEdit,
    handleCancelEdit,
  } = chatSessions;

  return useMemo(
    () => ({
      currentSessionId,
      sessions,
      filteredSessions,
      searchQuery,
      editingSessionId,
      editTitleInput,
      sessionActionsDisabled,
      sessionActionsDisabledReason,
      sessionNotice,
      language,
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
      onOpenSettings: handleOpenSettings,
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
      handleNewChatClick,
      handleOpenSettings,
      handleSaveEdit,
      handleStartEdit,
      language,
      searchQuery,
      sessionActionsDisabled,
      sessionActionsDisabledReason,
      sessionNotice,
      sessions,
      setEditTitleInput,
      setSearchQuery,
    ]
  );
};

type UseChatMainPropsOptions = {
  messages: ChatMessage[];
  currentSessionId: string;
  streaming: StreamingState;
  language: Language;
  reasoningEnabled: boolean;
  searchEnabled: boolean;
  tavilyAvailable: boolean;
  handleToggleReasoning: () => void;
  handleToggleSearch: () => void;
};

export const useChatMainProps = ({
  messages,
  currentSessionId,
  streaming,
  language,
  reasoningEnabled,
  searchEnabled,
  tavilyAvailable,
  handleToggleReasoning,
  handleToggleSearch,
}: UseChatMainPropsOptions) => {
  return useMemo(
    () => ({
      language,
      sessionId: currentSessionId,
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
      reasoningEnabled,
      searchEnabled,
      searchAvailable: tavilyAvailable,
      onToggleReasoning: handleToggleReasoning,
      onToggleSearch: handleToggleSearch,
    }),
    [
      handleToggleReasoning,
      handleToggleSearch,
      currentSessionId,
      language,
      messages,
      reasoningEnabled,
      searchEnabled,
      streaming.handleSendMessage,
      streaming.isLoading,
      streaming.isStreaming,
      streaming.jumpToBottom,
      streaming.messagesContainerRef,
      streaming.messagesContentRef,
      streaming.messagesEndRef,
      streaming.showScrollToBottom,
      streaming.stopStreaming,
      tavilyAvailable,
    ]
  );
};
