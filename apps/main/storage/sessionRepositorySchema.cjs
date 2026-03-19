const { randomUUID } = require('crypto');
const { PROVIDER_IDS } = require('../../shared/provider-ids.cjs');

const ACTIVE_SESSION_ID_KEY = 'activeSessionId';
const VALID_PROVIDER_IDS = new Set(PROVIDER_IDS);
const VALID_MESSAGE_ROLES = new Set(['user', 'model']);
const DEFAULT_PROVIDER_ID = PROVIDER_IDS[0] ?? 'gemini';

const parseJsonField = (value, fallback) => {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeTimestamp = (value, fallback = Date.now()) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid session payload: "${fieldName}" must be a non-empty string`);
  }

  return value.trim();
};

const assertProviderId = (value) => {
  const providerId = assertNonEmptyString(value, 'provider');
  if (!VALID_PROVIDER_IDS.has(providerId)) {
    throw new Error(`Invalid session payload: unsupported provider "${providerId}"`);
  }
  return providerId;
};

const normalizeStoredProviderId = (value) => {
  return typeof value === 'string' && VALID_PROVIDER_IDS.has(value) ? value : DEFAULT_PROVIDER_ID;
};

const normalizeToolCall = (value, index) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid session payload: "toolCalls[${index}]" must be an object`);
  }

  return {
    id: assertNonEmptyString(value.id, `toolCalls[${index}].id`),
    name: assertNonEmptyString(value.name, `toolCalls[${index}].name`),
    argumentsText: typeof value.argumentsText === 'string' ? value.argumentsText : '',
    source: value.source === 'native' ? 'native' : value.source === 'custom' ? 'custom' : undefined,
    provider:
      typeof value.provider === 'string' && VALID_PROVIDER_IDS.has(value.provider)
        ? value.provider
        : undefined,
  };
};

const normalizeToolResult = (value, index) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid session payload: "toolResults[${index}]" must be an object`);
  }

  return {
    id: assertNonEmptyString(value.id, `toolResults[${index}].id`),
    name: assertNonEmptyString(value.name, `toolResults[${index}].name`),
    outputText: typeof value.outputText === 'string' ? value.outputText : '',
    isError: Boolean(value.isError),
    source: value.source === 'native' ? 'native' : value.source === 'custom' ? 'custom' : undefined,
    provider:
      typeof value.provider === 'string' && VALID_PROVIDER_IDS.has(value.provider)
        ? value.provider
        : undefined,
  };
};

const normalizeTokenUsage = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid session payload: "tokenUsage" must be an object');
  }

  const normalized = {};
  const numericFields = [
    'totalTokensIn',
    'totalTokensOut',
    'totalCacheWrites',
    'totalCacheReads',
    'totalCost',
    'contextTokens',
  ];

  for (const field of numericFields) {
    const candidate = value[field];
    if (candidate === undefined) continue;
    if (typeof candidate !== 'number' || Number.isFinite(candidate) === false) {
      throw new Error(`Invalid session payload: "tokenUsage.${field}" must be a finite number`);
    }
    normalized[field] = candidate;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeMessageId = (value) => {
  if (typeof value !== 'string') {
    return `message-${randomUUID()}`;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : `message-${randomUUID()}`;
};

const normalizeMessage = (value, index) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid session payload: "messages[${index}]" must be an object`);
  }

  const role = assertNonEmptyString(value.role, `messages[${index}].role`);
  if (!VALID_MESSAGE_ROLES.has(role)) {
    throw new Error(`Invalid session payload: unsupported role "${role}"`);
  }

  return {
    id: normalizeMessageId(value.id),
    role,
    text: typeof value.text === 'string' ? value.text : '',
    timestamp: normalizeTimestamp(value.timestamp),
    reasoning:
      typeof value.reasoning === 'string' && value.reasoning.length > 0
        ? value.reasoning
        : undefined,
    isError: Boolean(value.isError),
    tokenUsage: normalizeTokenUsage(value.tokenUsage),
    toolCalls: Array.isArray(value.toolCalls)
      ? value.toolCalls.map((toolCall, toolCallIndex) => normalizeToolCall(toolCall, toolCallIndex))
      : undefined,
    toolResults: Array.isArray(value.toolResults)
      ? value.toolResults.map((toolResult, toolResultIndex) =>
          normalizeToolResult(toolResult, toolResultIndex)
        )
      : undefined,
    citations: Array.isArray(value.citations) ? value.citations : undefined,
  };
};

const normalizeSessionPayload = (session) => {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    throw new Error('Invalid session payload: expected an object');
  }

  return {
    id: assertNonEmptyString(session.id, 'id'),
    title: assertNonEmptyString(session.title, 'title'),
    provider: assertProviderId(session.provider),
    model: assertNonEmptyString(session.model, 'model'),
    createdAt: normalizeTimestamp(session.createdAt),
    updatedAt: normalizeTimestamp(session.updatedAt),
    messages: Array.isArray(session.messages)
      ? session.messages.map((message, index) => normalizeMessage(message, index))
      : [],
  };
};

const normalizeMessageRow = (row) => ({
  id: row.id,
  role: row.role,
  text: row.text,
  timestamp: normalizeTimestamp(row.timestamp, row.created_at),
  reasoning:
    typeof row.reasoning === 'string' && row.reasoning.length > 0 ? row.reasoning : undefined,
  isError: Boolean(row.is_error),
  tokenUsage: parseJsonField(row.token_usage_json, undefined),
  toolCalls: parseJsonField(row.tool_calls_json, undefined),
  toolResults: parseJsonField(row.tool_results_json, undefined),
  citations: parseJsonField(row.citations_json, undefined),
});

const normalizeSessionRow = (row, messages) => ({
  id: row.id,
  title: row.title,
  provider: normalizeStoredProviderId(row.provider_id),
  model: row.model_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messages,
});

const serializeJsonField = (value) => {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
};

const ensureUniqueMessageIds = (messages) => {
  const usedIds = new Set();

  return messages.map((message) => {
    const baseId = normalizeMessageId(message?.id);
    let nextId = baseId;
    let duplicateCounter = 1;

    while (usedIds.has(nextId)) {
      nextId = `${baseId}__${duplicateCounter}`;
      duplicateCounter += 1;
    }

    usedIds.add(nextId);
    return {
      ...message,
      id: nextId,
    };
  });
};

module.exports = {
  ACTIVE_SESSION_ID_KEY,
  assertNonEmptyString,
  ensureUniqueMessageIds,
  normalizeMessageRow,
  normalizeSessionPayload,
  normalizeSessionRow,
  normalizeTimestamp,
  parseJsonField,
  serializeJsonField,
};
