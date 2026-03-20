const AUTH_STORAGE_KEY = 'geminiCliOAuth';
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json';
const CODE_ASSIST_BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';
const GEMINI_CLI_LOCAL_CONFIG_NAME = 'orlinx.local.json';
const REDIRECT_PATH = '/oauth2callback';
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
const REFRESH_SKEW_MS = 60 * 1000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const FREE_TIER_ID = 'free-tier';
const LEGACY_TIER_ID = 'legacy-tier';
const CODE_ASSIST_HEADERS = {
  'X-Goog-Api-Client': 'gl-node/22.17.0',
  'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
};

module.exports = {
  AUTH_STORAGE_KEY,
  AUTHORIZE_URL,
  TOKEN_URL,
  USER_INFO_URL,
  CODE_ASSIST_BASE_URL,
  GEMINI_CLI_LOCAL_CONFIG_NAME,
  REDIRECT_PATH,
  SCOPES,
  REFRESH_SKEW_MS,
  LOGIN_TIMEOUT_MS,
  FREE_TIER_ID,
  LEGACY_TIER_ID,
  CODE_ASSIST_HEADERS,
};

