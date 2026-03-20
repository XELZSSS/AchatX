import { useEffect, useLayoutEffect, useMemo, useReducer } from 'react';
import { listProviderIds } from '@/infrastructure/providers/registry';
import {
  normalizeChatAgentEnabled,
  normalizeChatAgentPromptParts,
  resolveChatAgentFormPrompt,
  buildChatAgentPromptFromParts,
  getDefaultChatAgentSearchEnabled,
  normalizeChatAgentSearchEnabled,
} from '@/infrastructure/providers/chatAgent';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import { GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import { t, type LanguagePreference } from '@/shared/utils/i18n';
import type { AccentPreference, ThemePreference } from '@/shared/utils/theme';
import {
  providerMeta,
  resolveBaseUrlForProvider,
} from '@/presentation/components/settingsModal/constants';
import {
  settingsModalReducer,
  SettingsModalState,
} from '@/presentation/components/settingsModal/reducer';
import { ProviderSettingsMap } from '@/presentation/components/settingsModal/types';
import { loadAppSettings } from '@/infrastructure/persistence/appSettingsStore';

const resolvePromptParts = (
  providerId: ProviderId,
  chatAgentPromptParts?: {
    identity: string;
    role: string;
    setting: string;
  }
) =>
  normalizeChatAgentPromptParts(providerId, chatAgentPromptParts) ?? {
    identity: '',
    role: '',
    setting: '',
  };

const resolveChatAgentSearchEnabled = (providerId: ProviderId, chatAgentSearchEnabled?: boolean) =>
  normalizeChatAgentSearchEnabled(providerId, chatAgentSearchEnabled) ??
  getDefaultChatAgentSearchEnabled(providerId) ??
  false;

type ProviderStateInput = {
  providerId: ProviderId;
  modelName?: string;
  apiKey?: string;
  requestMode?: OpenAIRequestMode;
  baseUrl?: string;
  geminiCliProjectId?: string;
  googleCloudProject?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  embedding?: GeminiEmbeddingConfig;
  chatAgentEnabled?: boolean;
  chatAgentPrompt?: string;
  chatAgentPromptParts?: {
    identity: string;
    role: string;
    setting: string;
  };
  chatAgentSearchEnabled?: boolean;
};

const buildProviderState = (input: ProviderStateInput): SettingsModalState['provider'] => {
  const promptParts = resolvePromptParts(input.providerId, input.chatAgentPromptParts);
  const promptFromParts = buildChatAgentPromptFromParts(input.providerId, promptParts);

  return {
    providerId: input.providerId,
    modelName: input.modelName ?? '',
    apiKey: input.apiKey ?? '',
    requestMode: input.requestMode,
    baseUrl: resolveBaseUrlForProvider(input.providerId, input.baseUrl),
    geminiCliProjectId: input.geminiCliProjectId ?? '',
    googleCloudProject: input.googleCloudProject ?? '',
    customHeaders: input.customHeaders ?? [],
    tavily: input.tavily ?? {},
    embedding: input.embedding ?? {},
    chatAgentEnabled: normalizeChatAgentEnabled(input.providerId, input.chatAgentEnabled) ?? false,
    chatAgentPrompt: resolveChatAgentFormPrompt(input.providerId, promptFromParts),
    chatAgentPromptParts: promptParts,
    chatAgentSearchEnabled: resolveChatAgentSearchEnabled(
      input.providerId,
      input.chatAgentSearchEnabled
    ),
  };
};

type BuildStateInput = {
  providerId: ProviderId;
  modelName: string;
  apiKey: string;
  requestMode?: OpenAIRequestMode;
  languagePreference: LanguagePreference;
  themePreference: ThemePreference;
  accentPreference: AccentPreference;
  baseUrl?: string;
  geminiCliProjectId?: string;
  googleCloudProject?: string;
  customHeaders?: Array<{ key: string; value: string }>;
  tavily?: TavilyConfig;
  embedding?: GeminiEmbeddingConfig;
  chatAgentEnabled?: boolean;
  chatAgentPrompt?: string;
  chatAgentPromptParts?: {
    identity: string;
    role: string;
    setting: string;
  };
  chatAgentSearchEnabled?: boolean;
};

const buildStateFromInput = (
  input: BuildStateInput,
  appSettings: ReturnType<typeof loadAppSettings>
): SettingsModalState => {
  return {
    provider: buildProviderState(input),
    app: {
      defaultProviderId: input.providerId,
      languagePreference: input.languagePreference,
      themePreference: input.themePreference,
      accentPreference: input.accentPreference,
      allowHttpTargets: appSettings.allowHttpTargets,
      toolCallMaxRounds: appSettings.toolCallMaxRounds,
    },
    ui: {
      showApiKey: false,
      showTavilyKey: false,
      activeTab: 'provider',
    },
  };
};

type UseSettingsFormOptions = BuildStateInput & {
  isOpen: boolean;
  providerSettings: ProviderSettingsMap;
};

export const useSettingsForm = ({
  isOpen,
  providerSettings,
  providerId,
  modelName,
  apiKey,
  requestMode,
  languagePreference,
  themePreference,
  accentPreference,
  baseUrl,
  geminiCliProjectId,
  googleCloudProject,
  customHeaders,
  tavily,
  embedding,
  chatAgentEnabled,
  chatAgentPrompt,
  chatAgentPromptParts,
  chatAgentSearchEnabled,
}: UseSettingsFormOptions) => {
  const appSettingsSeed = useMemo(() => {
    if (!isOpen) {
      return loadAppSettings();
    }

    return loadAppSettings();
  }, [isOpen]);

  const stateSeed = useMemo(
    () =>
      buildStateFromInput(
        {
          providerId,
          modelName,
          apiKey,
          requestMode,
          languagePreference,
          themePreference,
          accentPreference,
          baseUrl,
          geminiCliProjectId,
          googleCloudProject,
          customHeaders,
          tavily,
          embedding,
          chatAgentEnabled,
          chatAgentPrompt,
          chatAgentPromptParts,
          chatAgentSearchEnabled,
        },
        appSettingsSeed
      ),
    [
      apiKey,
      appSettingsSeed,
      baseUrl,
      geminiCliProjectId,
      googleCloudProject,
      chatAgentEnabled,
      chatAgentPrompt,
      chatAgentPromptParts,
      chatAgentSearchEnabled,
      customHeaders,
      embedding,
      languagePreference,
      modelName,
      providerId,
      requestMode,
      tavily,
      accentPreference,
      themePreference,
    ]
  );

  const [state, dispatch] = useReducer(settingsModalReducer, stateSeed);

  useLayoutEffect(() => {
    if (!isOpen) return;
    dispatch({ type: 'replace', payload: stateSeed });
  }, [isOpen, stateSeed]);

  const providerOptions = useMemo(
    () =>
      listProviderIds().map((id) => ({
        value: id,
        label: providerMeta[id]?.label ?? id.charAt(0).toUpperCase() + id.slice(1),
      })),
    []
  );

  const activeMeta = providerMeta[state.provider.providerId];
  const tabs = [
    { id: 'provider' as const, label: t('settings.modal.tab.model'), visible: true },
    { id: 'appearance' as const, label: t('settings.modal.tab.appearance'), visible: true },
    { id: 'agent' as const, label: t('settings.modal.tab.agent'), visible: true },
    {
      id: 'search' as const,
      label: t('settings.modal.tab.search'),
      visible: !!activeMeta?.supportsTavily,
    },
    {
      id: 'version' as const,
      label: t('settings.modal.tab.version'),
      visible: true,
    },
    {
      id: 'shortcuts' as const,
      label: t('settings.modal.tab.shortcuts'),
      visible: true,
    },
  ].filter((tab) => tab.visible);

  useEffect(() => {
    if (tabs.some((tab) => tab.id === state.ui.activeTab)) return;
    dispatch({ type: 'patch_ui', payload: { activeTab: 'provider' } });
  }, [state.ui.activeTab, tabs]);

  const handleProviderChange = (nextProviderId: ProviderId) => {
    const nextSettings = providerSettings[nextProviderId];

    dispatch({
      type: 'patch_provider',
      payload: buildProviderState({
        providerId: nextProviderId,
        modelName: nextSettings?.modelName,
        apiKey: nextSettings?.apiKey,
        requestMode: nextSettings?.requestMode,
        baseUrl: nextSettings?.baseUrl,
        geminiCliProjectId: nextSettings?.geminiCliProjectId,
        googleCloudProject: nextSettings?.googleCloudProject,
        customHeaders: nextSettings?.customHeaders,
        tavily: nextSettings?.tavily,
        embedding: nextSettings?.embedding,
        chatAgentEnabled: nextSettings?.chatAgentEnabled,
        chatAgentPrompt: nextSettings?.chatAgentPrompt,
        chatAgentPromptParts: nextSettings?.chatAgentPromptParts,
        chatAgentSearchEnabled: nextSettings?.chatAgentSearchEnabled,
      }),
    });
    dispatch({
      type: 'patch_app',
      payload: { defaultProviderId: nextProviderId },
    });
  };

  return {
    state,
    stateSeed,
    dispatch,
    providerOptions,
    activeMeta,
    tabs,
    handleProviderChange,
  };
};
