/* global URL */
const DEV_SERVER_FALLBACK_URL = 'http://localhost:3000';

const parseExternalHttpUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const shouldOpenExternalUrl = (url, isDev, devServerUrl) => {
  const parsed = parseExternalHttpUrl(url);
  if (!parsed) return false;

  if (isDev) {
    const fallback = devServerUrl ?? DEV_SERVER_FALLBACK_URL;
    const devOrigin = new URL(fallback).origin;
    return parsed.origin !== devOrigin;
  }

  return true;
};

module.exports = {
  parseExternalHttpUrl,
  shouldOpenExternalUrl,
};
