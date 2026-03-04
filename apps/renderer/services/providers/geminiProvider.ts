import {
  GoogleGenAI,
  type Chat,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
  type ThinkingConfig,
  type ThinkingLevel,
  type Type,
  type ToolListUnion,
} from '@google/genai';
import { ChatMessage, ProviderId, Role, TavilyConfig } from '../../types';
import { ProviderChat, ProviderDefinition } from './types';
import { buildSystemInstruction } from './prompts';
import { GEMINI_MODEL_CATALOG } from './models';
import { sanitizeApiKey } from './utils';
import { callTavilySearch, getDefaultTavilyConfig, normalizeTavilyConfig } from './tavily';
import { TavilyToolArgs } from './openaiChatHelpers';

export const GEMINI_PROVIDER_ID: ProviderId = 'gemini';
export const GEMINI_MODEL_NAME = 'gemini-3.1-pro-preview';
const GEMINI_THINKING_CONFIG: ThinkingConfig = {
  includeThoughts: true,
  thinkingLevel: 'HIGH' as ThinkingLevel,
};
const GEMINI_SCHEMA_TYPE = {
  OBJECT: 'OBJECT' as Type,
  STRING: 'STRING' as Type,
  INTEGER: 'INTEGER' as Type,
  BOOLEAN: 'BOOLEAN' as Type,
} as const;

type GeminiChunkPayload = {
  content: string;
  reasoning: string;
};

const extractGeminiChunkPayload = (response: GenerateContentResponse): GeminiChunkPayload => {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let content = '';
  let reasoning = '';

  for (const part of parts) {
    const text = part.text ?? '';
    if (!text) continue;
    if (part.thought) {
      reasoning += text;
      continue;
    }
    content += text;
  }

  if (!content && response.text) {
    content = response.text;
  }

  return { content, reasoning };
};

const DEFAULT_GEMINI_API_KEY = sanitizeApiKey(process.env.GEMINI_API_KEY ?? process.env.API_KEY);
class GeminiProvider implements ProviderChat {
  private readonly id: ProviderId = GEMINI_PROVIDER_ID;

  private chat: Chat | null = null;
  private modelName: string;
  private apiKey?: string;
  private client: GoogleGenAI | null = null;
  private tavilyConfig?: TavilyConfig;
  private history: ChatMessage[] = [];

  constructor() {
    this.modelName = GEMINI_MODEL_NAME;
    this.apiKey = DEFAULT_GEMINI_API_KEY;
    this.tavilyConfig = getDefaultTavilyConfig();
  }

  private async getClient(): Promise<GoogleGenAI> {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  private async createChat(history: Content[] = []): Promise<Chat> {
    const client = await this.getClient();
    return client.chats.create({
      model: this.modelName,
      history,
      config: {
        systemInstruction: buildSystemInstruction(this.id, this.modelName),
        thinkingConfig: GEMINI_THINKING_CONFIG,
      },
    });
  }

  private buildContents(history: ChatMessage[]): Content[] {
    return history
      .filter((msg) => !msg.isError)
      .map((msg) => ({
        role: msg.role === Role.User ? 'user' : 'model',
        parts: [{ text: msg.text }] as Part[],
      }));
  }

  private buildTools(): ToolListUnion | undefined {
    if (!this.tavilyConfig?.apiKey) return undefined;

    const tavilySearchDeclaration: FunctionDeclaration = {
      name: 'tavily_search',
      description:
        'Search the web for up-to-date information and return a concise summary with sources.',
      parameters: {
        type: GEMINI_SCHEMA_TYPE.OBJECT,
        properties: {
          query: { type: GEMINI_SCHEMA_TYPE.STRING, description: 'Search query' },
          search_depth: {
            type: GEMINI_SCHEMA_TYPE.STRING,
            enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
            description: 'Search depth',
          },
          max_results: {
            type: GEMINI_SCHEMA_TYPE.INTEGER,
            minimum: 1,
            maximum: 20,
            description: 'Number of results to return',
          },
          topic: {
            type: GEMINI_SCHEMA_TYPE.STRING,
            enum: ['general', 'news', 'finance'],
            description: 'Search topic',
          },
          include_answer: {
            type: GEMINI_SCHEMA_TYPE.BOOLEAN,
            description: 'Include answer summary',
          },
        },
        required: ['query'],
      },
    };

    return [
      {
        functionDeclarations: [tavilySearchDeclaration],
      },
    ];
  }

  private async ensureChat(): Promise<Chat> {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    if (!this.chat) {
      this.chat = await this.createChat();
    }
    return this.chat;
  }

  getId(): ProviderId {
    return this.id;
  }

  getModelName(): string {
    return this.modelName;
  }

  setModelName(model: string): void {
    const nextModel = model.trim() || geminiProviderDefinition.defaultModel;
    if (nextModel !== this.modelName) {
      this.modelName = nextModel;
      this.resetChat();
    }
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  setApiKey(apiKey?: string): void {
    const nextKey = sanitizeApiKey(apiKey) ?? DEFAULT_GEMINI_API_KEY;
    if (nextKey !== this.apiKey) {
      this.apiKey = nextKey;
      this.client = null;
      this.resetChat();
    }
  }

  getTavilyConfig(): TavilyConfig | undefined {
    return this.tavilyConfig;
  }

  setTavilyConfig(config?: TavilyConfig): void {
    this.tavilyConfig = normalizeTavilyConfig(config);
  }

  resetChat(): void {
    this.chat = null;
    this.history = [];
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Missing Gemini API key');
    }
    this.history = messages.filter((msg) => !msg.isError);
    const history = this.buildContents(this.history);
    this.chat = await this.createChat(history);
  }

  async *sendMessageStream(
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    try {
      if (signal?.aborted) return;
      let fullResponse = '';
      let fullReasoning = '';
      const userMessage: ChatMessage = {
        id: `gemini-user-${Date.now()}`,
        role: Role.User,
        text: message,
        timestamp: Date.now(),
      };
      if (!this.tavilyConfig?.apiKey) {
        const chat = await this.ensureChat();
        const result = await chat.sendMessageStream({ message });

        for await (const chunk of result) {
          if (signal?.aborted) return;
          const c = chunk as GenerateContentResponse;
          const payload = extractGeminiChunkPayload(c);
          if (payload.reasoning) {
            fullReasoning += payload.reasoning;
            yield `<think>${payload.reasoning}</think>`;
          }
          if (payload.content) {
            fullResponse += payload.content;
            yield payload.content;
          }
        }
        if (fullResponse) {
          const modelMessage: ChatMessage = {
            id: `gemini-model-${Date.now()}`,
            role: Role.Model,
            text: fullResponse,
            reasoning: fullReasoning || undefined,
            timestamp: Date.now(),
          };
          this.history = [...this.history, userMessage, modelMessage];
        }
        return;
      }

      const contents = this.buildContents([...this.history, userMessage]);
      const tools = this.buildTools();
      const client = await this.getClient();
      const response = await client.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: buildSystemInstruction(this.id, this.modelName),
          tools,
          thinkingConfig: GEMINI_THINKING_CONFIG,
        },
      });

