import { MAX_TOOL_CALL_ROUNDS, MIN_TOOL_CALL_ROUNDS } from '@/infrastructure/providers/utils';
import type {
  SaveProviderSettingsPayload,
  SaveSettingsPayload,
} from '@/presentation/components/settingsModal/types';
import type { SettingsModalState } from '@/presentation/components/settingsModal/reducer';

const clampToolCallRounds = (value: number): number =>
  Math.min(Math.max(value, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS);

export const normalizeToolCallRounds = (value: string): string => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return '';
  return String(clampToolCallRounds(parsed));
};

export const buildProviderSettingsSavePayload = (
  state: SettingsModalState
): SaveProviderSettingsPayload => ({
  providerId: state.provider.providerId,
  modelName: state.provider.modelName,
  apiKey: state.provider.apiKey,
  requestMode: state.provider.requestMode,
  baseUrl: state.provider.baseUrl,
  geminiCliProjectId: state.provider.geminiCliProjectId,
  googleCloudProject: state.provider.googleCloudProject,
  customHeaders: state.provider.customHeaders,
  tavily: state.provider.tavily,
  embedding: state.provider.embedding,
  chatAgentEnabled: state.provider.chatAgentEnabled,
  chatAgentPrompt: state.provider.chatAgentPrompt,
  chatAgentPromptParts: state.provider.chatAgentPromptParts,
  chatAgentSearchEnabled: state.provider.chatAgentSearchEnabled,
});

export const buildSettingsSavePayload = (state: SettingsModalState): SaveSettingsPayload => ({
  provider: buildProviderSettingsSavePayload(state),
  app: { ...state.app },
});
