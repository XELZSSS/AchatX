import * as proxyRoutes from './proxy-routes';

export type StaticProxyRoute = (typeof proxyRoutes.STATIC_PROXY_ROUTES)[number];
export type ProxyRouteId = keyof typeof proxyRoutes.PROXY_ROUTES;

export const {
  PROXY_PATH_PREFIX,
  PROXY_ROUTES,
  OPENAI_COMPATIBLE_ROUTE_PATTERNS,
  STATIC_PROXY_ROUTES,
} = proxyRoutes;

export const resolveProxyPath = (routeId: ProxyRouteId): string => PROXY_ROUTES[routeId];
