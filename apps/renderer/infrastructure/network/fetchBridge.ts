import { buildDirectBridgeUrl, getProxyBaseUrl } from '@/infrastructure/providers/proxy';

const isHttpLikeUrl = (url: URL): boolean => {
  return url.protocol === 'http:' || url.protocol === 'https:';
};

const isBridgeUrl = (url: URL): boolean => {
  return url.origin === getProxyBaseUrl();
};

const resolveUrl = (input: string | URL): URL => {
  return input instanceof URL ? input : new URL(input, window.location.href);
};

const shouldRewriteUrl = (url: URL): boolean => {
  if (!isHttpLikeUrl(url)) return false;
  if (url.origin === window.location.origin) return false;
  if (isBridgeUrl(url)) return false;
  return true;
};

const rewriteRequestInput = (input: RequestInfo | URL): RequestInfo | URL => {
  if (typeof input === 'string' || input instanceof URL) {
    const url = resolveUrl(input);
    return shouldRewriteUrl(url) ? buildDirectBridgeUrl(url.toString()) : input;
  }

  const url = resolveUrl(input.url);
  if (!shouldRewriteUrl(url)) {
    return input;
  }

  return new Request(buildDirectBridgeUrl(url.toString()), input);
};

export const installFetchBridge = (): void => {
  if (typeof window === 'undefined') return;
  if ((window as Window & { __axchatFetchBridgeInstalled?: boolean }).__axchatFetchBridgeInstalled) {
    return;
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    return originalFetch(rewriteRequestInput(input), init);
  };

  (window as Window & { __axchatFetchBridgeInstalled?: boolean }).__axchatFetchBridgeInstalled =
    true;
};
