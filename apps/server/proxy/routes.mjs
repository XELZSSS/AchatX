export const registerStaticProxyRoutes = async (
  app,
  { proxyPlugin, routes, verifyProxyAuth, buildForwardHeaders, proxyHttp2 }
) => {
  for (const route of routes) {
    await app.register(proxyPlugin, {
      prefix: route.path,
      upstream: route.target,
      rewritePrefix: route.rewrite,
      http2: proxyHttp2,
      preHandler: verifyProxyAuth,
      replyOptions: {
        rewriteRequestHeaders: (_request, headers) => {
          return buildForwardHeaders(headers);
        },
      },
    });
  }
};

export const registerOpenAICompatibleRoute = async (
  app,
  { proxyPlugin, verifyProxyAuth, normalizeTargetUrl, parseCustomHeaders, buildForwardHeaders }
) => {
  await app.register(proxyPlugin, {
    prefix: '/proxy/openai-compatible',
    upstream: '',
    preHandler: async (request, reply) => {
      await verifyProxyAuth(request, reply);
      if (reply.sent) return;

      const target = normalizeTargetUrl(request.headers['x-openai-compatible-base-url']);
      if (!target) {
        await reply.code(400).send({ error: 'Missing or invalid OpenAI-Compatible base URL.' });
        return;
      }

      request.openaiCompatibleTarget = target;
      request.openaiCompatibleHeaders = parseCustomHeaders(
        request.headers['x-openai-compatible-headers']
      );
    },
    replyOptions: {
      getUpstream: (request) => {
        return request.openaiCompatibleTarget;
      },
      rewriteRequestHeaders: (request, headers) => {
        return buildForwardHeaders(headers, {
          removeBlockedHeaders: true,
          customHeaders: request.openaiCompatibleHeaders ?? [],
        });
      },
    },
  });
};
