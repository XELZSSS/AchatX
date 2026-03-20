/* global Buffer, URLSearchParams, clearTimeout, fetch, setTimeout */
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
const {
  AUTHORIZE_URL,
  CLIENT_ID,
  JWT_CLAIM_PATH,
  LOGIN_TIMEOUT_MS,
  REDIRECT_PATH,
  REDIRECT_PORT,
  REDIRECT_URI,
  SCOPE,
  TOKEN_URL,
} = require('./constants.cjs');

const base64Url = (buffer) => Buffer.from(buffer).toString('base64url');

const createPkce = () => {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

const createState = () => crypto.randomBytes(16).toString('hex');

const decodeJwt = (token) => {
  try {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const extractAccountId = (accessToken) => {
  const decoded = decodeJwt(accessToken);
  const accountId = decoded?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
  const normalized = typeof accountId === 'string' ? accountId.trim() : '';
  return normalized || null;
};

const buildAuthorizeUrl = ({ challenge, state }) => {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  url.searchParams.set('originator', 'codex_cli_rs');
  return url.toString();
};

const parseTokenResponse = async (response) => {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI OAuth request failed (${response.status}): ${text || 'unknown error'}`);
  }

  const payload = await response.json();
  const accessToken = String(payload?.access_token ?? '').trim();
  const refreshToken = String(payload?.refresh_token ?? '').trim();
  const expiresIn = Number(payload?.expires_in ?? 0);
  const accountId = extractAccountId(accessToken);

  if (
    !accessToken ||
    !refreshToken ||
    !accountId ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error('OpenAI OAuth response is missing required fields.');
  }

  return {
    accessToken,
    refreshToken,
    accountId,
    expiresAt: Date.now() + expiresIn * 1000,
  };
};

const exchangeAuthorizationCode = async (code, verifier) => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
    }),
  });

  return parseTokenResponse(response);
};

const refreshAccessToken = async (refreshToken) => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  return parseTokenResponse(response);
};

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
    let settled = false;
    let timeout = null;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      callback();
    };

    const server = http.createServer((request, response) => {
      const parsed = new URL(request.url ?? '/', REDIRECT_URI);
      if (parsed.pathname !== REDIRECT_PATH) {
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
          createCallbackHtml(
            'Orlinx login failed',
            'The OAuth flow returned an error. You can close this tab.'
          )
        );
        finish(() => {
          server.close();
          reject(new Error(`OpenAI OAuth error: ${error}`));
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
        finish(() => {
          server.close();
          reject(new Error('Invalid OpenAI OAuth callback state.'));
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
      finish(() => {
        server.close();
        resolve({ code });
      });
    });

    server.once('error', (error) => {
      finish(() => {
        reject(
          error?.code === 'EADDRINUSE'
            ? new Error(`OpenAI OAuth callback port ${REDIRECT_PORT} is already in use.`)
            : error
        );
      });
    });

    server.listen(REDIRECT_PORT, '127.0.0.1');

    timeout = setTimeout(() => {
      finish(() => {
        server.close();
        reject(new Error('Timed out waiting for the OpenAI OAuth callback.'));
      });
    }, timeoutMs);
  });

module.exports = {
  buildAuthorizeUrl,
  createPkce,
  createState,
  exchangeAuthorizationCode,
  refreshAccessToken,
  waitForAuthorizationCode,
};

