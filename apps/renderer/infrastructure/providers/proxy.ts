import * as proxyConfig from '../../../shared/proxy-config';

const AXCHAT_PROTOCOL_ORIGIN = 'axchat://local';

export const getProxyBaseUrl = (): string => {
  return AXCHAT_PROTOCOL_ORIGIN;
};

export const buildProxyUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getProxyBaseUrl()}${normalizedPath}`;
};

export const buildDirectBridgeUrl = (targetUrl: string): string => {
  const url = new URL(targetUrl);
  const encodedTarget = encodeURIComponent(`${url.origin}${url.pathname}`);
  return `${buildProxyUrl(`${proxyConfig.PROXY_PATH_PREFIX}/bridge/direct/${encodedTarget}`)}${
    url.search
  }`;
};

export const getProxyAuthHeaders = (): Record<string, string> => {
  return {};
};

const isLocalProxyTarget = (target?: string): boolean => {
  if (!target) return false;
  try {
    const url = new URL(target);
    if (url.origin !== getProxyBaseUrl()) return false;
    return url.pathname.startsWith(proxyConfig.PROXY_PATH_PREFIX);
  } catch {
    return false;
  }
};

export const getProxyAuthHeadersForTarget = (target?: string): Record<string, string> => {
  if (!isLocalProxyTarget(target)) return {};
  return getProxyAuthHeaders();
};
