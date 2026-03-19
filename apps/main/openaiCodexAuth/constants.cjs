const AUTH_STORAGE_KEY = 'openaiCodexOAuth';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const REDIRECT_PORT = 1455;
const REDIRECT_PATH = '/auth/callback';
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`;
const SCOPE = 'openid profile email offline_access';
const JWT_CLAIM_PATH = 'https://api.openai.com/auth';
const REFRESH_SKEW_MS = 60 * 1000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

module.exports = {
  AUTH_STORAGE_KEY,
  AUTHORIZE_URL,
  CLIENT_ID,
  JWT_CLAIM_PATH,
  LOGIN_TIMEOUT_MS,
  REDIRECT_PATH,
  REDIRECT_PORT,
  REDIRECT_URI,
  REFRESH_SKEW_MS,
  SCOPE,
  TOKEN_URL,
};
