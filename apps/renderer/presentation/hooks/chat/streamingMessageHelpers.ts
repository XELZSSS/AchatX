import { createThinkStreamParserState } from '@/shared/utils/streaming';
import { t } from '@/shared/utils/i18n';
import type { ChatMessage } from '@/shared/types/chat';

export type MessageOverrides = Omit<Partial<ChatMessage>, 'role' | 'text'>;

export type CachedMessageIndex = {
  id: string;
  index: number;
};

export type StreamAccumulator = {
  cleaned: string;
  reasoning: string;
  isFirstChunk: boolean;
  pendingBuffer: string;
  parserState: ReturnType<typeof createThinkStreamParserState>;
};

export const createStreamAccumulator = (): StreamAccumulator => ({
  cleaned: '',
  reasoning: '',
  isFirstChunk: true,
  pendingBuffer: '',
  parserState: createThinkStreamParserState(),
});

export const resetStreamAccumulator = (accumulator: StreamAccumulator | null) => {
  if (!accumulator) {
    return;
  }
  accumulator.pendingBuffer = '';
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const areValuesShallowEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => areValuesShallowEqual(item, right[index]))
    );
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          areValuesShallowEqual(left[key], right[key])
      )
    );
  }

  return false;
};

const formatUnknownValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
};

export const isAbortLikeError = (error: unknown, stopRequested: boolean): boolean => {
  const errorName = error instanceof DOMException ? error.name : '';
  const errorMessage = formatUnknownValue(error);
  return stopRequested || errorName === 'AbortError' || /aborted|abort/i.test(errorMessage);
};

export const getErrorMessage = (error: unknown): string => {
  return formatUnknownValue(error);
};

export const hasPersistableMessageContent = (message: ChatMessage | undefined): boolean => {
  if (!message) {
    return false;
  }

  return (
    message.text.trim().length > 0 ||
    Boolean(message.reasoning?.trim()) ||
    Boolean(message.toolCalls?.length) ||
    Boolean(message.toolResults?.length) ||
    Boolean(message.citations?.length)
  );
};

export const delayWithAbort = (ms: number, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    const handleAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', handleAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
};

export const buildFriendlyErrorMessage = (rawMessage: string): string => {
  const rawLower = rawMessage.toLowerCase();
  let friendlyError = t('error.generic');

  if (rawLower.includes('api key') || rawLower.includes('403')) {
    friendlyError = t('error.auth');
  } else if (rawLower.includes('quota') || rawLower.includes('429')) {
    friendlyError = t('error.quota');
  } else if (rawLower.includes('safety') || rawLower.includes('blocked')) {
    friendlyError = t('error.safety');
  } else if (
    rawLower.includes('fetch') ||
    rawLower.includes('network') ||
    rawLower.includes('failed to fetch')
  ) {
    friendlyError = t('error.network');
  } else if (rawLower.includes('503') || rawLower.includes('overloaded')) {
    friendlyError = t('error.overloaded');
  }

  return `${friendlyError}

${t('error.troubleshooting')}
1. ${t('error.step1')}
2. ${t('error.step2')}
3. ${t('error.step3')}

${t('error.technicalDetails')}
${rawMessage}`;
};
