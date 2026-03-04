import OpenAI from 'openai';
import type { TavilyConfig } from '../../types';
import { getMaxToolCallRounds } from './utils';

type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type ToolMessage = {
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

type RunToolLoopOptions = {
  client: OpenAI;
  model: string;
  messages: OpenAIChatMessages;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tavilyConfig?: TavilyConfig;
  maxRounds?: number;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
  buildToolMessages: (toolCalls: ToolCall[], tavilyConfig?: TavilyConfig) => Promise<ToolMessage[]>;
  getAssistantMessageExtras?: (message: PreflightMessage) => Record<string, unknown> | null;
};

export type ToolLoopOverrides = Pick<RunToolLoopOptions, 'extraBody' | 'getAssistantMessageExtras'>;

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
};

export type TavilyToolArgs = {
  query?: string;
  search_depth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  max_results?: number;
  topic?: 'general' | 'news' | 'finance';
  include_answer?: boolean;
};

type LegacyLoopMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
};

type RunToolLoopResult = {
  messages: OpenAIChatMessages;
  preflightMessage: PreflightMessage | null;
  hadToolCalls: boolean;
};

const createChatCompletion = async (
  client: OpenAI,
  params: OpenAIChatCreateNonStreaming | OpenAIChatCreateStreaming,
  signal?: AbortSignal
) => {
  if (signal) {
    return (
      client.chat.completions.create as unknown as (
        request: OpenAIChatCreateNonStreaming | OpenAIChatCreateStreaming,
        options: { signal: AbortSignal }
      ) => Promise<unknown>
    )(params, { signal });
  }
  return client.chat.completions.create(params as OpenAIChatCreateNonStreaming);
};

export const runToolCallLoop = async ({
  client,
  model,
  messages,
  tools,
  tavilyConfig,
  maxRounds = getMaxToolCallRounds(),
  extraBody,
  signal,
  buildToolMessages,
  getAssistantMessageExtras,
}: RunToolLoopOptions): Promise<RunToolLoopResult> => {
  if (!tools) {
    return { messages, preflightMessage: null, hadToolCalls: false };
  }

  let workingMessages = messages;
  let preflightMessage: PreflightMessage | null = null;
  let hadToolCalls = false;

  for (let round = 0; round < maxRounds; round += 1) {
    const initialResponse = (await createChatCompletion(
      client,
      {
        model,
        messages: workingMessages,
        tools,
        tool_choice: 'auto',
        stream: false,
        ...(extraBody ? { extra_body: extraBody } : {}),
      } as OpenAIChatCreateNonStreaming,
      signal
    )) as OpenAI.Chat.Completions.ChatCompletion;

    preflightMessage = (initialResponse?.choices?.[0]?.message as PreflightMessage) ?? null;
    const toolCalls = (preflightMessage?.tool_calls as ToolCall[]) ?? [];

    if (!toolCalls.length) {
      break;
    }

    hadToolCalls = true;
    const toolMessages = await buildToolMessages(toolCalls, tavilyConfig);
    const extras = getAssistantMessageExtras?.(preflightMessage) ?? {};
    workingMessages = [
      ...workingMessages,
      {
        role: 'assistant' as const,
        content: preflightMessage?.content ?? null,
        tool_calls: toolCalls,
        ...extras,
      } as LegacyLoopMessage,
      ...toolMessages,
    ];
  }

  return { messages: workingMessages, preflightMessage, hadToolCalls };
};

type StreamOptions = {
  client: OpenAI;
  model: string;
  messages: OpenAIChatMessages;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
};

export async function* streamStandardChatCompletions({
  client,
  model,
  messages,
  extraBody,
  signal,
}: StreamOptions): AsyncGenerator<{ content?: string; reasoning?: string }, void, unknown> {
  const stream = (await createChatCompletion(
    client,
    {
      model,
      messages,
      stream: true,
      ...(extraBody ? { extra_body: extraBody } : {}),
    } as OpenAIChatCreateStreaming,
    signal
  )) as AsyncIterable<OpenAIStreamChunk>;

  for await (const chunk of stream) {
    const reasoningDetails =
      chunk.choices?.[0]?.delta?.reasoning_details ??
      chunk.choices?.[0]?.message?.reasoning_details;
    if (reasoningDetails?.length) {
      for (const detail of reasoningDetails) {
        if (detail?.text) {
          yield { reasoning: detail.text };
        }
      }
    }

    const reasoningDelta =
      chunk.choices?.[0]?.delta?.reasoning_content ??
      chunk.choices?.[0]?.delta?.reasoning_text ??
      chunk.choices?.[0]?.delta?.reasoning ??
      chunk.choices?.[0]?.message?.reasoning_content ??
      chunk.choices?.[0]?.message?.reasoning_text ??
      chunk.choices?.[0]?.message?.reasoning;
    if (reasoningDelta) {
      yield { reasoning: reasoningDelta };
    }

    const contentDelta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
    if (contentDelta) {
      yield { content: contentDelta };
    }
  }
}

type StreamWithToolCallLoopOptions = {
  client: OpenAI;
  model: string;
  messages: OpenAIChatMessages;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tavilyConfig?: TavilyConfig;
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
  buildToolMessages: (toolCalls: ToolCall[], tavilyConfig?: TavilyConfig) => Promise<ToolMessage[]>;
  getAssistantMessageExtras?: (message: PreflightMessage) => Record<string, unknown> | null;
  emitPreflightMessageWhenNoToolCalls?: boolean;
};

export async function* streamWithToolCallLoop({
  client,
  model,
  messages,
  tools,
  tavilyConfig,
  extraBody,
  signal,
  buildToolMessages,
  getAssistantMessageExtras,
  emitPreflightMessageWhenNoToolCalls = false,
}: StreamWithToolCallLoopOptions): AsyncGenerator<
  { content?: string; reasoning?: string },
  void,
  unknown
> {
  let messagesToStream = messages;
  let preflightMessage: PreflightMessage | null = null;
  let hadToolCalls = false;

  if (tools) {
    const toolResult = await runToolCallLoop({
      client,
      model,
      messages,
      tools,
      tavilyConfig,
      extraBody,
      signal,
      buildToolMessages,
      getAssistantMessageExtras,
    });
    messagesToStream = toolResult.messages;
    preflightMessage = toolResult.preflightMessage;
    hadToolCalls = toolResult.hadToolCalls;
  }

  if (emitPreflightMessageWhenNoToolCalls && tools && !hadToolCalls && preflightMessage?.content) {
    yield { content: preflightMessage.content };
    return;
  }

  for await (const chunk of streamStandardChatCompletions({
    client,
    model,
    messages: messagesToStream,
    extraBody,
    signal,
  })) {
    yield chunk;
  }
}
