export type {
  ProcessResponseStreamEventOptions,
  ProcessedResponseStreamEvent,
  ResponseFunctionCallItem,
  ResponseFunctionTool,
  ResponseInputMessage,
  ResponseNamespaceTool,
  ResponseStreamEvent,
  ResponseTavilyToolOptions,
  ResponseToolCallArgs,
  ResponseToolDefinition,
  ResponseToolExecutionMessages,
  ResponseToolSearchTool,
  ResponseUsagePayload,
} from '@/infrastructure/providers/responsesSharedTypes';

export {
  processResponseStreamEvent,
  supportsHostedToolSearch,
  supportsResponseReasoningSummary,
} from '@/infrastructure/providers/responsesSharedStream';

export {
  buildResponseTavilyTools,
  createResponseTools,
  parseResponseToolCallArgs,
  runResponseTavilyToolCall,
} from '@/infrastructure/providers/responsesSharedTools';

import type { ResponseInputMessage } from '@/infrastructure/providers/responsesSharedTypes';

export const toResponseInputMessages = (
  messages: Array<{ role: 'user' | 'model'; text: string; isError?: boolean }>
): ResponseInputMessage[] => {
  return messages
    .filter((msg) => !msg.isError)
    .map((msg) => ({
      type: 'message' as const,
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: [
        {
          type: msg.role === 'user' ? ('input_text' as const) : ('output_text' as const),
          text: msg.text,
        },
      ],
    }));
};
