import { TavilyConfig } from '@/shared/types/chat';
import { callTavilySearch, hasSearchConfig } from '@/infrastructure/providers/tavily';
import type {
  ResponseFunctionCallItem,
  ResponseFunctionTool,
  ResponseTavilyToolOptions,
  ResponseToolCallArgs,
  ResponseToolDefinition,
  ResponseToolExecutionMessages,
} from '@/infrastructure/providers/responsesSharedTypes';

const tavilySearchTool = (deferLoading = false): ResponseFunctionTool => ({
  type: 'function',
  name: 'tavily_search',
  description:
    'Search the web for up-to-date information and return relevant results with sources.',
  defer_loading: deferLoading ? true : undefined,
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      search_depth: {
        type: 'string',
        enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
        description: 'Search depth',
      },
      max_results: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Number of results to return',
      },
      topic: {
        type: 'string',
        enum: ['general', 'news', 'finance'],
        description: 'Search topic',
      },
      include_answer: { type: 'boolean', description: 'Include answer summary' },
    },
    required: ['query'],
    additionalProperties: false,
  },
});

export const createResponseTools = ({
  useHostedToolSearch = false,
}: {
  useHostedToolSearch?: boolean;
} = {}): ResponseToolDefinition[] => {
  if (!useHostedToolSearch) {
    return [tavilySearchTool(false)];
  }

  return [
    {
      type: 'namespace',
      name: 'search',
      description: 'Search and retrieval tools for finding current public information on the web.',
      tools: [tavilySearchTool(true)],
    },
    { type: 'tool_search' },
  ];
};

export const buildResponseTavilyTools = ({
  chatAgentEnabled,
  chatAgentSearchEnabled,
  tavilyConfig,
  useHostedToolSearch = false,
}: ResponseTavilyToolOptions): ResponseToolDefinition[] | undefined => {
  if (!chatAgentEnabled || !chatAgentSearchEnabled || !hasSearchConfig(tavilyConfig)) {
    return undefined;
  }

  return createResponseTools({ useHostedToolSearch });
};

export const parseResponseToolCallArgs = (call: ResponseFunctionCallItem): ResponseToolCallArgs => {
  try {
    return call.arguments ? (JSON.parse(call.arguments) as ResponseToolCallArgs) : {};
  } catch {
    return {};
  }
};

export const runResponseTavilyToolCall = async (
  call: ResponseFunctionCallItem,
  tavilyConfig: TavilyConfig | undefined,
  messages: ResponseToolExecutionMessages
): Promise<string> => {
  if (call.name !== 'tavily_search') {
    return JSON.stringify({
      error: messages.unsupportedTool(call.name),
    });
  }

  const args = parseResponseToolCallArgs(call);
  if (!args.query) {
    return JSON.stringify({ error: messages.missingQuery });
  }

  try {
    const result = await callTavilySearch(tavilyConfig, {
      query: args.query,
      search_depth: args.search_depth,
      max_results: args.max_results,
      topic: args.topic,
      include_answer: args.include_answer,
    });
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error:
        error instanceof Error
          ? error.message
          : (messages.requestFailed ?? 'Search request failed'),
    });
  }
};
