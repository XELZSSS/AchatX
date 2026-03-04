/* global process, URL */
import proxyConfig from '../../shared/proxy-config.cjs';

const { resolveProxyPort, resolveProxyHost } = proxyConfig;

export const PORT = Number(resolveProxyPort(process.env.MINIMAX_PROXY_PORT));
export const HOST = resolveProxyHost(process.env.MINIMAX_PROXY_HOST);
export const AUTH_HEADER = 'x-achatx-proxy-token';
export const PROXY_AUTH_TOKEN = (process.env.ACHATX_PROXY_TOKEN ?? '').trim();
export const proxyAuthEnabled = PROXY_AUTH_TOKEN.length > 0;
export const staticProxyHttp2Enabled = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ACHATX_PROXY_STATIC_HTTP2 ?? '')
    .trim()
    .toLowerCase()
);

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export const parseHeaderValue = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return value[0] ?? '';
  return String(value);
};

export const allowedOrigins = new Set(DEFAULT_ALLOWED_ORIGINS);
const additionalAllowedOrigins = (process.env.MINIMAX_PROXY_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
for (const origin of additionalAllowedOrigins) {
  allowedOrigins.add(origin);
}

export const isAllowedOrigin = (origin) => {
  if (!origin || origin === 'null') return true;
  return allowedOrigins.has(origin);
};

export const blockedHeaders = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'origin',
  'referer',
  AUTH_HEADER,
]);

export const normalizeTargetUrl = (value) => {
  const raw = parseHeaderValue(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const parseCustomHeaders = (value) => {
  const raw = parseHeaderValue(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((header) => ({
        key: String(header?.key ?? '').trim(),
        value: String(header?.value ?? '').trim(),
      }))
      .filter((header) => header.key && header.value);
  } catch {
    return [];
  }
};

export const buildForwardHeaders = (
  headers,
  { removeBlockedHeaders = false, customHeaders = [] } = {}
) => {
  const next = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined) continue;
    if (removeBlockedHeaders && blockedHeaders.has(key.toLowerCase())) continue;
    next[key] = value;
  }

  const key = parseHeaderValue((headers ?? {})['x-minimax-api-key']).trim();
  if (key) {
    next.authorization = `Bearer ${key}`;
  }

  for (const header of customHeaders) {
    const headerKey = String(header.key ?? '').trim();
    const headerValue = String(header.value ?? '').trim();
    if (!headerKey || !headerValue) continue;
    if (blockedHeaders.has(headerKey.toLowerCase())) continue;
    next[headerKey] = headerValue;
  }

  return next;
};

export const staticRoutes = [
  { path: '/proxy/minimax-intl', target: 'https://api.minimax.io', rewrite: '/v1' },
  { path: '/proxy/minimax-cn', target: 'https://api.minimaxi.com', rewrite: '/v1' },
  { path: '/proxy/moonshot-intl', target: 'https://api.moonshot.ai', rewrite: '/v1' },
  { path: '/proxy/moonshot-cn', target: 'https://api.moonshot.cn', rewrite: '/v1' },
  { path: '/proxy/iflow', target: 'https://apis.iflow.cn', rewrite: '/v1' },
  { path: '/proxy/openai', target: 'https://api.openai.com', rewrite: '/v1' },
  { path: '/proxy/deepseek', target: 'https://api.deepseek.com', rewrite: '' },
  { path: '/proxy/glm-cn', target: 'https://open.bigmodel.cn', rewrite: '/api/paas/v4' },
  { path: '/proxy/glm-intl', target: 'https://api.z.ai', rewrite: '/api/paas/v4' },
  { path: '/proxy/tavily', target: 'https://api.tavily.com', rewrite: '' },
  { path: '/proxy/mem0', target: 'https://api.mem0.ai', rewrite: '/v1' },
];
