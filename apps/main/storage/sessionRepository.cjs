/* global console */
const { ensureDatabase } = require('./db.cjs');
const {
  ACTIVE_SESSION_ID_KEY,
  assertNonEmptyString,
  ensureUniqueMessageIds,
  normalizeSessionPayload,
  normalizeSessionRow,
  normalizeTimestamp,
  parseJsonField,
  serializeJsonField,
} = require('./sessionRepositorySchema.cjs');
const {
  getSessionRow,
  listSessionMessages,
  listSessionsWithLimit,
} = require('./sessionRepositoryQueries.cjs');

const listSessions = () => listSessionsWithLimit(null);

const searchSessions = (query, limit = 200) => {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const maxLimit = Math.max(1, Math.min(500, Number(limit) || 200));
  if (!normalizedQuery) {
    return listSessionsWithLimit(maxLimit);
  }

  const db = ensureDatabase();
  const keyword = `%${normalizedQuery}%`;
  const rows = db
    .prepare(
      `SELECT DISTINCT s.id, s.title, s.provider_id, s.model_name, s.created_at, s.updated_at
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       WHERE s.title LIKE @keyword COLLATE NOCASE
          OR m.text LIKE @keyword COLLATE NOCASE
       ORDER BY s.updated_at DESC
       LIMIT @limit`
    )
    .all({ keyword, limit: maxLimit });

  return rows.map((row) => normalizeSessionRow(row, []));
};

const getSession = (sessionId) => {
  const row = getSessionRow(sessionId);
  if (!row) {
    return null;
  }

  return normalizeSessionRow(row, listSessionMessages(sessionId));
};

const getActiveSessionId = () => {
  const db = ensureDatabase();
  const row = db
    .prepare(`SELECT value_json FROM app_settings WHERE key = ?`)
    .get(ACTIVE_SESSION_ID_KEY);

  if (!row) {
    return null;
  }

  const parsed = parseJsonField(row.value_json, null);
  return typeof parsed === 'string' && parsed.trim().length > 0 ? parsed : null;
};

