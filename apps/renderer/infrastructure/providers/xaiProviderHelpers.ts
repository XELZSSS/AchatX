import { ChatMessage, ProviderId, Role } from '@/shared/types/chat';
import {
  buildResponseTavilyTools,
  type ResponseFunctionCallItem,
  type ResponseStreamEvent,
  type ResponseUsagePayload,
  processResponseStreamEvent,
} from '@/infrastructure/providers/responsesShared';
import { buildSystemInstruction } from '@/infrastructure/providers/prompts';

export type XAIResponseInputMessage = {
  type: 'message';
  role: 'system' | 'user' | 'assistant';
  content: Array<{ type: 'input_text'; text: string } | { type: 'output_text'; text: string }>;
};

export type XAIResponseTurnInput =
  | XAIResponseInputMessage
  | { type: 'function_call_output'; call_id: string; output: string };

export type XAIResponseRequest = {
  model: string;
  input?: XAIResponseTurnInput[];
  previous_response_id?: string;
  tools?: ReturnType<typeof buildResponseTavilyTools>;
  parallel_tool_calls?: boolean;
  store: boolean;
  stream: true;
};

type XAIResponseChunk =
  | { kind: 'text'; value: string }
  | {
      kind: 'response';
      id?: string;
      functionCalls: ResponseFunctionCallItem[];
      usage?: ResponseUsagePayload;
    };

const RAW_XAI_BASE_URL = process.env.XAI_BASE_URL ?? 'https://api.x.ai/v1';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const ensureV1BaseUrl = (baseUrl: string): string => {
  const normalized = trimTrailingSlash(baseUrl.trim());
  return /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
};

const XAI_BASE_URL = ensureV1BaseUrl(RAW_XAI_BASE_URL);

const buildXaiEndpoint = (path: string): string =>
  `${XAI_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const createXaiHeaders = (apiKey: string): Headers =>
  new Headers({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  });

const readErrorText = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
};

async function* streamSseJson<T>(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<T, void, unknown> {
  if (!response.body) {
    throw new Error('xAI streaming response did not contain a body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const data = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim();

      if (data) {
        if (data === '[DONE]') {
          return;
        }
        yield JSON.parse(data) as T;
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }
  }

  const finalData = buffer
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (finalData && finalData !== '[DONE]') {
    yield JSON.parse(finalData) as T;
  }
}

export const buildXaiInitialInputMessages = ({
  id,
  modelName,
  chatAgentEnabled,
  chatAgentPrompt,
  messages,
}: {
  id: ProviderId;
  modelName: string;
  chatAgentEnabled: boolean;
  chatAgentPrompt: string;
  messages: ChatMessage[];
}): XAIResponseInputMessage[] => {
  const systemInstruction = buildSystemInstruction(
    id,
    modelName,
    chatAgentEnabled,
    chatAgentPrompt
  );

  const historyMessages: XAIResponseInputMessage[] = messages
    .filter((msg) => !msg.isError)
    .map((msg) => ({
      type: 'message' as const,
      role: msg.role === Role.User ? 'user' : 'assistant',
      content: [
        {
          type: msg.role === Role.User ? ('input_text' as const) : ('output_text' as const),
          text: msg.text,
        },
      ],
    }));

  if (!systemInstruction) {
    return historyMessages;
  }

  return [
    {
      type: 'message',
      role: 'system',
      content: [{ type: 'input_text', text: systemInstruction }],
    },
    ...historyMessages,
  ];
};

export const buildXaiContinuationInput = (message: string): XAIResponseInputMessage[] => {
  return [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: message }],
    },
  ];
};

export async function* streamXaiResponsesTurn(
  apiKey: string,
  request: XAIResponseRequest,
  signal?: AbortSignal,
  emitReasoning = true
): AsyncGenerator<XAIResponseChunk, void, unknown> {
  const response = await fetch(buildXaiEndpoint('/responses'), {
    method: 'POST',
    headers: createXaiHeaders(apiKey),
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorText = await readErrorText(response);
    throw new Error(
      `xAI responses request failed: ${response.status}${errorText ? ` ${errorText}` : ''}`
    );
  }

  const functionCalls = new Map<string, ResponseFunctionCallItem>();
  const emittedReasoningTexts = new Set<string>();
  let responseId: string | undefined;
  let usage: ResponseUsagePayload | undefined;

  for await (const event of streamSseJson<ResponseStreamEvent>(response, signal)) {
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
      throw new Error('xAI responses stream failed');
    }
  }

  yield {
    kind: 'response',
    id: responseId,
    functionCalls: Array.from(functionCalls.values()),
    usage,
  };
}
