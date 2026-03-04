import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { ProviderChat, ProviderDefinition } from './types';
import { getDefaultGlmBaseUrl, resolveBaseUrl } from './baseUrl';
import { GLM_MODEL_CATALOG } from './models';
import { getMaxToolCallRounds, sanitizeApiKey } from './utils';
import { getProxyAuthHeadersForTarget } from './proxy';
import { buildOpenAITavilyTools, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { buildProviderModelConfig } from './modelConfig';
import { OpenAIChatMessages, OpenAIStreamChunk } from './openaiChatHelpers';
import { OpenAIStyleProviderBase } from './openaiBase';

export const GLM_PROVIDER_ID: ProviderId = 'glm';

const FALLBACK_GLM_MODEL = 'glm-5';
const { defaultModel: DEFAULT_GLM_MODEL, models: GLM_MODELS } = buildProviderModelConfig({
  envModel: process.env.GLM_MODEL,
  fallbackModel: FALLBACK_GLM_MODEL,
  catalog: GLM_MODEL_CATALOG,
});

const DEFAULT_GLM_API_KEY = sanitizeApiKey(process.env.GLM_API_KEY);

const parseSseLines = (buffer: string): { lines: string[]; rest: string } => {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? '';
  return { lines: parts, rest };
};

const shouldEnableGlmThinking = (modelName: string): boolean => {
  const model = modelName.trim().toLowerCase();
  return model.startsWith('glm-5') || model.startsWith('glm-4.7') || model.startsWith('glm-4.6');
};

const buildGlmThinkingConfig = (modelName: string): { thinking: { type: 'enabled' } } | {} => {
  if (!shouldEnableGlmThinking(modelName)) return {};
  return { thinking: { type: 'enabled' } };
};

class GlmProvider extends OpenAIStyleProviderBase implements ProviderChat {
  private readonly id: ProviderId = GLM_PROVIDER_ID;
  private apiKey?: string;
  private modelName: string;
  private baseUrl: string;
  private tavilyConfig?: TavilyConfig;

  constructor() {
    super();
    this.apiKey = DEFAULT_GLM_API_KEY;
    this.modelName = glmProviderDefinition.defaultModel;
    this.baseUrl = getDefaultGlmBaseUrl();
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private getApiKeyValue(): string {
    const keyToUse = this.apiKey ?? DEFAULT_GLM_API_KEY;
    if (!keyToUse) {
      throw new Error('Missing GLM_API_KEY');
    }
    return keyToUse;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || glmProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_GLM_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
    }
  }

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  getBaseUrl(): string | undefined {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl?: string): void {
    const nextUrl = baseUrl?.trim();
    if (nextUrl && nextUrl !== this.baseUrl) {
      this.baseUrl = resolveBaseUrl(nextUrl);
    }
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const userMessage: ChatMessage = {
      id: `glm-user-${Date.now()}`,
      role: Role.User,
      text: message,
      timestamp: Date.now(),
    };

    const nextHistory = [...this.history, userMessage];
    const baseMessages = this.buildMessages(nextHistory, this.id, this.modelName);

    const tools = buildOpenAITavilyTools(this.tavilyConfig);
    const toolChoice = tools ? 'auto' : undefined;
    let messagesToSend = baseMessages as OpenAIChatMessages;

    if (tools) {
      let workingMessages = messagesToSend;
      const maxToolRounds = getMaxToolCallRounds();
      for (let round = 0; round < maxToolRounds; round += 1) {
        const preflight = await fetch(this.baseUrl, {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getApiKeyValue()}`,
            ...getProxyAuthHeadersForTarget(this.baseUrl),
          },
          body: JSON.stringify({
            model: this.modelName,
            messages: workingMessages,
            tools,
            tool_choice: toolChoice,
            stream: false,
            ...buildGlmThinkingConfig(this.modelName),
          }),
        });

        if (!preflight.ok) {
          throw new Error(`GLM tool preflight failed: ${preflight.status}`);
        }

        const preflightData = (await preflight.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
            };
          }>;
        };

        const toolCalls = preflightData.choices?.[0]?.message?.tool_calls ?? [];
        if (!toolCalls.length) {
          messagesToSend = workingMessages;
          break;
        }

        const toolMessages = await this.buildToolMessages(toolCalls, this.tavilyConfig);

        workingMessages = [
          ...workingMessages,
          {
            role: 'assistant',
            content: preflightData.choices?.[0]?.message?.content ?? null,
            tool_calls: toolCalls,
          },
          ...toolMessages,
        ];
        messagesToSend = workingMessages;
      }
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKeyValue()}`,
        ...getProxyAuthHeadersForTarget(this.baseUrl),
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: messagesToSend,
        tools,
        tool_choice: toolChoice,
        stream: true,
        ...buildGlmThinkingConfig(this.modelName),
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`GLM stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        if (signal?.aborted) break;
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { lines, rest } = parseSseLines(buffer);
        buffer = rest;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payloadText = trimmed.replace(/^data:\s*/i, '');
          if (payloadText === '[DONE]') {
            buffer = '';
            break;
          }

          let chunk: OpenAIStreamChunk | null = null;
          try {
            chunk = JSON.parse(payloadText) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          const reasoningDelta =
            chunk?.choices?.[0]?.delta?.reasoning_content ??
            chunk?.choices?.[0]?.message?.reasoning_content;
          if (reasoningDelta) {
            yield `<think>${reasoningDelta}</think>`;
          }

          const contentDelta =
            chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
          if (contentDelta) {
            fullResponse += contentDelta;
            yield contentDelta;
          }
        }
      }

      const modelMessage: ChatMessage = {
        id: `glm-model-${Date.now()}`,
        role: Role.Model,
        text: fullResponse,
        timestamp: Date.now(),
      };

      this.history = [...nextHistory, modelMessage];
    } catch (error) {
      console.error('Error in GLM stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}

export const glmProviderDefinition: ProviderDefinition = {
  id: GLM_PROVIDER_ID,
  models: GLM_MODELS,
  defaultModel: DEFAULT_GLM_MODEL,
  create: () => new GlmProvider(),
};
