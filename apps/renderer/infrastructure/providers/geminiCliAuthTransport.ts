import type { ProviderId } from '@/shared/types/chat';
import * as proxyConfig from '../../../shared/proxy-config';
import { buildProxyUrl } from '@/infrastructure/providers/proxy';

export type GeminiCliAuthSession = {
  authenticated: boolean;
  accessToken: string;
  projectId?: string;
};

const CODE_ASSIST_BASE_URL = buildProxyUrl(proxyConfig.PROXY_ROUTES.geminiCli);
const CODE_ASSIST_HEADERS = {
  'X-Goog-Api-Client': 'gl-node/22.17.0',
  'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
} as const;

export const createUserAgent = (model = 'gemini-code-assist') =>
  `GeminiCLI/0.0.0/${model} (${globalThis.navigator?.platform || 'unknown'})`;

const injectResponseIdFromTrace = (body: Record<string, unknown>) => {
  const traceId =
    typeof body.traceId === 'string' && body.traceId.trim() ? body.traceId.trim() : undefined;
  if (!traceId) return body;

  const response = body.response;
  if (!response || typeof response !== 'object') return body;

  const responseId = (response as { responseId?: unknown }).responseId;
  if (typeof responseId === 'string' && responseId.trim()) {
    return body;
  }

  return {
    ...body,
    response: {
      ...(response as Record<string, unknown>),
      responseId: traceId,
    },
  };
};

const transformSseLine = (line: string): string => {
  if (!line.startsWith('data:')) {
    return line;
  }

  const payload = line.slice(5).trim();
  if (!payload) {
    return line;
  }

  try {
    const parsed = injectResponseIdFromTrace(JSON.parse(payload) as Record<string, unknown>);
    if (parsed.response !== undefined) {
      return `data: ${JSON.stringify(parsed.response)}`;
    }
  } catch {
    return line;
  }

  return line;
};

const transformSseStream = (stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      reader = stream.getReader();
      const pump = (): void => {
        reader!
          .read()
          .then(({ done, value }) => {
            if (done) {
              buffer += decoder.decode();
              if (buffer) {
                controller.enqueue(encoder.encode(transformSseLine(buffer)));
              }
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            let newlineIndex = buffer.indexOf('\n');
            while (newlineIndex !== -1) {
              const line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              const hasCr = line.endsWith('\r');
              const rawLine = hasCr ? line.slice(0, -1) : line;
              const transformed = transformSseLine(rawLine);
              controller.enqueue(encoder.encode(`${transformed}${hasCr ? '\r\n' : '\n'}`));
              newlineIndex = buffer.indexOf('\n');
            }

            pump();
          })
          .catch((error) => {
            controller.error(error);
          });
      };

      pump();
    },
    cancel(reason) {
      if (reader) {
        void reader.cancel(reason).catch(() => {});
      }
    },
  });
};

export const transformGeminiCliResponse = async (
  response: Response,
  streaming: boolean
): Promise<Response> => {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const isSse = contentType.includes('text/event-stream');

  if (streaming && response.ok && isSse && response.body) {
    return new Response(transformSseStream(response.body), {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  }

  if (!isJson) {
    return response;
  }

  const text = await response.text();
  try {
    const parsed = injectResponseIdFromTrace(JSON.parse(text) as Record<string, unknown>);
    const unwrapped = parsed.response ?? parsed;
    return new Response(JSON.stringify(unwrapped), {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  } catch {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  }
};

export const buildGeminiCliRequest = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  session: GeminiCliAuthSession,
  defaultModel: string
) => {
  const originalUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init?.headers ?? {});
  headers.delete('x-goog-api-key');
  headers.delete('x-api-key');

  const match = originalUrl.match(/\/models\/([^:]+):(\w+)/);
  if (!match) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
    return {
      request: originalUrl,
      init: { ...init, headers },
      streaming: false,
    };
  }

  const [, rawModel = defaultModel, rawAction = 'generateContent'] = match;
  const streaming = rawAction === 'streamGenerateContent';
  const transformedUrl = `${CODE_ASSIST_BASE_URL}/v1internal:${rawAction}${streaming ? '?alt=sse' : ''}`;
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  let body = init?.body;

  if (typeof body === 'string') {
    try {
      const requestPayload = JSON.parse(body) as Record<string, unknown>;
      delete requestPayload.model;
      body = JSON.stringify({
        project: session.projectId,
        model: rawModel,
        user_prompt_id: requestId,
        request: requestPayload,
      });
    } catch {
      body = init?.body;
    }
  }

  headers.set('Authorization', `Bearer ${session.accessToken}`);
  headers.set('User-Agent', createUserAgent(rawModel));
  headers.set('X-Goog-Api-Client', CODE_ASSIST_HEADERS['X-Goog-Api-Client']);
  headers.set('Client-Metadata', CODE_ASSIST_HEADERS['Client-Metadata']);
  headers.set('x-activity-request-id', requestId);
  if (streaming) {
    headers.set('Accept', 'text/event-stream');
  }

  return {
    request: transformedUrl,
    init: {
      ...init,
      headers,
      body,
    },
    streaming,
  };
};