      const functionCalls = response.functionCalls ?? [];
      if (!functionCalls.length) {
        if (signal?.aborted) return;
        const payload = extractGeminiChunkPayload(response);
        if (payload.reasoning) {
          fullReasoning += payload.reasoning;
          yield `<think>${payload.reasoning}</think>`;
        }
        if (payload.content) {
          fullResponse = payload.content;
          yield payload.content;
          const modelMessage: ChatMessage = {
            id: `gemini-model-${Date.now()}`,
            role: Role.Model,
            text: payload.content,
            reasoning: fullReasoning || undefined,
            timestamp: Date.now(),
          };
          this.history = [...this.history, userMessage, modelMessage];
          return;
        }
        const chat = await this.ensureChat();
        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
          if (signal?.aborted) return;
          const c = chunk as GenerateContentResponse;
          const payload = extractGeminiChunkPayload(c);
          if (payload.reasoning) {
            fullReasoning += payload.reasoning;
            yield `<think>${payload.reasoning}</think>`;
          }
          if (payload.content) {
            fullResponse += payload.content;
            yield payload.content;
          }
        }
        if (fullResponse) {
          const modelMessage: ChatMessage = {
            id: `gemini-model-${Date.now()}`,
            role: Role.Model,
            text: fullResponse,
            reasoning: fullReasoning || undefined,
            timestamp: Date.now(),
          };
          this.history = [...this.history, userMessage, modelMessage];
        }
        return;
      }

      const toolParts: Part[] = [];
      for (const call of functionCalls) {
        if (call.name !== 'tavily_search') {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: { error: `Unsupported tool: ${call.name}` },
            },
          });
          continue;
        }
        const args = (call.args ?? {}) as TavilyToolArgs;
        if (!args.query) {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: { error: 'Missing query for tavily_search' },
            },
          });
          continue;
        }
        try {
          const result = await callTavilySearch(this.tavilyConfig, {
            query: args.query,
            search_depth: args.search_depth,
            max_results: args.max_results,
            topic: args.topic,
            include_answer: args.include_answer,
          });
          toolParts.push({
            functionResponse: { name: call.name, response: result as Record<string, unknown> },
          });
        } catch (error) {
          toolParts.push({
            functionResponse: {
              name: call.name,
              response: {
                error: error instanceof Error ? error.message : 'Tavily search failed',
              },
            },
          });
        }
      }

      const followupContents: Content[] = [
        ...contents,
        ...(response.candidates?.[0]?.content ? [response.candidates[0].content] : []),
        { role: 'user', parts: toolParts },
      ];

      const stream = await client.models.generateContentStream({
        model: this.modelName,
        contents: followupContents,
        config: {
          systemInstruction: buildSystemInstruction(this.id, this.modelName),
          tools,
          thinkingConfig: GEMINI_THINKING_CONFIG,
        },
      });

      for await (const chunk of stream) {
        if (signal?.aborted) return;
        const c = chunk as GenerateContentResponse;
        const payload = extractGeminiChunkPayload(c);
        if (payload.reasoning) {
          fullReasoning += payload.reasoning;
          yield `<think>${payload.reasoning}</think>`;
        }
        if (payload.content) {
          fullResponse += payload.content;
          yield payload.content;
        }
      }
      if (fullResponse) {
        const modelMessage: ChatMessage = {
          id: `gemini-model-${Date.now()}`,
          role: Role.Model,
          text: fullResponse,
          reasoning: fullReasoning || undefined,
          timestamp: Date.now(),
        };
        this.history = [...this.history, userMessage, modelMessage];
      }
    } catch (error) {
      console.error('Error in Gemini stream:', error);
      throw error;
    }
  }
}

export const geminiProviderDefinition: ProviderDefinition = {
  id: GEMINI_PROVIDER_ID,
  models: Array.from(new Set([GEMINI_MODEL_NAME, ...GEMINI_MODEL_CATALOG])),
  defaultModel: GEMINI_MODEL_NAME,
  create: () => new GeminiProvider(),
};
