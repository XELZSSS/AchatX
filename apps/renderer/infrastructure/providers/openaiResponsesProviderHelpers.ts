import OpenAI from 'openai';
import { buildSystemInstruction } from '@/infrastructure/providers/prompts';
import { shouldEmitReasoning } from '@/infrastructure/providers/openaiChatHelpers';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import {
  processResponseStreamEvent,
  supportsResponseReasoningSummary,
  type ResponseFunctionCallItem,
  type ResponseStreamEvent,
  type ResponseToolDefinition,
  type ResponseUsagePayload,
} from '@/infrastructure/providers/responsesShared';
import type { ProviderId } from '@/shared/types/chat';

type ResponseTurnInputItem =
  | import('@/infrastructure/providers/responsesShared').ResponseInputMessage
  | { type: 'function_call_output'; call_id: string; output: string };

export type ResponseTurnInput = string | ResponseTurnInputItem[] | undefined;

export type ResponseReasoningConfig = {
  summary: 'auto';
  effort?: string;
};

export type ResponseStreamChunk =
  | { kind: 'text'; value: string }
  | {
      kind: 'response';
      id?: string;
      functionCalls: ResponseFunctionCallItem[];
      usage?: ResponseUsagePayload;
    };

const buildResponsesTurnRequest = ({
  providerId,
  modelName,
  chatAgentEnabled,
  chatAgentPrompt,
  input,
  previousResponseId,
  tools,
  requestPolicy,
  reasoning,
  usePreviousResponseIdForFollowUps,
}: {
  providerId: ProviderId;
  modelName: string;
  chatAgentEnabled: boolean;
  chatAgentPrompt: string;
  input?: ResponseTurnInput;
  previousResponseId?: string;
  tools?: ResponseToolDefinition[];
  requestPolicy?: RequestPolicy;
  reasoning?: ResponseReasoningConfig;
  usePreviousResponseIdForFollowUps: boolean;
}) => ({
  model: modelName,
  instructions: buildSystemInstruction(providerId, modelName, chatAgentEnabled, chatAgentPrompt),
  input,
  previous_response_id: usePreviousResponseIdForFollowUps ? previousResponseId : undefined,
  tools,
  parallel_tool_calls: (requestPolicy?.toolParallelism ?? 1) > 1,
  reasoning,
  stream: true as const,
});

export const buildResponseReasoningConfig = ({
  modelName,
  message,
  reasoningEnabled,
  effort,
}: {
  modelName: string;
  message: string;
  reasoningEnabled: boolean;
  effort?: string;
}): {
  emitReasoning: boolean;
  reasoning?: ResponseReasoningConfig;
} => {
  const emitReasoning = reasoningEnabled && shouldEmitReasoning(message);
  if (!supportsResponseReasoningSummary(modelName) || !emitReasoning) {
    return { emitReasoning, reasoning: undefined };
  }

  return {
    emitReasoning,
    reasoning: {
      summary: 'auto',
      ...(effort ? { effort } : {}),
    },
  };
};

export const streamResponsesTurn = async function* (
  client: OpenAI,
  request: {
    model: string;
    instructions: string;
    input?: ResponseTurnInput;
    previous_response_id?: string;
    tools?: ResponseToolDefinition[];
    parallel_tool_calls?: boolean;
    reasoning?: ResponseReasoningConfig;
    stream: true;
  },
  {
    signal,
    emitReasoning = true,
    failureMessage,
  }: {
    signal?: AbortSignal;
    emitReasoning?: boolean;
    failureMessage: string;
  }
): AsyncGenerator<ResponseStreamChunk, void, unknown> {
  const createResponse = client.responses.create.bind(client.responses) as unknown as (
    body: typeof request,
    options?: { signal?: AbortSignal }
  ) => Promise<AsyncIterable<ResponseStreamEvent>>;

  const stream = await createResponse(request, signal ? { signal } : undefined);
  const functionCalls = new Map<string, ResponseFunctionCallItem>();
  const emittedReasoningTexts = new Set<string>();
  let responseId: string | undefined;
  let usage: ResponseUsagePayload | undefined;

  for await (const event of stream) {
    const processedEvent = processResponseStreamEvent({
      event,
      emittedReasoningTexts,
      functionCalls,
      emitReasoning,
    });

    if (processedEvent.responseId) {
      responseId = processedEvent.responseId;
    }
    if (processedEvent.usage) {
      usage = processedEvent.usage;
    }
    for (const text of processedEvent.textDeltas) {
      yield { kind: 'text', value: text };
    }
    if (processedEvent.failed) {
      throw new Error(failureMessage);
    }
  }

  yield {
    kind: 'response',
    id: responseId,
    functionCalls: Array.from(functionCalls.values()),
    usage,
  };
};

export const createResponsesTurnRequest = buildResponsesTurnRequest;
