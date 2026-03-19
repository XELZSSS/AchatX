/* global URL, process */
const fs = require('fs');
const path = require('path');
const {
  AUTHORIZE_URL,
  GEMINI_CLI_LOCAL_CONFIG_NAME,
  REDIRECT_PATH,
  SCOPES,
} = require('./constants.cjs');

const normalizeText = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const getLocalConfigCandidates = () => {
  const candidates = [path.resolve(process.cwd(), GEMINI_CLI_LOCAL_CONFIG_NAME)];
  const resourcesPath = normalizeText(process.resourcesPath);
  if (resourcesPath) {
    candidates.push(path.resolve(resourcesPath, GEMINI_CLI_LOCAL_CONFIG_NAME));
  }
  return Array.from(new Set(candidates));
};

const readJsonFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const getGeminiCliOAuthConfig = () => {
  for (const candidate of getLocalConfigCandidates()) {
    const config = readJsonFile(candidate);
    if (!config || typeof config !== 'object') continue;

    const section =
      config.geminiCliOAuth && typeof config.geminiCliOAuth === 'object'
        ? config.geminiCliOAuth
        : config;

    const clientId = normalizeText(
      section.clientId ??
        section.client_id ??
        section.geminiCliOAuthClientId ??
        section.GEMINI_CLI_OAUTH_CLIENT_ID
    );
    const clientSecret = normalizeText(
      section.clientSecret ??
        section.client_secret ??
        section.geminiCliOAuthClientSecret ??
        section.GEMINI_CLI_OAUTH_CLIENT_SECRET
    );

    if (clientId && clientSecret) {
      return { clientId, clientSecret };
    }
  }

  return null;
};

const requireGeminiCliOAuthConfig = () => {
  const config = getGeminiCliOAuthConfig();
  if (!config) {
    throw new Error(
      'Missing Gemini CLI OAuth client config. Put clientId and clientSecret in axchat.local.json.'
    );
  }
  return config;
};

const getConfiguredRedirectPort = () => {
  const configured = String(process.env.OAUTH_CALLBACK_PORT ?? '').trim();
  if (!configured) return 0;

  const port = Number(configured);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid OAUTH_CALLBACK_PORT: ${configured}`);
  }

  return port;
};

const createRedirectUri = (port) => `http://127.0.0.1:${port}${REDIRECT_PATH}`;

const buildAuthorizeUrl = ({ challenge, state, redirectUri }) => {
  const { clientId } = requireGeminiCliOAuthConfig();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.hash = 'axchat';
  return url.toString();
};

module.exports = {
  normalizeText,
  getGeminiCliOAuthConfig,
  requireGeminiCliOAuthConfig,
  getConfiguredRedirectPort,
  createRedirectUri,
  buildAuthorizeUrl,
};
