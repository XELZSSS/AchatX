export type {
  OpenAIChatCreateNonStreaming,
  OpenAIChatCreateStreaming,
  OpenAIChatMessages,
  OpenAIChatUsage,
  OpenAIStreamChunk,
  PreflightMessage,
  RunToolLoopOptions,
  StreamChunkOutput,
  StreamOptions,
  StreamWithToolCallLoopOptions,
  TavilyToolArgs,
  ToolCall,
  ToolLoopOverrides,
  ToolMessage,
} from '@/infrastructure/providers/openaiChatHelperTypes';

export {
  buildReasoningEffortExtraBody,
  shouldEmitReasoning,
  streamStandardChatCompletions,
} from '@/infrastructure/providers/openaiChatHelperStreaming';

export { runToolCallLoop } from '@/infrastructure/providers/openaiToolCallLoop';

import type { StreamWithToolCallLoopOptions } from '@/infrastructure/providers/openaiChatHelperTypes';
import {
  shouldEmitReasoning,
  streamStandardChatCompletions,
} from '@/infrastructure/providers/openaiChatHelperStreaming';
import { runToolCallLoop } from '@/infrastructure/providers/openaiToolCallLoop';

export async function* streamWithToolCallLoop({
  client,
  model,
  messages,
  tools,
  tavilyConfig,
  toolCallsEnabled,
  extraBody,
  signal,
  requestPolicy,
  emitReasoning = true,
  buildToolMessages,
  getAssistantMessageExtras,
  emitPreflightMessageWhenNoToolCalls = false,
}: StreamWithToolCallLoopOptions): AsyncGenerator<
  { content?: string; reasoning?: string },
  void,
  unknown
> {
  let messagesToStream = messages;
  let preflightMessage = null;
  let hadToolCalls = false;

  if (!toolCallsEnabled && toolCallsEnabled !== undefined) {
    for await (const chunk of streamStandardChatCompletions({
      client,
      model,
      messages,
      extraBody,
      signal,
    })) {
      if (!emitReasoning) {
        if (chunk.content) {
          yield { content: chunk.content };
        }
        continue;
      }
      yield chunk;
    }
    return;
  }

  if (tools) {
    const toolResult = await runToolCallLoop({
      client,
      model,
      messages,
      tools,
      tavilyConfig,
      extraBody,
      signal,
      requestPolicy,
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
    if (!emitReasoning) {
      if (chunk.content) {
        yield { content: chunk.content };
      }
      continue;
    }
    yield chunk;
  }
}

export async function* streamWithToolCallLoopAndAccumulate({
  wrapReasoning = (reasoning: string) => `<think>${reasoning}</think>`,
  ...options
}: StreamWithToolCallLoopOptions & {
  wrapReasoning?: (reasoning: string) => string;
}): AsyncGenerator<string, string, unknown> {
  let fullResponse = '';
  for await (const chunk of streamWithToolCallLoop(options)) {
    if (chunk.reasoning && shouldEmitReasoning(chunk.reasoning)) {
      yield wrapReasoning(chunk.reasoning);
    }
    if (chunk.content) {
      fullResponse += chunk.content;
      yield chunk.content;
    }
  }
  return fullResponse;
}
