/* global console, process */
const { net, protocol, session } = require('electron');
const { URL } = require('node:url');
const { loadProxyConfig, loadProxyState, persistProxyState } = require('./proxy/config.cjs');
const { createResolveForwardTarget } = require('./proxy/bridgeHelpers.cjs');

const { PROXY_PATH_PREFIX, STATIC_PROXY_ROUTES, OPENAI_COMPATIBLE_ROUTE_PATTERNS } =
  loadProxyConfig();

const Orlinx_PROTOCOL_SCHEME = 'orlinx';
const Orlinx_PROTOCOL_HOST = 'local';
const Orlinx_PROTOCOL_ORIGIN = `${Orlinx_PROTOCOL_SCHEME}://${Orlinx_PROTOCOL_HOST}`;
const AUTH_HEADER = 'x-orlinx-proxy-token';
const OPENAI_COMPATIBLE_PATH_HEADER = 'x-orlinx-openai-compatible-path-mode';
const OPENAI_COMPATIBLE_BASE_URL_HEADER = 'x-openai-compatible-base-url';
const OPENAI_COMPATIBLE_HEADERS_HEADER = 'x-openai-compatible-headers';
const SEARXNG_BASE_URL_HEADER = 'x-searxng-base-url';
const DIRECT_BRIDGE_PREFIX = `${PROXY_PATH_PREFIX}/bridge/direct/`;
const OPENAI_COMPATIBLE_PREFIXES = OPENAI_COMPATIBLE_ROUTE_PATTERNS.map((pattern) =>
  pattern.replace(/\*$/, '')
);
const STATIC_ROUTE_TABLE = STATIC_PROXY_ROUTES.map((route) => ({
  ...route,
  normalizedTarget: String(route.target ?? '').replace(/\/+$/, ''),
  normalizedRewrite: String(route.rewrite ?? '').replace(/\/+$/, ''),
}));
const BLOCKED_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'origin',
  'referer',
  AUTH_HEADER,
  'x-minimax-api-key',
  OPENAI_COMPATIBLE_BASE_URL_HEADER,
  OPENAI_COMPATIBLE_HEADERS_HEADER,
  OPENAI_COMPATIBLE_PATH_HEADER,
  SEARXNG_BASE_URL_HEADER,
]);

let proxyState = loadProxyState();
let protocolInstalled = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: Orlinx_PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const isDevServerUrl = (urlString) => {
  try {
    const target = new URL(urlString);
    const devUrl = process.env.VITE_DEV_SERVER_URL
      ? new URL(process.env.VITE_DEV_SERVER_URL)
      : new URL('http://localhost:3000');
    return target.origin === devUrl.origin;
  } catch {
    return false;
  }
};

const {
  buildForwardHeaders,
  createJsonResponse,
  readRequestBodyForForwarding,
  resolveForwardTarget,
} = createResolveForwardTarget({
  proxyPathPrefix: PROXY_PATH_PREFIX,
  staticRouteTable: STATIC_ROUTE_TABLE,
  directBridgePrefix: DIRECT_BRIDGE_PREFIX,
  openAICompatiblePrefixes: OPENAI_COMPATIBLE_PREFIXES,
  headers: {
    authHeader: AUTH_HEADER,
    blockedHeaders: BLOCKED_HEADERS,
    openaiCompatibleBaseUrl: OPENAI_COMPATIBLE_BASE_URL_HEADER,
    openaiCompatibleHeaders: OPENAI_COMPATIBLE_HEADERS_HEADER,
    openaiCompatiblePathMode: OPENAI_COMPATIBLE_PATH_HEADER,
    searxngBaseUrl: SEARXNG_BASE_URL_HEADER,
  },
  isDevServerUrl,
  getAllowHttpTargets: () => proxyState.allowHttpTargets,
});

const installProtocolHandler = () => {
  if (protocolInstalled) return;
  protocolInstalled = true;

  session.defaultSession.protocol.handle(Orlinx_PROTOCOL_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== Orlinx_PROTOCOL_HOST) {
        return createJsonResponse(404, { error: 'Unknown Orlinx protocol host.' });
      }

      const resolved = await resolveForwardTarget(request, url);
      if (resolved.error) {
        return resolved.error;
      }

      const requestInit = {
        method: resolved.method ?? request.method,
        headers: resolved.headers ?? buildForwardHeaders(request.headers),
        bypassCustomProtocolHandlers: true,
      };
      const requestBody =
        resolved.body !== undefined ? resolved.body : await readRequestBodyForForwarding(request);

      if (requestBody !== undefined) {
        requestInit.body = requestBody;
      }

      return await net.fetch(resolved.targetUrl, requestInit);
    } catch (error) {
      console.error('Orlinx protocol bridge request failed:', {
        requestUrl: request.url,
        method: request.method,
        error: error instanceof Error ? error.message : error,
      });
      return createJsonResponse(502, {
        error: error instanceof Error ? error.message : 'Upstream request failed.',
      });
    }
  });
};

const startProxy = async () => {
  installProtocolHandler();
};

const stopProxy = () => {};

const persistState = (nextState) => {
  proxyState = nextState;
  persistProxyState(proxyState);
};

const setAllowHttpTargets = async (enabled) => {
  const nextEnabled = enabled === true;
  if (proxyState.allowHttpTargets === nextEnabled) {
    return { changed: false, enabled: nextEnabled };
  }

  persistState({ ...proxyState, allowHttpTargets: nextEnabled });
  return { changed: true, enabled: nextEnabled };
};

const installProxyAuthHeaderInjection = () => {};

module.exports = {
  Orlinx_PROTOCOL_ORIGIN,
  startProxy,
  stopProxy,
  setAllowHttpTargets,
  installProxyAuthHeaderInjection,
};

