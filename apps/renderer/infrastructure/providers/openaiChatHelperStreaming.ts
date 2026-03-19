import OpenAI from 'openai';
import type {
  OpenAIChatCreateNonStreaming,
  OpenAIChatCreateStreaming,
  OpenAIStreamChunk,
  StreamChunkOutput,
  StreamOptions,
} from '@/infrastructure/providers/openaiChatHelperTypes';

export const shouldEmitReasoning = (message: string): boolean => {
  return message.trim().length > 0;
};

const supportsReasoningEffort = (model: string): boolean => {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.startsWith('gpt-5') ||
    normalized.startsWith('o') ||
    normalized.includes('reasoning') ||
    normalized.includes('reasoner')
  );
};

export const buildReasoningEffortExtraBody = (
  model: string,
  enabled: boolean
): Record<string, unknown> | undefined => {
  if (!enabled || !supportsReasoningEffort(model)) {
    return undefined;
  }

  return {
    reasoning_effort: 'medium',
  };
};

export const createChatCompletion = async (
  client: OpenAI,
  params: OpenAIChatCreateNonStreaming | OpenAIChatCreateStreaming,
  signal?: AbortSignal
) => {
  const create = client.chat.completions.create.bind(client.chat.completions) as unknown as (
    request: OpenAIChatCreateNonStreaming | OpenAIChatCreateStreaming,
    options?: { signal?: AbortSignal }
  ) => Promise<unknown>;

  if (signal) {
    return create(params, { signal });
  }
  return create(params as OpenAIChatCreateNonStreaming);
};

const extractReasoning = (chunk: OpenAIStreamChunk): string | undefined => {
  return (
    chunk.choices?.[0]?.delta?.reasoning_content ??
    chunk.choices?.[0]?.delta?.reasoning_text ??
    chunk.choices?.[0]?.delta?.reasoning ??
    chunk.choices?.[0]?.message?.reasoning_content ??
    chunk.choices?.[0]?.message?.reasoning_text ??
    chunk.choices?.[0]?.message?.reasoning
  );
};

const extractContent = (chunk: OpenAIStreamChunk): string | undefined => {
  return chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
};

export async function* streamStandardChatCompletions({
  client,
  model,
  messages,
  extraBody,
  signal,
}: StreamOptions): AsyncGenerator<StreamChunkOutput, void, unknown> {
  const stream = (await createChatCompletion(
    client,
    {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
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

    const reasoningDelta = extractReasoning(chunk);
    if (reasoningDelta) {
      yield { reasoning: reasoningDelta };
    }

    const contentDelta = extractContent(chunk);
    if (contentDelta) {
      yield { content: contentDelta };
    }
  }
}
