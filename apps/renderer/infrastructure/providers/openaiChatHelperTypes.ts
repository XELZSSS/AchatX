import OpenAI from 'openai';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import type { TavilyConfig } from '@/shared/types/chat';

export type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

export type ToolMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

export type PreflightMessage = OpenAI.Chat.Completions.ChatCompletionMessage & {
  tool_calls?: ToolCall[];
  reasoning_content?: string;
  reasoning?: string;
  reasoning_details?: Array<{ text?: string }>;
};

export type OpenAIChatMessages = Array<{
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
}>;

export type OpenAIChatCreateNonStreaming =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
    extra_body?: Record<string, unknown>;
  };

export type OpenAIChatCreateStreaming =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & {
    extra_body?: Record<string, unknown>;
  };

export type OpenAIChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  total_cost?: number;
};

export type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      reasoning_text?: string;
      reasoning?: string;
      reasoning_details?: Array<{ text?: string }>;
    };
    message?: {
      content?: string;
      reasoning_content?: string;
      reasoning_text?: string;
      reasoning?: string;
      reasoning_details?: Array<{ text?: string }>;
    };
  }>;
  usage?: OpenAIChatUsage;
};

export type TavilyToolArgs = {
  query?: string;
  search_depth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  max_results?: number;
  topic?: 'general' | 'news' | 'finance';
  include_answer?: boolean;
};

export type RunToolLoopOptions = {
  client: OpenAI;
  model: string;
  messages: OpenAIChatMessages;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tavilyConfig?: TavilyConfig;
  maxRounds?: number;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
  requestPolicy?: RequestPolicy;
  buildToolMessages: (
    toolCalls: ToolCall[],
    tavilyConfig?: TavilyConfig,
    requestPolicy?: RequestPolicy
  ) => Promise<ToolMessage[]>;
  getAssistantMessageExtras?: (message: PreflightMessage) => Record<string, unknown> | null;
};

export type ToolLoopOverrides = Pick<RunToolLoopOptions, 'extraBody' | 'getAssistantMessageExtras'>;

export type StreamChunkOutput = { content?: string; reasoning?: string };

export type StreamOptions = {
  client: OpenAI;
  model: string;
  messages: OpenAIChatMessages;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type RunToolLoopResult = {
  messages: OpenAIChatMessages;
  preflightMessage: PreflightMessage | null;
  hadToolCalls: boolean;
};

export type StreamWithToolCallLoopOptions = {
  client: OpenAI;
  model: string;
  messages: OpenAIChatMessages;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tavilyConfig?: TavilyConfig;
  toolCallsEnabled?: boolean;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
  requestPolicy?: RequestPolicy;
  emitReasoning?: boolean;
  buildToolMessages: (
    toolCalls: ToolCall[],
    tavilyConfig?: TavilyConfig,
    requestPolicy?: RequestPolicy
  ) => Promise<ToolMessage[]>;
  getAssistantMessageExtras?: (message: PreflightMessage) => Record<string, unknown> | null;
  emitPreflightMessageWhenNoToolCalls?: boolean;
};
