/* global console */
const { shell } = require('electron');
const { buildAuthorizeUrl } = require('./geminiCliAuth/config.cjs');
const { REFRESH_SKEW_MS } = require('./geminiCliAuth/constants.cjs');
const {
  clearSession,
  persistSession,
  readSession,
  toStatus,
} = require('./geminiCliAuth/storage.cjs');
const {
  createPkce,
  createState,
  exchangeAuthorizationCode,
  refreshAccessToken,
  waitForAuthorizationCode,
} = require('./geminiCliAuth/oauth.cjs');
const { resolveProjectContext } = require('./geminiCliAuth/project.cjs');

let loginPromise = null;
let refreshPromise = null;

const ensureFreshSession = async () => {
  const session = readSession();
  if (!session) return null;

  let nextSession = session;
  if (session.expiresAt <= Date.now() + REFRESH_SKEW_MS) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshed = await refreshAccessToken(session, clearSession);
          if (!refreshed) return null;
          persistSession(refreshed);
          return refreshed;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    nextSession = await refreshPromise;
    if (!nextSession) return null;
  }

  try {
    const resolved = await resolveProjectContext(nextSession);
    const persisted = {
      accessToken: resolved.accessToken,
      refreshToken: resolved.refreshToken,
      expiresAt: resolved.expiresAt,
      email: resolved.email,
      projectId: resolved.projectId,
      managedProjectId: resolved.managedProjectId,
    };

    if (JSON.stringify(persisted) !== JSON.stringify(nextSession)) {
      persistSession(persisted);
    }

    return {
      ...persisted,
      effectiveProjectId: resolved.effectiveProjectId,
    };
  } catch (error) {
    console.warn('Failed to resolve Gemini CLI OAuth project context:', error);
    return {
      ...nextSession,
      effectiveProjectId: nextSession.managedProjectId || nextSession.projectId,
    };
  }
};

const loginGeminiCliAuth = async () => {
  if (!loginPromise) {
    loginPromise = (async () => {
      const { verifier, challenge } = createPkce();
      const state = createState();
      const { redirectUri, codePromise } = await waitForAuthorizationCode({
        expectedState: state,
      });
      const authorizeUrl = buildAuthorizeUrl({ challenge, state, redirectUri });

      try {
        await shell.openExternal(authorizeUrl);
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to open the browser for OAuth login.',
          { cause: error }
        );
      }

      const { code } = await codePromise;
      const session = await exchangeAuthorizationCode(code, verifier, redirectUri);
      persistSession(session);
      const ensured = await ensureFreshSession();
      return toStatus(ensured ?? session);
    })().finally(() => {
      loginPromise = null;
    });
  }

  return loginPromise;
};

const logoutGeminiCliAuth = async () => {
  clearSession();
  return toStatus(null);
};

const getGeminiCliAuthStatus = async () => {
  try {
    const session = await ensureFreshSession();
    return toStatus(session);
  } catch {
    return toStatus(null);
  }
};

const getGeminiCliAuthSession = async () => {
  const session = await ensureFreshSession();
  if (!session) return null;

  return {
    authenticated: true,
    accessToken: session.accessToken,
    email: session.email,
    expiresAt: session.expiresAt,
    projectId: session.effectiveProjectId,
  };
};

module.exports = {
  getGeminiCliAuthSession,
  getGeminiCliAuthStatus,
  loginGeminiCliAuth,
  logoutGeminiCliAuth,
};
