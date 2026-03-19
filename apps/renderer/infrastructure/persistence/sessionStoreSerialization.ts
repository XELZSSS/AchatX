import type { ChatSession } from '@/shared/types/chat';
import { formatMessageTime } from '@/shared/utils/time';
import { PROVIDER_IDS as RAW_PROVIDER_IDS } from '../../../shared/provider-ids';
import { getProviderDefinition } from '@/infrastructure/providers/registry';

const DEFAULT_PROVIDER_ID = (RAW_PROVIDER_IDS[0] ?? 'gemini') as (typeof RAW_PROVIDER_IDS)[number];
const DEFAULT_MODEL_NAME = getProviderDefinition(DEFAULT_PROVIDER_ID).defaultModel;
const VALID_PROVIDER_IDS = new Set(RAW_PROVIDER_IDS as unknown as string[]);

const warnIfDefaultModelMismatch = (): void => {
  if (typeof __APP_ENV__ !== 'undefined' && __APP_ENV__ === 'production') return;
  const normalizedModel = DEFAULT_MODEL_NAME.toLowerCase();
  const isGeminiModel = normalizedModel.startsWith('gemini');
  if (DEFAULT_PROVIDER_ID === 'gemini' && !isGeminiModel) {
    console.warn('[session-store] DEFAULT_MODEL_NAME does not match gemini provider.');
    return;
  }
  if (DEFAULT_PROVIDER_ID !== 'gemini' && isGeminiModel) {
    console.warn('[session-store] DEFAULT_MODEL_NAME looks gemini but default provider is not.');
  }
};

warnIfDefaultModelMismatch();

export type StoredSession = Partial<ChatSession> &
  Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>;
export type StoredSessionIndexEntry = Pick<
  ChatSession,
  'id' | 'title' | 'provider' | 'model' | 'createdAt' | 'updatedAt'
>;
export type StoredSessionIndex = {
  version: 1;
  sessions: StoredSessionIndexEntry[];
};
export type StoredSessionPayload = {
  messages: ChatSession['messages'];
};

export const loadSessionPayloadFromRaw = (raw: string | null): ChatSession['messages'] => {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSessionPayload;
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    return messages.map((message) => ({
      ...message,
      timeLabel: message.timeLabel ?? formatMessageTime(message.timestamp),
    }));
  } catch {
    return [];
  }
};

export const loadStoredSessionPayloadFromRaw = (raw: string | null): StoredSessionPayload => {
  try {
    if (!raw) {
      return { messages: [] };
    }
    const parsed = JSON.parse(raw) as StoredSessionPayload;
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    return {
      messages: messages.map((message) => ({
        ...message,
        timeLabel: message.timeLabel ?? formatMessageTime(message.timestamp),
      })),
    };
  } catch {
    return { messages: [] };
  }
};

export const normalizeSession = (session: StoredSession): ChatSession => {
  const provider =
    typeof session.provider === 'string' && VALID_PROVIDER_IDS.has(session.provider)
      ? session.provider
      : DEFAULT_PROVIDER_ID;

  return {
    ...session,
    provider,
    model: session.model ?? DEFAULT_MODEL_NAME,
    messages: (session.messages ?? []).map((message) => ({
      ...message,
      timeLabel: message.timeLabel ?? formatMessageTime(message.timestamp),
    })),
  };
};

export const cloneSessions = (sessions: ChatSession[]): ChatSession[] =>
  sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  }));

export const toSessionIndex = (sessions: ChatSession[]): StoredSessionIndex => ({
  version: 1,
  sessions: sessions.map((session) => ({
    id: session.id,
    title: session.title,
    provider: session.provider,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  })),
});

export const isStoredSessionIndex = (value: unknown): value is StoredSessionIndex => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSessionIndex>;
  return candidate.version === 1 && Array.isArray(candidate.sessions);
};
