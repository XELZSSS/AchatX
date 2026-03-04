/* global console */
import Fastify from 'fastify';
import corsPlugin from '@fastify/cors';
import proxyPlugin from '@fastify/http-proxy';
import {
  AUTH_HEADER,
  HOST,
  PORT,
  PROXY_AUTH_TOKEN,
  buildForwardHeaders,
  isAllowedOrigin,
  normalizeTargetUrl,
  parseCustomHeaders,
  parseHeaderValue,
  proxyAuthEnabled,
  staticProxyHttp2Enabled,
  staticRoutes,
} from './proxy/config.mjs';
import { registerCoreMiddlewares } from './proxy/middlewares.mjs';
import { registerOpenAICompatibleRoute, registerStaticProxyRoutes } from './proxy/routes.mjs';

const app = Fastify({ logger: false });

const verifyProxyAuth = await registerCoreMiddlewares(app, {
  corsPlugin,
  isAllowedOrigin,
  proxyAuthEnabled,
  authToken: PROXY_AUTH_TOKEN,
  authHeader: AUTH_HEADER,
  parseHeaderValue,
});

await registerStaticProxyRoutes(app, {
  proxyPlugin,
  routes: staticRoutes,
  verifyProxyAuth,
  buildForwardHeaders,
  proxyHttp2: staticProxyHttp2Enabled,
});

await registerOpenAICompatibleRoute(app, {
  proxyPlugin,
  verifyProxyAuth,
  normalizeTargetUrl,
  parseCustomHeaders,
  buildForwardHeaders,
});

await app.listen({ port: PORT, host: HOST });
console.log(`LLM proxy listening on http://${HOST}:${PORT}`);
