import ProviderTab from '@/presentation/components/settingsModal/ProviderTab';
import AppearanceTab from '@/presentation/components/settingsModal/AppearanceTab';
import AgentTab from '@/presentation/components/settingsModal/AgentTab';
import SearchTab from '@/presentation/components/settingsModal/SearchTab';
import VersionTab from '@/presentation/components/settingsModal/VersionTab';
import ShortcutsTab from '@/presentation/components/settingsModal/ShortcutsTab';
import type { useSettingsController } from '@/presentation/components/settingsModal/useSettingsController';
import type { Language } from '@/shared/utils/i18n';
import type { AccentPreference, Theme } from '@/shared/utils/theme';
import type { ConfigTransferNotice } from '@/presentation/components/settingsModal/VersionTabPreview';

type SettingsControllerValue = ReturnType<typeof useSettingsController>;

type SettingsModalTabContentProps = {
  controller: SettingsControllerValue;
  activeMeta: SettingsControllerValue['activeMeta'];
  providerOptions: SettingsControllerValue['providerOptions'];
  language: Language;
  theme: Theme;
  accentPreference: AccentPreference;
  currentConversationModelName: string;
  appVersion: string;
  updaterStatus: import('@/infrastructure/updater/updaterClient').UpdaterStatus;
  updateStatusText: string;
  includeSecretsInExport: boolean;
  configTransferBusy: boolean;
  configTransferNotice: ConfigTransferNotice | null;
  pendingImportPreview:
    | import('@/application/settings/settingsTransfer').SettingsImportPreview
    | null;
  interactionLockReason: string | null;
  clearCacheNotice: string | null;
  clearCacheStatus: 'success' | 'error' | null;
  onCheckForUpdates: () => Promise<void>;
  onOpenUpdateDownload: () => Promise<void>;
  onExportSettings: () => Promise<void>;
  onOpenImportSettings: () => Promise<void>;
  onApplyImportMerge: () => Promise<void>;
  onApplyImportReplace: () => Promise<void>;
  onCancelImportPreview: () => void;
  onOpenClearCache: () => void;
  onSetIncludeSecretsInExport: (enabled: boolean) => void;
};

