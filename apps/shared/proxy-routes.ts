export const PROXY_PATH_PREFIX = '/proxy';

export const PROXY_ROUTES = {
  minimaxIntl: `${PROXY_PATH_PREFIX}/minimax-intl`,
  minimaxCn: `${PROXY_PATH_PREFIX}/minimax-cn`,
  moonshotIntl: `${PROXY_PATH_PREFIX}/moonshot-intl`,
  moonshotCn: `${PROXY_PATH_PREFIX}/moonshot-cn`,
  openai: `${PROXY_PATH_PREFIX}/openai`,
  deepseek: `${PROXY_PATH_PREFIX}/deepseek`,
  glmCn: `${PROXY_PATH_PREFIX}/glm-cn`,
  glmIntl: `${PROXY_PATH_PREFIX}/glm-intl`,
  tavily: `${PROXY_PATH_PREFIX}/tavily`,
  exa: `${PROXY_PATH_PREFIX}/exa`,
  geminiCli: `${PROXY_PATH_PREFIX}/gemini-cli`,
  searxng: `${PROXY_PATH_PREFIX}/searxng`,
  openaiCompatible: `${PROXY_PATH_PREFIX}/openai-compatible`,
  openaiCompatibleV1: `${PROXY_PATH_PREFIX}/openai-compatible/v1`,
} as const;

export const OPENAI_COMPATIBLE_ROUTE_PATTERNS = [
  `${PROXY_ROUTES.openaiCompatibleV1}/*`,
  `${PROXY_ROUTES.openaiCompatible}/*`,
] as const;

export const STATIC_PROXY_ROUTES = [
  { path: PROXY_ROUTES.minimaxIntl, target: 'https://api.minimax.io', rewrite: '/v1' },
  { path: PROXY_ROUTES.minimaxCn, target: 'https://api.minimaxi.com', rewrite: '/v1' },
  { path: PROXY_ROUTES.moonshotIntl, target: 'https://api.moonshot.ai', rewrite: '/v1' },
  { path: PROXY_ROUTES.moonshotCn, target: 'https://api.moonshot.cn', rewrite: '/v1' },
  { path: PROXY_ROUTES.openai, target: 'https://api.openai.com', rewrite: '/v1' },
  { path: PROXY_ROUTES.deepseek, target: 'https://api.deepseek.com', rewrite: '' },
  { path: PROXY_ROUTES.glmCn, target: 'https://open.bigmodel.cn', rewrite: '/api/paas/v4' },
  { path: PROXY_ROUTES.glmIntl, target: 'https://api.z.ai', rewrite: '/api/paas/v4' },
  { path: PROXY_ROUTES.tavily, target: 'https://api.tavily.com', rewrite: '' },
  { path: PROXY_ROUTES.exa, target: 'https://api.exa.ai', rewrite: '' },
  { path: PROXY_ROUTES.geminiCli, target: 'https://cloudcode-pa.googleapis.com', rewrite: '' },
] as const;
