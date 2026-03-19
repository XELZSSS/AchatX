const { shell } = require('electron');
const { REFRESH_SKEW_MS } = require('./openaiCodexAuth/constants.cjs');
const { clearSession, persistSession, readSession, toStatus } = require('./openaiCodexAuth/storage.cjs');
const {
  buildAuthorizeUrl,
  createPkce,
  createState,
  exchangeAuthorizationCode,
  refreshAccessToken,
  waitForAuthorizationCode,
} = require('./openaiCodexAuth/oauth.cjs');

let loginPromise = null;
let refreshPromise = null;

const ensureFreshSession = async () => {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + REFRESH_SKEW_MS) {
    return session;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshed = await refreshAccessToken(session.refreshToken);
        persistSession(refreshed);
        return refreshed;
      } catch (error) {
        clearSession();
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const loginOpenAICodexAuth = async () => {
  if (!loginPromise) {
    loginPromise = (async () => {
      const { verifier, challenge } = createPkce();
      const state = createState();
      const authorizeUrl = buildAuthorizeUrl({ challenge, state });
      const waitForCode = waitForAuthorizationCode({ expectedState: state });

      try {
        await shell.openExternal(authorizeUrl);
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to open the browser for OAuth login.',
          { cause: error }
        );
      }

      const { code } = await waitForCode;
      const session = await exchangeAuthorizationCode(code, verifier);
      persistSession(session);
      return toStatus(session);
    })().finally(() => {
      loginPromise = null;
    });
  }

  return loginPromise;
};

const logoutOpenAICodexAuth = async () => {
  clearSession();
  return toStatus(null);
};

const getOpenAICodexAuthStatus = async () => {
  try {
    const session = await ensureFreshSession();
    return toStatus(session);
  } catch {
    return toStatus(null);
  }
};

const getOpenAICodexAuthSession = async () => {
  const session = await ensureFreshSession();
  if (!session) return null;
  return {
    authenticated: true,
    accessToken: session.accessToken,
    accountId: session.accountId,
    expiresAt: session.expiresAt,
  };
};

module.exports = {
  getOpenAICodexAuthSession,
  getOpenAICodexAuthStatus,
  loginOpenAICodexAuth,
  logoutOpenAICodexAuth,
};
