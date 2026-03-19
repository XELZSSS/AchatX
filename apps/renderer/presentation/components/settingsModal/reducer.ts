import { GeminiEmbeddingConfig, ProviderId, TavilyConfig } from '@/shared/types/chat';
import type { LanguagePreference } from '@/shared/utils/i18n';
import type { ThemePreference } from '@/shared/utils/theme';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';

export type ActiveSettingsTab =
  | 'provider'
  | 'appearance'
  | 'agent'
  | 'search'
  | 'version'
  | 'shortcuts';

export type SettingsModalState = {
  provider: {
    providerId: ProviderId;
    modelName: string;
    apiKey: string;
    requestMode?: OpenAIRequestMode;
    baseUrl?: string;
    geminiCliProjectId: string;
    googleCloudProject: string;
    customHeaders: Array<{ key: string; value: string }>;
    tavily: TavilyConfig;
    embedding: GeminiEmbeddingConfig;
    chatAgentEnabled: boolean;
    chatAgentPrompt: string;
    chatAgentPromptParts: {
      identity: string;
      role: string;
      setting: string;
    };
    chatAgentSearchEnabled: boolean;
  };
  app: {
    activeProviderId: ProviderId;
    languagePreference: LanguagePreference;
    themePreference: ThemePreference;
    allowHttpTargets: boolean;
    toolCallMaxRounds: string;
  };
  ui: {
    showApiKey: boolean;
    showTavilyKey: boolean;
    activeTab: ActiveSettingsTab;
  };
};

export type SettingsModalAction =
  | { type: 'replace'; payload: SettingsModalState }
  | { type: 'patch_provider'; payload: Partial<SettingsModalState['provider']> }
  | { type: 'patch_app'; payload: Partial<SettingsModalState['app']> }
  | { type: 'patch_ui'; payload: Partial<SettingsModalState['ui']> }
  | {
      type: 'set_tavily';
      payload: {
        key: keyof TavilyConfig;
        value: TavilyConfig[keyof TavilyConfig];
      };
    }
  | {
      type: 'set_embedding';
      payload: {
        key: keyof GeminiEmbeddingConfig;
        value: GeminiEmbeddingConfig[keyof GeminiEmbeddingConfig];
      };
    }
  | { type: 'set_chat_agent_prompt'; payload: { value: string } }
  | {
      type: 'set_chat_agent_prompt_part';
      payload: {
        key: keyof SettingsModalState['provider']['chatAgentPromptParts'];
        value: string;
      };
    }
  | { type: 'set_chat_agent_search_enabled'; payload: { value: boolean } }
  | { type: 'add_custom_header' }
  | { type: 'remove_custom_header'; payload: { index: number } }
  | { type: 'set_custom_header_key'; payload: { index: number; value: string } }
  | { type: 'set_custom_header_value'; payload: { index: number; value: string } };

const patchCustomHeaderAtIndex = (
  state: SettingsModalState,
  index: number,
  payload: Partial<SettingsModalState['provider']['customHeaders'][number]>
): SettingsModalState => ({
  ...state,
  provider: {
    ...state.provider,
    customHeaders: state.provider.customHeaders.map((header, headerIndex) =>
      headerIndex === index ? { ...header, ...payload } : header
    ),
  },
});

export const settingsModalReducer = (
  state: SettingsModalState,
  action: SettingsModalAction
): SettingsModalState => {
  switch (action.type) {
    case 'replace':
      return action.payload;
    case 'patch_provider':
      return { ...state, provider: { ...state.provider, ...action.payload } };
    case 'patch_app':
      return { ...state, app: { ...state.app, ...action.payload } };
    case 'patch_ui':
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'set_tavily':
      return {
        ...state,
        provider: {
          ...state.provider,
          tavily: { ...state.provider.tavily, [action.payload.key]: action.payload.value },
        },
      };
    case 'set_embedding':
      return {
        ...state,
        provider: {
          ...state.provider,
          embedding: { ...state.provider.embedding, [action.payload.key]: action.payload.value },
        },
      };
    case 'set_chat_agent_prompt':
      return {
        ...state,
        provider: {
          ...state.provider,
          chatAgentPrompt: action.payload.value,
        },
      };
    case 'set_chat_agent_prompt_part':
      return {
        ...state,
        provider: {
          ...state.provider,
          chatAgentPromptParts: {
            ...state.provider.chatAgentPromptParts,
            [action.payload.key]: action.payload.value,
          },
        },
      };
    case 'set_chat_agent_search_enabled':
      return {
        ...state,
        provider: {
          ...state.provider,
          chatAgentSearchEnabled: action.payload.value,
        },
      };
    case 'add_custom_header':
      return {
        ...state,
        provider: {
          ...state.provider,
          customHeaders: [...state.provider.customHeaders, { key: '', value: '' }],
        },
      };
    case 'remove_custom_header':
      return {
        ...state,
        provider: {
          ...state.provider,
          customHeaders: state.provider.customHeaders.filter(
            (_, index) => index !== action.payload.index
          ),
        },
      };
    case 'set_custom_header_key':
      return patchCustomHeaderAtIndex(state, action.payload.index, { key: action.payload.value });
    case 'set_custom_header_value':
      return patchCustomHeaderAtIndex(state, action.payload.index, {
        value: action.payload.value,
      });
    default:
      return state;
  }
};
