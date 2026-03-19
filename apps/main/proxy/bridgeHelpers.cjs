const { URL } = require('node:url');

const parseHeaderValue = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value);
};

const normalizeHeaderString = (value) => parseHeaderValue(value).trim();

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isLoopbackHost = (host) => {
  const normalized = String(host ?? '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

const createJsonResponse = (status, payload) =>
  new globalThis.Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const createNormalizeTargetUrl =
  ({ getAllowHttpTargets }) =>
  (value, { allowLoopbackHttp = true } = {}) => {
    const raw = normalizeHeaderString(value);
    if (!raw) return null;

    try {
      const target = new URL(raw);
      if (!['http:', 'https:'].includes(target.protocol)) {
        return null;
      }
      if (
        target.protocol === 'http:' &&
        !getAllowHttpTargets() &&
        !(allowLoopbackHttp && isLoopbackHost(target.hostname))
      ) {
        return null;
      }
      if (target.username || target.password) {
        return null;
      }
      target.hash = '';
      return target.toString();
    } catch {
      return null;
    }
  };

const createParseCustomHeaders = () => (value) => {
  const raw = normalizeHeaderString(value);
  if (!raw) return [];
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((header) => ({
      key: String(header?.key ?? '').trim(),
      value: String(header?.value ?? '').trim(),
    }))
    .filter((header) => header.key && header.value);
};

const createBuildForwardHeaders =
  ({ blockedHeaders, authHeader }) =>
  (headers, { customHeaders = [] } = {}) => {
    const nextHeaders = new globalThis.Headers();

    for (const [key, value] of headers.entries()) {
      if (blockedHeaders.has(key.toLowerCase())) continue;
      nextHeaders.set(key, value);
    }

    const minimaxApiKey = normalizeHeaderString(headers.get('x-minimax-api-key'));
    if (minimaxApiKey) {
      nextHeaders.set('authorization', `Bearer ${minimaxApiKey}`);
    }

    for (const header of customHeaders) {
      const headerKey = String(header.key ?? '').trim();
      const headerValue = String(header.value ?? '').trim();
      if (!headerKey || !headerValue) continue;
      if (blockedHeaders.has(headerKey.toLowerCase()) || headerKey.toLowerCase() === authHeader) {
        continue;
      }
      nextHeaders.set(headerKey, headerValue);
    }

    return nextHeaders;
  };

const buildStaticRouteTarget = (route, pathname, search) => {
  const suffix = pathname.startsWith(route.path) ? pathname.slice(route.path.length) : '';
  const normalizedSuffix = suffix.startsWith('/') ? suffix : suffix ? `/${suffix}` : '';
  const rewritePath = route.normalizedRewrite ? `/${route.normalizedRewrite.replace(/^\/+/, '')}` : '';
  return `${route.normalizedTarget}${rewritePath}${normalizedSuffix}${search}`;
};

const parseJsonBodyIfNeeded = async (request) => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
};

const canRequestHaveBody = (method) => {
  const normalizedMethod = String(method ?? 'GET').toUpperCase();
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD';
};

const readRequestBodyForForwarding = async (request) => {
  if (!canRequestHaveBody(request.method) || !request.body) {
    return undefined;
  }

  const requestBodyBuffer = await request.arrayBuffer();
  if (requestBodyBuffer.byteLength === 0) {
    return undefined;
  }

  return new Uint8Array(requestBodyBuffer);
};

const createResolveForwardTarget = ({
  proxyPathPrefix,
  staticRouteTable,
  directBridgePrefix,
  openAICompatiblePrefixes,
  headers,
  isDevServerUrl,
  getAllowHttpTargets,
}) => {
  const normalizeTargetUrl = createNormalizeTargetUrl({ getAllowHttpTargets });
  const parseCustomHeaders = createParseCustomHeaders();
  const buildForwardHeaders = createBuildForwardHeaders({
    blockedHeaders: headers.blockedHeaders,
    authHeader: headers.authHeader,
  });

  const buildOpenAICompatibleTarget = ({ pathname, search, requestHeaders }) => {
    const matchedPrefix = openAICompatiblePrefixes.find((prefix) => pathname.startsWith(prefix));
    if (!matchedPrefix) {
      return { error: createJsonResponse(404, { error: 'Unknown AXCHAT protocol route.' }) };
    }

    const targetBaseUrl = normalizeTargetUrl(requestHeaders.get(headers.openaiCompatibleBaseUrl));
    if (!targetBaseUrl) {
      return {
        error: createJsonResponse(400, {
          error: 'Missing or invalid OpenAI-Compatible base URL.',
        }),
      };
    }

    const wildcardPath = pathname.slice(matchedPrefix.length).replace(/^\/+/, '');
    const pathMode = normalizeHeaderString(requestHeaders.get(headers.openaiCompatiblePathMode));
    const normalizedTarget = targetBaseUrl.replace(/\/+$/, '');
    const targetUrl =
      pathMode === 'direct'
        ? `${normalizedTarget}/${wildcardPath}${search}`
        : `${normalizedTarget}/v1/${wildcardPath}${search}`;

    return {
      targetUrl,
      headers: buildForwardHeaders(requestHeaders, {
        customHeaders: parseCustomHeaders(requestHeaders.get(headers.openaiCompatibleHeaders)),
      }),
    };
  };

  const buildSearxngTarget = ({ requestHeaders, requestBody }) => {
    const targetBaseUrl = normalizeTargetUrl(requestHeaders.get(headers.searxngBaseUrl));
    if (!targetBaseUrl) {
      return { error: createJsonResponse(400, { error: 'Missing or invalid SearXNG base URL.' }) };
    }

    const payload =
      requestBody && typeof requestBody === 'object' ? requestBody : requestBody ? {} : {};
    const params = new globalThis.URLSearchParams();
    for (const [key, value] of Object.entries(payload ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    if (!params.has('format')) {
      params.set('format', 'json');
    }

    return {
      targetUrl: `${targetBaseUrl.replace(/\/+$/, '')}/search?${params.toString()}`,
      method: 'GET',
      headers: buildForwardHeaders(requestHeaders),
      body: undefined,
    };
  };

  const buildDirectBridgeTarget = ({ pathname, search, requestHeaders }) => {
    const encodedTarget = pathname.slice(directBridgePrefix.length);
    if (!encodedTarget) {
      return { error: createJsonResponse(400, { error: 'Missing bridged request target.' }) };
    }

    let decodedTarget;
    try {
      decodedTarget = decodeURIComponent(encodedTarget);
    } catch {
      return { error: createJsonResponse(400, { error: 'Invalid bridged request target.' }) };
    }

    const targetUrl = normalizeTargetUrl(`${decodedTarget}${search}`, { allowLoopbackHttp: true });
    if (!targetUrl) {
      return {
        error: createJsonResponse(400, { error: 'Missing or invalid bridged request target.' }),
      };
    }
    if (isDevServerUrl(targetUrl)) {
      return {
        error: createJsonResponse(400, { error: 'Refused to bridge the local dev server origin.' }),
      };
    }

    return {
      targetUrl,
      headers: buildForwardHeaders(requestHeaders),
    };
  };

  const resolveForwardTarget = async (request, url) => {
    const { pathname, search } = url;

    if (!pathname.startsWith(proxyPathPrefix)) {
      return { error: createJsonResponse(404, { error: 'Unknown AXCHAT protocol route.' }) };
    }

    const staticRoute = staticRouteTable.find(
      (route) => pathname === route.path || pathname.startsWith(`${route.path}/`)
    );
    if (staticRoute) {
      return {
        targetUrl: buildStaticRouteTarget(staticRoute, pathname, search),
        headers: buildForwardHeaders(request.headers),
      };
    }

    if (pathname === '/proxy/searxng/search') {
      const requestBody = await parseJsonBodyIfNeeded(request);
      return buildSearxngTarget({
        requestHeaders: request.headers,
        requestBody,
      });
    }

    if (pathname.startsWith(directBridgePrefix)) {
      return buildDirectBridgeTarget({
        pathname,
        search,
        requestHeaders: request.headers,
      });
    }

    if (openAICompatiblePrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return buildOpenAICompatibleTarget({
        pathname,
        search,
        requestHeaders: request.headers,
      });
    }

    return { error: createJsonResponse(404, { error: 'Unknown AXCHAT protocol route.' }) };
  };

  return {
    buildForwardHeaders,
    createJsonResponse,
    readRequestBodyForForwarding,
    resolveForwardTarget,
  };
};

module.exports = {
  createResolveForwardTarget,
  readRequestBodyForForwarding,
};
