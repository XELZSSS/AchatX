import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_TOOL_CALL_ROUNDS, MIN_TOOL_CALL_ROUNDS } from '../../services/providers/utils';
import { TavilyConfig } from '../../types';
import { ActiveSettingsTab, SettingsModalState } from './reducer';
import { resolveBaseUrlForRegion } from './constants';
import { useSettingsForm } from './useSettingsForm';
import { ProviderSettingsMap, SaveSettingsPayload } from './types';
import { removeAppStorage, writeAppStorage } from '../../services/storageKeys';

type UseSettingsControllerOptions = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: SaveSettingsPayload) => void;
  providerSettings: ProviderSettingsMap;
} & Omit<Parameters<typeof useSettingsForm>[0], 'isOpen'>;

const normalizeToolCallRounds = (value: string): string => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return '';
  return String(Math.min(Math.max(parsed, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS));
};

const persistToolCallRounds = (value: string): void => {
  const parsed = Number.parseInt(value, 10);
  const normalized = Number.isNaN(parsed)
    ? null
    : Math.min(Math.max(parsed, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS);

  if (typeof window === 'undefined') return;
  if (normalized === null) {
    removeAppStorage('toolCallMaxRounds');
    return;
  }
  writeAppStorage('toolCallMaxRounds', String(normalized));
};

const persistOptionalStorageField = (key: 'mem0ApiKey' | 'mem0UserId', value: string): void => {
  const normalized = value.trim();
  if (!normalized) {
    removeAppStorage(key);
    return;
  }
  writeAppStorage(key, normalized);
};

const persistProxyStaticHttp2Enabled = (enabled: boolean): void => {
  writeAppStorage('proxyStaticHttp2', enabled ? '1' : '0');
};

export const useSettingsController = ({
  isOpen,
  onClose,
  onSave,
  ...formOptions
}: UseSettingsControllerOptions) => {
  const { state, dispatch, providerOptions, activeMeta, tabs, handleProviderChange } =
    useSettingsForm({
      isOpen,
      ...formOptions,
    });

  const patchState = useCallback(
    (payload: Partial<SettingsModalState>) => dispatch({ type: 'patch', payload }),
    [dispatch]
  );

  const setField = useCallback(
    <K extends keyof SettingsModalState>(key: K, value: SettingsModalState[K]) => {
      patchState({ [key]: value } as Pick<SettingsModalState, K>);
    },
    [patchState]
  );

  const overlayRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }
    setPortalContainer(overlayRef.current);
    const frame = window.requestAnimationFrame(() => {
      setPortalContainer(overlayRef.current);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  const handleSave = useCallback(() => {
    persistToolCallRounds(state.toolCallMaxRounds);
    persistOptionalStorageField('mem0ApiKey', state.mem0ApiKey);
    persistOptionalStorageField('mem0UserId', state.mem0UserId);
    persistProxyStaticHttp2Enabled(state.staticProxyHttp2Enabled);

    onSave({
      providerId: state.providerId,
      modelName: state.modelName,
      apiKey: state.apiKey,
      baseUrl: state.baseUrl,
      customHeaders: state.customHeaders,
      tavily: state.tavily,
      staticProxyHttp2Enabled: state.staticProxyHttp2Enabled,
    });
    onClose();
  }, [onClose, onSave, state]);

  const providerActions = useMemo(
    () => ({
      onProviderChange: handleProviderChange,
      onModelNameChange: (value: string) => setField('modelName', value),
      onApiKeyChange: (value: string) => setField('apiKey', value),
      onToggleApiKeyVisibility: () => setField('showApiKey', !state.showApiKey),
      onClearApiKey: () => setField('apiKey', ''),
      onToolCallMaxRoundsChange: (value: string) => setField('toolCallMaxRounds', value),
      onToolCallMaxRoundsBlur: () =>
        setField('toolCallMaxRounds', normalizeToolCallRounds(state.toolCallMaxRounds)),
      onBaseUrlChange: (value: string) => setField('baseUrl', value),
      onAddCustomHeader: () => dispatch({ type: 'add_custom_header' }),
      onSetCustomHeaderKey: (index: number, value: string) =>
        dispatch({ type: 'set_custom_header_key', payload: { index, value } }),
      onSetCustomHeaderValue: (index: number, value: string) =>
        dispatch({ type: 'set_custom_header_value', payload: { index, value } }),
      onRemoveCustomHeader: (index: number) =>
        dispatch({ type: 'remove_custom_header', payload: { index } }),
      onSetRegionBaseUrl: (region: 'intl' | 'cn') =>
        setField('baseUrl', resolveBaseUrlForRegion(state.providerId, region)),
    }),
    [
      dispatch,
      handleProviderChange,
      setField,
      state.showApiKey,
      state.toolCallMaxRounds,
      state.providerId,
    ]
  );

  const searchActions = useMemo(
    () => ({
      onSetTavilyField: (key: keyof TavilyConfig, value: TavilyConfig[keyof TavilyConfig]) =>
        dispatch({
          type: 'set_tavily',
          payload: { key, value },
        }),
      onToggleTavilyKeyVisibility: () => setField('showTavilyKey', !state.showTavilyKey),
    }),
    [dispatch, setField, state.showTavilyKey]
  );

  const memoryExportActions = useMemo(
    () => ({
      onMem0ApiKeyChange: (value: string) => setField('mem0ApiKey', value),
      onMem0UserIdChange: (value: string) => setField('mem0UserId', value),
      onToggleMem0ApiKeyVisibility: () => setField('showMem0ApiKey', !state.showMem0ApiKey),
    }),
    [setField, state.showMem0ApiKey]
  );

  const handleTabChange = useCallback(
    (id: ActiveSettingsTab) => setField('activeTab', id),
    [setField]
  );

  const versionActions = useMemo(
    () => ({
      onSetStaticProxyHttp2Enabled: (enabled: boolean) =>
        setField('staticProxyHttp2Enabled', enabled),
    }),
    [setField]
  );

  return {
    state,
    tabs,
    overlayRef,
    portalContainer,
    providerOptions,
    activeMeta,
    handleSave,
    onTabChange: handleTabChange,
    providerActions,
    searchActions,
    memoryExportActions,
    versionActions,
  };
};
