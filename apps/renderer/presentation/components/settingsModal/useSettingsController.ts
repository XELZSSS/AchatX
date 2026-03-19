import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import { buildChatAgentPromptFromParts } from '@/infrastructure/providers/chatAgent';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import type { LanguagePreference } from '@/shared/utils/i18n';
import type { ThemePreference } from '@/shared/utils/theme';
import {
  ActiveSettingsTab,
  SettingsModalState,
} from '@/presentation/components/settingsModal/reducer';
import { resolveBaseUrlForRegion } from '@/presentation/components/settingsModal/constants';
import { useSettingsForm } from '@/presentation/components/settingsModal/useSettingsForm';
import {
  ProviderSettingsMap,
  SaveSettingsPayload,
} from '@/presentation/components/settingsModal/types';
import {
  buildSettingsSavePayload,
  normalizeToolCallRounds,
} from '@/presentation/components/settingsModal/controllerHelpers';
import { validateSettingsState } from '@/presentation/components/settingsModal/validation';
type UseSettingsControllerOptions = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: SaveSettingsPayload) => void;
  providerSettings: ProviderSettingsMap;
  saveBlockedReason?: string | null;
} & Omit<Parameters<typeof useSettingsForm>[0], 'isOpen'>;

const serializeComparableSettingsState = (state: SettingsModalState): string => {
  return JSON.stringify({
    provider: state.provider,
    app: state.app,
  });
};
export const useSettingsController = ({
  isOpen,
  onClose,
  onSave,
  saveBlockedReason = null,
  providerId: currentProviderId,
  modelName: currentModelName,
  ...formOptions
}: UseSettingsControllerOptions) => {
  const { state, stateSeed, dispatch, providerOptions, activeMeta, tabs, handleProviderChange } =
    useSettingsForm({
      isOpen,
      providerId: currentProviderId,
      modelName: currentModelName,
      ...formOptions,
    });
  const patchProviderState = useCallback(
    (payload: Partial<SettingsModalState['provider']>) =>
      dispatch({ type: 'patch_provider', payload }),
    [dispatch]
  );

  const patchAppState = useCallback(
    (payload: Partial<SettingsModalState['app']>) => dispatch({ type: 'patch_app', payload }),
    [dispatch]
  );

  const patchUiState = useCallback(
    (payload: Partial<SettingsModalState['ui']>) => dispatch({ type: 'patch_ui', payload }),
    [dispatch]
  );
  const setProviderField = useCallback(
    <K extends keyof SettingsModalState['provider']>(
      key: K,
      value: SettingsModalState['provider'][K]
    ) => {
      patchProviderState({ [key]: value } as Pick<SettingsModalState['provider'], K>);
    },
    [patchProviderState]
  );

  const setAppField = useCallback(
    <K extends keyof SettingsModalState['app']>(key: K, value: SettingsModalState['app'][K]) => {
      patchAppState({ [key]: value } as Pick<SettingsModalState['app'], K>);
    },
    [patchAppState]
  );
  const setUiField = useCallback(
    <K extends keyof SettingsModalState['ui']>(key: K, value: SettingsModalState['ui'][K]) => {
      patchUiState({ [key]: value } as Pick<SettingsModalState['ui'], K>);
    },
    [patchUiState]
  );
  const validation = useMemo(() => validateSettingsState(state), [state]);
  const isDirty = useMemo(
    () => serializeComparableSettingsState(state) !== serializeComparableSettingsState(stateSeed),
    [state, stateSeed]
  );

  const lastSyncedProviderIdRef = useRef<ProviderId | null>(null);
  const [showDiscardChangesPrompt, setShowDiscardChangesPrompt] = useState(false);
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      lastSyncedProviderIdRef.current = null;
      return;
    }
    if (state.provider.providerId !== currentProviderId) return;
    if (lastSyncedProviderIdRef.current === currentProviderId) return;

    const nextModelName = currentModelName?.trim() ?? '';
    if (state.provider.modelName.trim().length === 0 && nextModelName) {
      setProviderField('modelName', nextModelName);
    }
    lastSyncedProviderIdRef.current = currentProviderId;
  }, [
    currentModelName,
    currentProviderId,
    isOpen,
    setProviderField,
    state.provider.modelName,
    state.provider.providerId,
  ]);
  const requestClose = useCallback(() => {
    if (!isDirty) {
      setShowDiscardChangesPrompt(false);
      setShowValidationSummary(false);
      onClose();
      return;
    }

    setShowDiscardChangesPrompt(true);
  }, [isDirty, onClose]);
  const confirmDiscardChanges = useCallback(() => {
    setShowDiscardChangesPrompt(false);
    onClose();
  }, [onClose]);
  const cancelDiscardChanges = useCallback(() => {
    setShowDiscardChangesPrompt(false);
  }, []);
  const handleSave = useCallback(() => {
    if (saveBlockedReason || !isDirty) {
      return;
    }

    if (validation.errors.length > 0) {
      setShowValidationSummary(true);
      const firstErrorTab = validation.errors[0]?.tab;
      if (firstErrorTab && firstErrorTab !== state.ui.activeTab) {
        setUiField('activeTab', firstErrorTab);
      }
      return;
    }

    setShowValidationSummary(false);
    onSave(buildSettingsSavePayload(state));
    onClose();
  }, [isDirty, onClose, onSave, saveBlockedReason, setUiField, state, validation.errors]);
  const setEmbeddingField = useCallback(
    (key: keyof GeminiEmbeddingConfig, value: GeminiEmbeddingConfig[keyof GeminiEmbeddingConfig]) =>
      dispatch({
        type: 'set_embedding',
        payload: { key, value },
      }),
    [dispatch]
  );
  const setTavilyField = useCallback(
    (key: keyof TavilyConfig, value: TavilyConfig[keyof TavilyConfig]) =>
      dispatch({
        type: 'set_tavily',
        payload: { key, value },
      }),
    [dispatch]
  );
  const setChatAgentSearchEnabled = useCallback(
    (enabled: boolean) =>
      dispatch({ type: 'set_chat_agent_search_enabled', payload: { value: enabled } }),
    [dispatch]
  );
  const setChatAgentPrompt = useCallback(
    (value: string) => dispatch({ type: 'set_chat_agent_prompt', payload: { value } }),
    [dispatch]
  );
  const setChatAgentPromptPart = useCallback(
    (key: keyof SettingsModalState['provider']['chatAgentPromptParts'], value: string) => {
      dispatch({ type: 'set_chat_agent_prompt_part', payload: { key, value } });
      const nextParts = { ...state.provider.chatAgentPromptParts, [key]: value };
      const prompt = buildChatAgentPromptFromParts(state.provider.providerId, nextParts);
      if (prompt !== undefined) {
        dispatch({ type: 'set_chat_agent_prompt', payload: { value: prompt } });
      }
    },
    [dispatch, state.provider.chatAgentPromptParts, state.provider.providerId]
  );
  const addCustomHeader = useCallback(() => dispatch({ type: 'add_custom_header' }), [dispatch]);
  const setCustomHeaderKey = useCallback(
    (index: number, value: string) =>
      dispatch({ type: 'set_custom_header_key', payload: { index, value } }),
    [dispatch]
  );

  const setCustomHeaderValue = useCallback(
    (index: number, value: string) =>
      dispatch({ type: 'set_custom_header_value', payload: { index, value } }),
    [dispatch]
  );
  const removeCustomHeader = useCallback(
    (index: number) => dispatch({ type: 'remove_custom_header', payload: { index } }),
    [dispatch]
  );
  const providerActions = useMemo(
    () => ({
      onProviderChange: handleProviderChange,
      onModelNameChange: (value: string) => setProviderField('modelName', value),
      onApiKeyChange: (value: string) => setProviderField('apiKey', value),
      onRequestModeChange: (value: OpenAIRequestMode) => setProviderField('requestMode', value),
      onToggleApiKeyVisibility: () => setUiField('showApiKey', !state.ui.showApiKey),
      onClearApiKey: () => setProviderField('apiKey', ''),
      onToolCallMaxRoundsChange: (value: string) => setAppField('toolCallMaxRounds', value),
      onToolCallMaxRoundsBlur: () =>
        setAppField('toolCallMaxRounds', normalizeToolCallRounds(state.app.toolCallMaxRounds)),
      onBaseUrlChange: (value: string) => setProviderField('baseUrl', value),
      onGeminiCliProjectIdChange: (value: string) => setProviderField('geminiCliProjectId', value),
      onGoogleCloudProjectChange: (value: string) => setProviderField('googleCloudProject', value),
      onSetEmbeddingField: setEmbeddingField,
      onToggleChatAgent: (enabled: boolean) => setProviderField('chatAgentEnabled', enabled),
      onToggleChatAgentSearch: setChatAgentSearchEnabled,
      onSetChatAgentPrompt: setChatAgentPrompt,
      onSetChatAgentPromptPart: setChatAgentPromptPart,
      onAddCustomHeader: addCustomHeader,
      onSetCustomHeaderKey: setCustomHeaderKey,
      onSetCustomHeaderValue: setCustomHeaderValue,
      onRemoveCustomHeader: removeCustomHeader,
      onSetRegionBaseUrl: (region: 'intl' | 'cn') =>
        setProviderField('baseUrl', resolveBaseUrlForRegion(state.provider.providerId, region)),
    }),
    [
      addCustomHeader,
      handleProviderChange,
      removeCustomHeader,
      setChatAgentPrompt,
      setChatAgentPromptPart,
      setChatAgentSearchEnabled,
      setAppField,
      setCustomHeaderKey,
      setCustomHeaderValue,
      setEmbeddingField,
      setProviderField,
      setUiField,
      state.ui.showApiKey,
      state.provider.providerId,
      state.app.toolCallMaxRounds,
    ]
  );
  const searchActions = useMemo(
    () => ({
      onSetTavilyField: setTavilyField,
      onToggleTavilyKeyVisibility: () => setUiField('showTavilyKey', !state.ui.showTavilyKey),
    }),
    [setTavilyField, setUiField, state.ui.showTavilyKey]
  );
  const handleTabChange = useCallback(
    (id: ActiveSettingsTab) => setUiField('activeTab', id),
    [setUiField]
  );
  const appearanceActions = useMemo(
    () => ({
      onLanguagePreferenceChange: (value: LanguagePreference) =>
        setAppField('languagePreference', value),
      onThemePreferenceChange: (value: ThemePreference) => setAppField('themePreference', value),
    }),
    [setAppField]
  );
  const versionActions = useMemo(
    () => ({
      onSetAllowHttpTargets: (enabled: boolean) => setAppField('allowHttpTargets', enabled),
    }),
    [setAppField]
  );
  return {
    state,
    tabs,
    providerOptions,
    activeMeta,
    validation,
    isDirty,
    handleSave,
    requestClose,
    showDiscardChangesPrompt: isOpen && showDiscardChangesPrompt,
    confirmDiscardChanges,
    cancelDiscardChanges,
    showValidationSummary: isOpen && showValidationSummary && validation.errors.length > 0,
    onTabChange: handleTabChange,
    providerActions,
    appearanceActions,
    searchActions,
    versionActions,
  };
};
