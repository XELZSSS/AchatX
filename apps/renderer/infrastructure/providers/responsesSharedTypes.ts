import { TavilyConfig } from '@/shared/types/chat';

export type ResponseInputMessage = {
  type: 'message';
  role: 'user' | 'assistant';
  content: Array<{ type: 'input_text'; text: string } | { type: 'output_text'; text: string }>;
};

export type ResponseFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  defer_loading?: boolean;
  strict: true;
  parameters: {
    type: 'object';
    properties: {
      query: { type: 'string'; description: string };
      search_depth: {
        type: 'string';
        enum: ['basic', 'advanced', 'fast', 'ultra-fast'];
        description: string;
      };
      max_results: {
        type: 'integer';
        minimum: 1;
        maximum: 20;
        description: string;
      };
      topic: {
        type: 'string';
        enum: ['general', 'news', 'finance'];
        description: string;
      };
      include_answer: { type: 'boolean'; description: string };
    };
    required: ['query'];
    additionalProperties: false;
  };
};

export type ResponseNamespaceTool = {
  type: 'namespace';
  name: string;
  description: string;
  tools: ResponseFunctionTool[];
};

export type ResponseToolSearchTool = {
  type: 'tool_search';
};

export type ResponseToolDefinition =
  | ResponseFunctionTool
  | ResponseNamespaceTool
  | ResponseToolSearchTool;

export type ResponseFunctionCallItem = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
  namespace?: string;
};

export type ResponseUsagePayload = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

export type ResponseStreamEvent = {
  type?: string;
  delta?: string;
  text?: string;
  part?: {
    type?: string;
    text?: string;
  };
  item?: {
    type?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    namespace?: string;
  };
  response?: {
    id?: string;
    usage?: ResponseUsagePayload;
    output?: Array<{
      type?: string;
      summary?: Array<{
        type?: string;
        text?: string;
      }>;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };
};

export type ProcessResponseStreamEventOptions = {
  event: ResponseStreamEvent;
  emittedReasoningTexts: Set<string>;
  functionCalls: Map<string, ResponseFunctionCallItem>;
  emitReasoning?: boolean;
  wrapReasoning?: (text: string) => string;
};

export type ProcessedResponseStreamEvent = {
  responseId?: string;
  usage?: ResponseUsagePayload;
  textDeltas: string[];
  failed: boolean;
};

export type ResponseToolCallArgs = {
  query?: string;
  search_depth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  max_results?: number;
  topic?: 'general' | 'news' | 'finance';
  include_answer?: boolean;
};

export type ResponseTavilyToolOptions = {
  chatAgentEnabled: boolean;
  chatAgentSearchEnabled: boolean;
  tavilyConfig?: TavilyConfig;
  useHostedToolSearch?: boolean;
};

export type ResponseToolExecutionMessages = {
  unsupportedTool: (toolName: string) => string;
  missingQuery: string;
  requestFailed?: string;
};
