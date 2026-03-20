/* global Buffer, URLSearchParams, clearTimeout, fetch, setTimeout */
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
const { LOGIN_TIMEOUT_MS, TOKEN_URL, USER_INFO_URL } = require('./constants.cjs');
const {
  requireGeminiCliOAuthConfig,
  getConfiguredRedirectPort,
  createRedirectUri,
} = require('./config.cjs');

const base64Url = (buffer) => Buffer.from(buffer).toString('base64url');

const createPkce = () => {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

const createState = () => crypto.randomBytes(32).toString('hex');

const createCallbackHtml = (title, message) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; background: #0f172a; color: #e2e8f0; margin: 0; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 440px; border: 1px solid #334155; background: #111827; border-radius: 16px; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0; line-height: 1.6; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${title}</h1>
        <p>${message}</p>
      </section>
    </main>
  </body>
</html>`;

const waitForAuthorizationCode = ({ expectedState, timeoutMs = LOGIN_TIMEOUT_MS }) =>
  new Promise((resolve, reject) => {
    let redirectUri = '';
    let callbackSettled = false;
    let started = false;
    let timeout = null;
    let configuredPort = 0;

    let resolveCode;
    let rejectCode;
    const codePromise = new Promise((innerResolve, innerReject) => {
      resolveCode = innerResolve;
      rejectCode = innerReject;
    });

    const finishCallback = (callback) => {
      if (callbackSettled) return;
      callbackSettled = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      callback();
    };

    const server = http.createServer((request, response) => {
      const parsed = new URL(request.url ?? '/', redirectUri || 'http://127.0.0.1');
      if (parsed.pathname !== '/oauth2callback') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not Found');
        return;
      }

      const code = parsed.searchParams.get('code');
      const state = parsed.searchParams.get('state');
      const error = parsed.searchParams.get('error');

      if (error) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          createCallbackHtml('Orlinx login failed', 'The Google OAuth flow returned an error.')
        );
        finishCallback(() => {
          server.close();
          rejectCode(new Error(`Gemini OAuth error: ${error}`));
        });
        return;
      }

      if (!code || state !== expectedState) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          createCallbackHtml(
            'Orlinx login failed',
            'The OAuth callback could not be verified. Start the sign-in flow again.'
          )
        );
        finishCallback(() => {
          server.close();
          rejectCode(new Error('Invalid Gemini OAuth callback state.'));
        });
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        createCallbackHtml(
          'Orlinx login complete',
          'You can close this browser tab and return to Orlinx.'
        )
      );
      finishCallback(() => {
        server.close();
        resolveCode({ code });
      });
    });

    server.once('error', (error) => {
      const failure =
        error?.code === 'EADDRINUSE'
          ? new Error(`Gemini OAuth callback port ${configuredPort} is already in use.`)
          : error;

      if (!started) {
        reject(failure);
        return;
      }

      finishCallback(() => {
        server.close();
        rejectCode(failure);
      });
    });

    configuredPort = getConfiguredRedirectPort();
    server.listen(configuredPort, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to determine Gemini OAuth callback port.'));
        return;
      }

      redirectUri = createRedirectUri(address.port);
      started = true;
      timeout = setTimeout(() => {
        finishCallback(() => {
          server.close();
          rejectCode(new Error('Timed out waiting for the Gemini OAuth callback.'));
        });
      }, timeoutMs);

      resolve({ redirectUri, codePromise });
    });
  });

const fetchUserInfo = async (accessToken) => {
  const response = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return {};
  }
  return response.json().catch(() => ({}));
};

const exchangeAuthorizationCode = async (code, verifier, redirectUri) => {
  const { clientId, clientSecret } = requireGeminiCliOAuthConfig();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini OAuth request failed (${response.status}): ${text || 'unknown error'}`);
  }

  const payload = await response.json();
  const accessToken = String(payload?.access_token ?? '').trim();
  const refreshToken = String(payload?.refresh_token ?? '').trim();
  const expiresIn = Number(payload?.expires_in ?? 0);
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Gemini OAuth response is missing required fields.');
  }

  const userInfo = await fetchUserInfo(accessToken);
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    email: typeof userInfo?.email === 'string' ? userInfo.email.trim() || undefined : undefined,
  };
};

const refreshAccessToken = async (session, clearSession) => {
  const { clientId, clientSecret } = requireGeminiCliOAuthConfig();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 400 && String(text).includes('invalid_grant')) {
      clearSession();
      return null;
    }
    throw new Error(`Gemini token refresh failed (${response.status}): ${text || 'unknown error'}`);
  }

  const payload = await response.json();
  const accessToken = String(payload?.access_token ?? '').trim();
  const expiresIn = Number(payload?.expires_in ?? 0);
  const refreshToken = String(payload?.refresh_token ?? '').trim() || session.refreshToken;
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Gemini refresh response is missing required fields.');
  }

  return {
    ...session,
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
};

module.exports = {
  createPkce,
  createState,
  waitForAuthorizationCode,
  exchangeAuthorizationCode,
  refreshAccessToken,
};

