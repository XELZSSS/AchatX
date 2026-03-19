import { ChatMessage, ProviderId, Role, TavilyConfig } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import type { RequestPolicy } from '@/infrastructure/providers/requestPolicy';
import { CHAT_AGENT_PROMPT, buildSystemInstruction } from '@/infrastructure/providers/prompts';
import {
  decideAdaptiveToolParallelism,
  runWithConcurrency,
} from '@/infrastructure/providers/requestPolicy';
import { callTavilySearch, hasSearchConfig } from '@/infrastructure/providers/tavily';
import { TavilyToolArgs } from '@/infrastructure/providers/openaiChatHelpers';

type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type ToolMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

const createToolMessage = (toolCallId: string, content: string): ToolMessage => ({
  role: 'tool',
  tool_call_id: toolCallId,
  content,
});

const createToolErrorContent = (message: string): string => JSON.stringify({ error: message });

const resolveToolConcurrency = (
  parsedCalls: Array<{ args: TavilyToolArgs }>,
  requestPolicy?: RequestPolicy
): number =>
  Math.max(
    1,
    Math.min(
      requestPolicy?.toolParallelism ?? Number.MAX_SAFE_INTEGER,
      decideAdaptiveToolParallelism(parsedCalls.map(({ args }) => args))
    )
  );

export abstract class OpenAIStyleProviderBase {
  protected history: ChatMessage[] = [];
  protected chatAgentEnabled = true;
  protected chatAgentPrompt = CHAT_AGENT_PROMPT;
  protected chatAgentSearchEnabled = true;

  protected buildMessages(
    nextHistory: ChatMessage[],
    providerId: ProviderId,
    modelName: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const systemInstruction = buildSystemInstruction(
      providerId,
      modelName,
      this.chatAgentEnabled,
      this.chatAgentPrompt
    );
    const systemMessages = systemInstruction
      ? [{ role: 'system' as const, content: systemInstruction }]
      : [];
    return [
      ...systemMessages,
      ...nextHistory
        .filter((msg) => !msg.isError)
        .map((msg) => ({
          role: msg.role === Role.User ? ('user' as const) : ('assistant' as const),
          content: msg.text,
        })),
    ];
  }

  resetChat(): void {
    this.history = [];
  }

  getChatAgentEnabled(): boolean {
    return this.chatAgentEnabled;
  }

  setChatAgentEnabled(enabled: boolean): void {
    this.chatAgentEnabled = enabled;
  }

  getChatAgentPrompt(): string {
    return this.chatAgentPrompt;
  }

  setChatAgentPrompt(prompt: string): void {
    this.chatAgentPrompt = prompt;
  }

  getChatAgentSearchEnabled(): boolean {
    return this.chatAgentSearchEnabled;
  }

  setChatAgentSearchEnabled(enabled: boolean): void {
    this.chatAgentSearchEnabled = enabled;
  }

  async startChatWithHistory(messages: ChatMessage[]): Promise<void> {
    this.history = messages.filter((msg) => !msg.isError);
  }

  protected async buildToolMessages(
    toolCalls: ToolCall[],
    tavilyConfig?: TavilyConfig,
    requestPolicy?: RequestPolicy
  ): Promise<ToolMessage[]> {
    if (!hasSearchConfig(tavilyConfig)) {
      return [];
    }

    const parsedCalls = toolCalls.map((call) => {
      let args: TavilyToolArgs;
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      return { call, args };
    });

    const toolResults = await runWithConcurrency(
      parsedCalls,
      resolveToolConcurrency(parsedCalls, requestPolicy),
      async ({ call, args }) => {
        if (call.function?.name !== 'tavily_search') {
          return createToolMessage(
            call.id,
            createToolErrorContent(
              `${t('settings.provider.error.tool.unsupported')}: ${call.function?.name ?? 'unknown'}`
            )
          );
        }
        if (!args.query) {
          return createToolMessage(
            call.id,
            createToolErrorContent(t('settings.provider.error.tool.missingQuery'))
          );
        }
        try {
          const result = await callTavilySearch(tavilyConfig, {
            query: args.query,
            search_depth: args.search_depth,
            max_results: args.max_results,
            topic: args.topic,
            include_answer: args.include_answer,
          });
          return createToolMessage(call.id, JSON.stringify(result));
        } catch (error) {
          return createToolMessage(
            call.id,
            createToolErrorContent(
              error instanceof Error ? error.message : t('settings.search.error.requestFailed')
            )
          );
        }
      }
    );

    return toolResults;
  }
}
