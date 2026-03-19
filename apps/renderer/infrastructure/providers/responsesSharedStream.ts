import type {
  ProcessResponseStreamEventOptions,
  ProcessedResponseStreamEvent,
  ResponseStreamEvent,
} from '@/infrastructure/providers/responsesSharedTypes';

export const supportsHostedToolSearch = (modelName: string): boolean => {
  const normalized = modelName.trim().toLowerCase();
  return normalized === 'gpt-5.4' || normalized.startsWith('gpt-5.4-');
};

export const supportsResponseReasoningSummary = (
  modelName: string,
  matcher: (normalizedModelName: string) => boolean = (normalizedModelName) =>
    normalizedModelName.startsWith('gpt-5') || normalizedModelName.startsWith('o')
): boolean => {
  return matcher(modelName.trim().toLowerCase());
};

export const extractCompletedReasoningTexts = (event: ResponseStreamEvent): string[] => {
  const outputs = event.response?.output;
  if (!Array.isArray(outputs)) return [];

  return outputs.flatMap((output) => {
    if (output.type !== 'reasoning') return [];

    const summaryTexts =
      output.summary
        ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean) ?? [];
    if (summaryTexts.length > 0) {
      return summaryTexts;
    }

    return (
      output.content
        ?.filter((part) => part?.type === 'reasoning_text')
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean) ?? []
    );
  });
};

export const processResponseStreamEvent = ({
  event,
  emittedReasoningTexts,
  functionCalls,
  emitReasoning = true,
  wrapReasoning = (text: string) => `<think>${text}</think>`,
}: ProcessResponseStreamEventOptions): ProcessedResponseStreamEvent => {
  const textDeltas: string[] = [];

  if (event.type === 'response.output_text.delta' && event.delta) {
    textDeltas.push(event.delta);
  } else if (
    emitReasoning &&
    event.type === 'response.reasoning_summary_text.delta' &&
    event.delta
  ) {
    textDeltas.push(wrapReasoning(event.delta));
  } else if (emitReasoning && event.type === 'response.reasoning_text.delta' && event.delta) {
    textDeltas.push(wrapReasoning(event.delta));
  } else if (emitReasoning && event.type === 'response.reasoning_summary_text.done' && event.text) {
    emittedReasoningTexts.add(event.text);
    textDeltas.push(wrapReasoning(event.text));
  } else if (emitReasoning && event.type === 'response.reasoning_text.done' && event.text) {
    emittedReasoningTexts.add(event.text);
    textDeltas.push(wrapReasoning(event.text));
  } else if (
    emitReasoning &&
    event.type === 'response.reasoning_summary_part.added' &&
    event.part?.text
  ) {
    textDeltas.push(wrapReasoning(event.part.text));
  } else if (
    emitReasoning &&
    event.type === 'response.reasoning_summary_part.done' &&
    event.part?.text
  ) {
    emittedReasoningTexts.add(event.part.text);
    textDeltas.push(wrapReasoning(event.part.text));
  } else if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
    const callId = event.item.call_id;
    const name = event.item.name;
    const args = event.item.arguments;
    if (callId && name) {
      functionCalls.set(callId, {
        type: 'function_call',
        call_id: callId,
        name,
        arguments: args ?? '{}',
        namespace: event.item.namespace,
      });
    }
  } else if (emitReasoning && event.type === 'response.completed') {
    for (const text of extractCompletedReasoningTexts(event)) {
      if (emittedReasoningTexts.has(text)) continue;
      emittedReasoningTexts.add(text);
      textDeltas.push(wrapReasoning(text));
    }
  }

  return {
    responseId: event.response?.id,
    usage: event.response?.usage,
    textDeltas,
    failed: event.type === 'response.failed',
  };
};