export const SettingsModalTabContent = ({
  controller,
  activeMeta,
  providerOptions,
  language,
  theme,
  accentPreference,
  currentConversationModelName,
  appVersion,
  updaterStatus,
  updateStatusText,
  includeSecretsInExport,
  configTransferBusy,
  configTransferNotice,
  pendingImportPreview,
  interactionLockReason,
  clearCacheNotice,
  clearCacheStatus,
  onCheckForUpdates,
  onOpenUpdateDownload,
  onExportSettings,
  onOpenImportSettings,
  onApplyImportMerge,
  onApplyImportReplace,
  onCancelImportPreview,
  onOpenClearCache,
  onSetIncludeSecretsInExport,
}: SettingsModalTabContentProps) => {
  const { state, validation, providerActions, appearanceActions, searchActions, versionActions } =
    controller;

  switch (state.ui.activeTab) {
    case 'provider':
      return (
        <ProviderTab
          providerId={state.provider.providerId}
          providerOptions={providerOptions}
          modelName={state.provider.modelName}
          currentConversationModelName={currentConversationModelName}
          apiKey={state.provider.apiKey}
          requestMode={state.provider.requestMode}
          baseUrl={state.provider.baseUrl}
          geminiCliProjectId={state.provider.geminiCliProjectId}
          googleCloudProject={state.provider.googleCloudProject}
          customHeaders={state.provider.customHeaders}
          embedding={state.provider.embedding}
          showApiKey={state.ui.showApiKey}
          supportsRequestMode={activeMeta?.supportsRequestMode}
          supportsEmbedding={activeMeta?.supportsEmbedding}
          supportsBaseUrl={activeMeta?.supportsBaseUrl}
          supportsCustomHeaders={activeMeta?.supportsCustomHeaders}
          supportsRegion={activeMeta?.supportsRegion}
          isOfficialProvider={activeMeta?.isOfficialProvider}
          validationIssuesByField={validation.issuesByField}
          onProviderChange={providerActions.onProviderChange}
          onModelNameChange={providerActions.onModelNameChange}
          onApiKeyChange={providerActions.onApiKeyChange}
          onRequestModeChange={providerActions.onRequestModeChange}
          onToggleApiKeyVisibility={providerActions.onToggleApiKeyVisibility}
          onClearApiKey={providerActions.onClearApiKey}
          onBaseUrlChange={providerActions.onBaseUrlChange}
          onGeminiCliProjectIdChange={providerActions.onGeminiCliProjectIdChange}
          onGoogleCloudProjectChange={providerActions.onGoogleCloudProjectChange}
          onSetEmbeddingField={providerActions.onSetEmbeddingField}
          onAddCustomHeader={providerActions.onAddCustomHeader}
          onSetCustomHeaderKey={providerActions.onSetCustomHeaderKey}
          onSetCustomHeaderValue={providerActions.onSetCustomHeaderValue}
          onRemoveCustomHeader={providerActions.onRemoveCustomHeader}
          onSetRegionBaseUrl={providerActions.onSetRegionBaseUrl}
        />
      );
    case 'appearance':
      return (
        <AppearanceTab
          language={language}
          languagePreference={state.app.languagePreference}
          theme={theme}
          themePreference={state.app.themePreference}
          accentPreference={accentPreference}
          onLanguagePreferenceChange={appearanceActions.onLanguagePreferenceChange}
          onThemePreferenceChange={appearanceActions.onThemePreferenceChange}
          onAccentPreferenceChange={appearanceActions.onAccentPreferenceChange}
        />
      );
    case 'agent':
      return (
        <AgentTab
          enabled={state.provider.chatAgentEnabled}
          promptParts={state.provider.chatAgentPromptParts}
          searchEnabled={state.provider.chatAgentSearchEnabled}
          supportsChatAgent={activeMeta?.supportsChatAgent}
          supportsAgentSearch={activeMeta?.supportsTavily}
          onToggleEnabled={providerActions.onToggleChatAgent}
          onPromptPartChange={providerActions.onSetChatAgentPromptPart}
          onToggleSearchEnabled={providerActions.onToggleChatAgentSearch}
        />
      );
    case 'search':
      return activeMeta?.supportsTavily ? (
        <SearchTab
          tavily={state.provider.tavily}
          showTavilyKey={state.ui.showTavilyKey}
          toolCallMaxRounds={state.app.toolCallMaxRounds}
          validationIssuesByField={validation.issuesByField}
          onSetTavilyField={searchActions.onSetTavilyField}
          onToggleTavilyKeyVisibility={searchActions.onToggleTavilyKeyVisibility}
          onToolCallMaxRoundsChange={providerActions.onToolCallMaxRoundsChange}
          onToolCallMaxRoundsBlur={providerActions.onToolCallMaxRoundsBlur}
        />
      ) : null;
    case 'version':
      return (
        <VersionTab
          appVersion={appVersion}
          updateStatusText={updateStatusText}
          updaterStatus={updaterStatus.status}
          allowHttpTargets={state.app.allowHttpTargets}
          includeSecretsInExport={includeSecretsInExport}
          configTransferBusy={configTransferBusy}
          configTransferNotice={configTransferNotice}
          importPreview={pendingImportPreview}
          mutationsLockedReason={interactionLockReason}
          onCheckForUpdates={onCheckForUpdates}
          onOpenUpdateDownload={onOpenUpdateDownload}
          onSetAllowHttpTargets={versionActions.onSetAllowHttpTargets}
          onSetIncludeSecretsInExport={onSetIncludeSecretsInExport}
          onExportSettings={onExportSettings}
          onOpenImportSettings={onOpenImportSettings}
          onApplyImportMerge={onApplyImportMerge}
          onApplyImportReplace={onApplyImportReplace}
          onCancelImportPreview={onCancelImportPreview}
          onOpenClearCache={onOpenClearCache}
          clearCacheNotice={clearCacheNotice}
          clearCacheStatus={clearCacheStatus}
        />
      );
    case 'shortcuts':
      return <ShortcutsTab />;
    default:
      return null;
  }
};
