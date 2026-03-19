import OpenAI from 'openai';
import { getMaxToolCallRounds } from '@/infrastructure/providers/utils';
import type {
  OpenAIChatCreateNonStreaming,
  OpenAIChatMessages,
  PreflightMessage,
  RunToolLoopOptions,
  RunToolLoopResult,
  ToolCall,
  ToolMessage,
} from '@/infrastructure/providers/openaiChatHelperTypes';
import { createChatCompletion } from '@/infrastructure/providers/openaiChatHelperStreaming';

type LegacyLoopMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
};

const buildPreflightCompletionRequest = (
  model: string,
  messages: OpenAIChatMessages,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[],
  extraBody?: Record<string, unknown>
): OpenAIChatCreateNonStreaming =>
  ({
    model,
    messages,
    tools,
    tool_choice: 'auto',
    stream: false,
    ...(extraBody ? { extra_body: extraBody } : {}),
  }) as OpenAIChatCreateNonStreaming;

const appendAssistantAndToolMessages = (
  messages: OpenAIChatMessages,
  preflightMessage: PreflightMessage | null,
  toolCalls: ToolCall[],
  toolMessages: ToolMessage[],
  extras: Record<string, unknown>
): OpenAIChatMessages => [
  ...messages,
  {
    role: 'assistant' as const,
    content: preflightMessage?.content ?? null,
    tool_calls: toolCalls,
    ...extras,
  } as LegacyLoopMessage,
  ...toolMessages,
];

export const runToolCallLoop = async ({
  client,
  model,
  messages,
  tools,
  tavilyConfig,
  maxRounds = getMaxToolCallRounds(),
  extraBody,
  signal,
  requestPolicy,
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
      buildPreflightCompletionRequest(model, workingMessages, tools, extraBody),
      signal
    )) as OpenAI.Chat.Completions.ChatCompletion;

    preflightMessage = (initialResponse?.choices?.[0]?.message as PreflightMessage) ?? null;
    const toolCalls = (preflightMessage?.tool_calls as ToolCall[]) ?? [];

    if (!toolCalls.length) {
      break;
    }

    hadToolCalls = true;
    const toolMessages = await buildToolMessages(toolCalls, tavilyConfig, requestPolicy);
    const extras = getAssistantMessageExtras?.(preflightMessage) ?? {};
    workingMessages = appendAssistantAndToolMessages(
      workingMessages,
      preflightMessage,
      toolCalls,
      toolMessages,
      extras
    );
  }

  return { messages: workingMessages, preflightMessage, hadToolCalls };
};
