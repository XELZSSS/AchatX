const { ensureDatabase } = require('./db.cjs');
const {
  normalizeMessageRow,
  normalizeSessionRow,
} = require('./sessionRepositorySchema.cjs');

const getSessionRow = (sessionId) => {
  const db = ensureDatabase();
  return db
    .prepare(
      `SELECT id, title, provider_id, model_name, created_at, updated_at
       FROM sessions
       WHERE id = ?`
    )
    .get(String(sessionId));
};

const listSessionMessages = (sessionId) => {
  const db = ensureDatabase();
  const rows = db
    .prepare(
      `SELECT id, session_id, seq, role, text, timestamp, reasoning, is_error,
              token_usage_json, tool_calls_json, tool_results_json, citations_json, created_at
       FROM messages
       WHERE session_id = ?
       ORDER BY seq ASC`
    )
    .all(String(sessionId));

  return rows.map((row) => normalizeMessageRow(row));
};

const listSessionsWithLimit = (limit) => {
  const db = ensureDatabase();
  const normalizedLimit =
    typeof limit === 'number' ? Math.max(1, Math.min(500, Number(limit))) : null;
  const statement = normalizedLimit
    ? db.prepare(
        `SELECT id, title, provider_id, model_name, created_at, updated_at
         FROM sessions
        ORDER BY updated_at DESC
        LIMIT @limit`
      )
    : db.prepare(
        `SELECT id, title, provider_id, model_name, created_at, updated_at
         FROM sessions
        ORDER BY updated_at DESC`
      );
  const sessionRows = normalizedLimit ? statement.all({ limit: normalizedLimit }) : statement.all();

  return sessionRows.map((row) => normalizeSessionRow(row, []));
};

module.exports = {
  getSessionRow,
  listSessionMessages,
  listSessionsWithLimit,
};
