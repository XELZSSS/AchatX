const {
  listSessions,
  listSessionsWithLimit,
  getActiveSessionId,
  getSession,
  saveActiveSessionId,
  clearActiveSessionId,
  saveSession,
  renameSession,
  deleteSession,
  searchSessions,
} = require('../storage/sessionRepository.cjs');

const buildSessionHandlers = () => ({
  'storage:sessions:list': async (_event, payload) => {
    const record = payload && typeof payload === 'object' ? payload : {};
    if (record.limit !== undefined) {
      return listSessionsWithLimit(Number(record.limit));
    }
    return listSessions();
  },
  'storage:sessions:get': async (_event, sessionId) => {
    return getSession(String(sessionId ?? ''));
  },
  'storage:sessions:get-active-id': async () => {
    return getActiveSessionId();
  },
  'storage:sessions:set-active-id': async (_event, sessionId) => {
    saveActiveSessionId(String(sessionId ?? ''));
  },
  'storage:sessions:clear-active-id': async () => {
    clearActiveSessionId();
  },
  'storage:sessions:save': async (_event, session) => {
    saveSession(session && typeof session === 'object' ? session : {});
  },
  'storage:sessions:rename': async (_event, payload) => {
    const record = payload && typeof payload === 'object' ? payload : {};
    renameSession(String(record.sessionId ?? ''), String(record.title ?? ''));
  },
  'storage:sessions:delete': async (_event, sessionId) => {
    deleteSession(String(sessionId ?? ''));
  },
  'storage:sessions:search': async (_event, payload) => {
    const record = payload && typeof payload === 'object' ? payload : {};
    return searchSessions(String(record.query ?? ''), Number(record.limit ?? 200));
  },
});

module.exports = {
  buildSessionHandlers,
};