const saveActiveSessionId = (sessionId) => {
  const db = ensureDatabase();
  const now = Date.now();
  const normalizedSessionId = assertNonEmptyString(sessionId, 'activeSessionId');

  db.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at)
     VALUES (@key, @value_json, @updated_at)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`
  ).run({
    key: ACTIVE_SESSION_ID_KEY,
    value_json: JSON.stringify(normalizedSessionId),
    updated_at: now,
  });
};

const clearActiveSessionId = () => {
  const db = ensureDatabase();
  db.prepare(`DELETE FROM app_settings WHERE key = ?`).run(ACTIVE_SESSION_ID_KEY);
};

const saveSession = (session) => {
  const db = ensureDatabase();
  const normalizedSession = normalizeSessionPayload(session);
  const messages = ensureUniqueMessageIds(normalizedSession.messages);

  const persistSession = db.transaction((payload) => {
    db.prepare(
      `INSERT INTO sessions (
         id, title, provider_id, model_name, created_at, updated_at
       ) VALUES (
         @id, @title, @provider_id, @model_name, @created_at, @updated_at
       )
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         provider_id = excluded.provider_id,
         model_name = excluded.model_name,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`
    ).run({
      id: payload.id,
      title: payload.title,
      provider_id: payload.provider,
      model_name: payload.model,
      created_at: normalizeTimestamp(payload.createdAt),
      updated_at: normalizeTimestamp(payload.updatedAt),
    });

    const normalizedSessionId = payload.id;
    const incomingMessageIds = payload.messages.map((message) => message.id);

    if (incomingMessageIds.length === 0) {
      db.prepare(`DELETE FROM messages WHERE session_id = ?`).run(normalizedSessionId);
      return;
    }

    const stalePlaceholders = incomingMessageIds.map(() => '?').join(', ');
    db.prepare(
      `DELETE FROM messages
       WHERE session_id = ?
         AND id NOT IN (${stalePlaceholders})`
    ).run(normalizedSessionId, ...incomingMessageIds);

    db.prepare(`UPDATE messages SET seq = -seq - 1 WHERE session_id = ?`).run(normalizedSessionId);

    const upsertMessage = db.prepare(
      `INSERT INTO messages (
         id, session_id, seq, role, text, timestamp, reasoning, is_error,
         token_usage_json, tool_calls_json, tool_results_json, citations_json, created_at
       ) VALUES (
         @id, @session_id, @seq, @role, @text, @timestamp, @reasoning, @is_error,
         @token_usage_json, @tool_calls_json, @tool_results_json, @citations_json, @created_at
       )
       ON CONFLICT(session_id, id) DO UPDATE SET
         seq = excluded.seq,
         role = excluded.role,
         text = excluded.text,
         timestamp = excluded.timestamp,
         reasoning = excluded.reasoning,
         is_error = excluded.is_error,
         token_usage_json = excluded.token_usage_json,
         tool_calls_json = excluded.tool_calls_json,
         tool_results_json = excluded.tool_results_json,
         citations_json = excluded.citations_json,
         created_at = excluded.created_at`
    );

    payload.messages.forEach((message, index) => {
      const timestamp = normalizeTimestamp(message.timestamp);
      upsertMessage.run({
        id: message.id,
        session_id: normalizedSessionId,
        seq: index,
        role: message.role,
        text: message.text,
        timestamp,
        reasoning:
          typeof message.reasoning === 'string' && message.reasoning.length > 0
            ? message.reasoning
            : null,
        is_error: message.isError ? 1 : 0,
        token_usage_json: serializeJsonField(message.tokenUsage),
        tool_calls_json: serializeJsonField(message.toolCalls),
        tool_results_json: serializeJsonField(message.toolResults),
        citations_json: serializeJsonField(message.citations),
        created_at: timestamp,
      });
    });
  });

  persistSession({
    ...normalizedSession,
    messages,
  });
};

const renameSession = (sessionId, title) => {
  const db = ensureDatabase();
  const normalizedSessionId = assertNonEmptyString(sessionId, 'sessionId');
  const normalizedTitle = assertNonEmptyString(title, 'title');
  db.prepare(
    `UPDATE sessions
     SET title = @title
     WHERE id = @id`
  ).run({
    id: normalizedSessionId,
    title: normalizedTitle,
  });
};

const deleteSession = (sessionId) => {
  const db = ensureDatabase();
  const normalizedSessionId = assertNonEmptyString(sessionId, 'sessionId');

  const removeSession = db.transaction((id) => {
    const deletedMessages = db.prepare(`DELETE FROM messages WHERE session_id = ?`).run(id);
    const deletedSessions = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    const activeSessionId = getActiveSessionId();

    if (activeSessionId === id) {
      clearActiveSessionId();
    }

    const remainingSessionRow = db
      .prepare(`SELECT COUNT(*) AS count FROM sessions WHERE id = ?`)
      .get(id);
    const remainingMessageRow = db
      .prepare(`SELECT COUNT(*) AS count FROM messages WHERE session_id = ?`)
      .get(id);

    if ((remainingSessionRow?.count ?? 0) > 0 || (remainingMessageRow?.count ?? 0) > 0) {
      throw new Error(`Failed to fully delete session "${id}" from local storage`);
    }

    return {
      sessionId: id,
      deletedSessionCount: deletedSessions.changes,
      deletedMessageCount: deletedMessages.changes,
      clearedActiveSession: activeSessionId === id,
      verifiedDeleted: true,
    };
  });

  const result = removeSession(normalizedSessionId);
  console.warn('[session-store] verified session deletion', result);
  return result;
};

module.exports = {
  clearActiveSessionId,
  deleteSession,
  getActiveSessionId,
  getSession,
  listSessions,
  listSessionsWithLimit,
  searchSessions,
  renameSession,
  saveActiveSessionId,
  saveSession,
};
