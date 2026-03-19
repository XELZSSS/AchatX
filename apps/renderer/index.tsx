import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
import './index.css';
import { installFetchBridge } from '@/infrastructure/network/fetchBridge';
import { getProxyBaseUrl } from '@/infrastructure/providers/proxy';
import { installConsoleStyle } from '@/shared/utils/consoleStyle';

const isProduction = typeof __APP_ENV__ !== 'undefined' && __APP_ENV__ === 'production';

const applyCsp = () => {
  if (!isProduction) return;
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) return;
  const proxyOrigin = getProxyBaseUrl();
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' axchat: ${proxyOrigin} ws://localhost:3000 https: http:`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  meta.setAttribute('content', directives.join('; '));
};

installConsoleStyle('renderer');
installFetchBridge();
applyCsp();

let hasNotifiedRendererReady = false;

const waitForAnimationFrames = async (count) => {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  }
};

const waitForInitialShell = async () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const shellReady = () =>
    !!document.querySelector('.app-shell') &&
    !!document.querySelector('.sidebar') &&
    !!document.querySelector('.chat-main') &&
    document.body.classList.contains('electron');

  if (shellReady()) {
    return;
  }

  await new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!shellReady()) {
        return;
      }
      observer.disconnect();
      resolve(undefined);
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    window.setTimeout(() => {
      observer.disconnect();
      resolve(undefined);
    }, 2500);
  });
};

const waitForInitialFontResources = async () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const fontSet = document.fonts;
  if (fontSet?.ready) {
    try {
      await fontSet.ready;
    } catch {
      // Ignore font readiness errors and rely on the window timeout fallback.
    }
  }
};

const waitForRendererReady = async () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  await waitForInitialShell();
  await waitForInitialFontResources();
  await waitForAnimationFrames(2);
  await waitForAnimationFrames(2);
  await new Promise((resolve) => {
    window.setTimeout(resolve, 120);
  });
};

const RendererReadyBridge = () => {
  useEffect(() => {
    let cancelled = false;

    const notifyWhenReady = async () => {
      if (hasNotifiedRendererReady) {
        return;
      }

      await waitForRendererReady();
      if (cancelled || hasNotifiedRendererReady) {
        return;
      }

      hasNotifiedRendererReady = true;
      window.axchat?.notifyRendererReady?.();
    };

    void notifyWhenReady();

    return () => {
      cancelled = true;
    };
  }, []);

  return <App />;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <RendererReadyBridge />
  </StrictMode>
);
