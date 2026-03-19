import {
  FunctionCallingConfigMode,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type GoogleGenAI,
  type Part,
  type ThinkingConfig,
  type ThinkingLevel,
  type ToolListUnion,
} from '@google/genai';
import { ChatMessage, type ProviderId, Role, type TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { getDefaultChatAgentPrompt } from '@/infrastructure/providers/chatAgent';
import { TavilyToolArgs } from '@/infrastructure/providers/openaiChatHelpers';
import {
  callTavilySearch,
  hasSearchConfig,
} from '@/infrastructure/providers/tavily';
import type { ProviderReasoningPreference } from '@/infrastructure/providers/types';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import {
  decideAdaptiveToolParallelism,
  runWithConcurrency,
} from '@/infrastructure/providers/requestPolicy';
import { buildSystemInstruction } from '@/infrastructure/providers/prompts';

export type GeminiChunkPayload = {
  content: string;
  reasoning: string;
};

const GEMINI_THINKING_CONFIG: ThinkingConfig = {
  includeThoughts: true,
  thinkingLevel: 'HIGH' as ThinkingLevel,
};

const TAVILY_SEARCH_PARAMETERS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', description: 'Search query' },
    search_depth: {
      type: 'string',
      enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
      description: 'Search depth',
    },
    max_results: { type: 'integer', minimum: 1, maximum: 20, description: 'Number of results to return' },
    topic: {
      type: 'string',
      enum: ['general', 'news', 'finance'],
      description: 'Search topic',
    },
    include_answer: { type: 'boolean', description: 'Include answer summary' },
  },
  required: ['query'],
} as const;

export const extractGeminiChunkPayload = (response: GenerateContentResponse): GeminiChunkPayload => {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let content = '';
  let reasoning = '';

  for (const part of parts) {
    const text = part.text ?? '';
    if (!text) continue;
    if (part.thought) {
      reasoning += text;
    } else {
      content += text;
    }
  }

  if (!content && response.text) {
    content = response.text;
  }

  return { content, reasoning };
};

export const createGeminiModelMessage = (text: string, reasoning: string): ChatMessage => ({
  id: `gemini-cli-model-${Date.now()}`,
  role: Role.Model,
  text,
  reasoning: reasoning || undefined,
  timestamp: Date.now(),
});

export const buildGeminiCliContents = (history: ChatMessage[]): Content[] => {
  return history
    .filter((msg) => !msg.isError)
    .map((msg) => ({
      role: msg.role === Role.User ? 'user' : 'model',
      parts: [{ text: msg.text }] as Part[],
    }));
};

export const buildGeminiCliTools = (
  chatAgentEnabled: boolean,
  chatAgentSearchEnabled: boolean,
  tavilyConfig?: TavilyConfig
): ToolListUnion | undefined => {
  if (!chatAgentEnabled || !chatAgentSearchEnabled || !hasSearchConfig(tavilyConfig)) {
    return undefined;
  }

  const tavilySearchDeclaration: FunctionDeclaration = {
    name: 'tavily_search',
    description: 'Search the web for up-to-date information and return relevant results with sources.',
    parametersJsonSchema: TAVILY_SEARCH_PARAMETERS_JSON_SCHEMA,
  };

  return [{ functionDeclarations: [tavilySearchDeclaration] }];
};

export const buildGeminiCliConfig = ({
  providerId,
  modelName,
  chatAgentEnabled,
  chatAgentPrompt,
  reasoningPreference,
  tools,
  signal,
}: {
  providerId: ProviderId;
  modelName: string;
  chatAgentEnabled: boolean;
  chatAgentPrompt: string;
  reasoningPreference: ProviderReasoningPreference;
  tools?: ToolListUnion;
  signal?: AbortSignal;
}) => {
  return {
    ...(signal ? { abortSignal: signal } : {}),
    systemInstruction: buildSystemInstruction(
      providerId,
      modelName,
      chatAgentEnabled,
      chatAgentPrompt || getDefaultChatAgentPrompt(providerId) || ''
    ),
    ...(reasoningPreference.enabled ? { thinkingConfig: GEMINI_THINKING_CONFIG } : {}),
    ...(tools
      ? {
          tools,
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
              allowedFunctionNames: ['tavily_search'],
            },
          },
        }
      : {}),
  };
};

export const createGeminiCliChatSession = ({
  client,
  providerId,
  modelName,
  chatAgentEnabled,
  chatAgentPrompt,
  reasoningPreference,
  history,
  tools,
  signal,
}: {
  client: GoogleGenAI;
  providerId: ProviderId;
  modelName: string;
  chatAgentEnabled: boolean;
  chatAgentPrompt: string;
  reasoningPreference: ProviderReasoningPreference;
  history: ChatMessage[];
  tools?: ToolListUnion;
  signal?: AbortSignal;
}) => {
  return client.chats.create({
    model: modelName,
    config: buildGeminiCliConfig({
      providerId,
      modelName,
      chatAgentEnabled,
      chatAgentPrompt,
      reasoningPreference,
      tools,
      signal,
    }),
    history: buildGeminiCliContents(history),
  });
};

export const buildGeminiCliToolResponseParts = async ({
  tavilyConfig,
  functionCalls,
  requestPolicy,
}: {
  tavilyConfig?: TavilyConfig;
  functionCalls: FunctionCall[];
  requestPolicy?: RequestPolicy;
}): Promise<Part[]> => {
  return runWithConcurrency(
    functionCalls,
    Math.max(
      1,
      Math.min(
        requestPolicy?.toolParallelism ?? Number.MAX_SAFE_INTEGER,
        decideAdaptiveToolParallelism(
          functionCalls.map((call) => (call.args ?? {}) as TavilyToolArgs)
        )
      )
    ),
    async (call) => {
      if (call.name !== 'tavily_search') {
        return {
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { error: `${t('settings.provider.error.tool.unsupported')}: ${call.name}` },
          },
        } satisfies Part;
      }

      const args = (call.args ?? {}) as TavilyToolArgs;
      if (!args.query) {
        return {
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { error: t('settings.provider.error.tool.missingQuery') },
          },
        } satisfies Part;
      }

      try {
        const result = await callTavilySearch(tavilyConfig, {
          query: args.query,
          search_depth: args.search_depth,
          max_results: args.max_results,
          topic: args.topic,
          include_answer: args.include_answer,
        });
        return {
          functionResponse: {
            id: call.id,
            name: call.name,
            response: result as Record<string, unknown>,
          },
        } satisfies Part;
      } catch (error) {
        return {
          functionResponse: {
            id: call.id,
            name: call.name,
            response: {
              error: error instanceof Error ? error.message : t('settings.search.error.requestFailed'),
            },
          },
        } satisfies Part;
      }
    }
  );
};
