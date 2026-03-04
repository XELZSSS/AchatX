/* global process */
const fs = require('fs');
const path = require('path');

const loadProxyConfig = () => {
  try {
    return require('../../shared/proxy-config.cjs');
  } catch {
    const fallback = path.join(process.resourcesPath, 'shared', 'proxy-config.cjs');
    return require(fallback);
  }
};

const getProxyScriptPath = (app, isDev) => {
  if (isDev) {
    return path.join(app.getAppPath(), 'apps', 'server', 'llm-proxy.mjs');
  }
  return path.join(process.resourcesPath, 'server', 'llm-proxy.mjs');
};

const PROXY_STATE_FILE_NAME = 'proxy-state.json';

const getProxyStatePath = (app) => path.join(app.getPath('userData'), PROXY_STATE_FILE_NAME);

const loadProxyState = (app) => {
  const fallback = { staticHttp2Enabled: false };
  try {
    const raw = fs.readFileSync(getProxyStatePath(app), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      staticHttp2Enabled: parsed?.staticHttp2Enabled === true,
    };
  } catch {
    return fallback;
  }
};

const persistProxyState = (app, state) => {
  try {
    fs.writeFileSync(getProxyStatePath(app), JSON.stringify(state));
  } catch {
    // ignore persistence failures
  }
};

module.exports = {
  loadProxyConfig,
  getProxyScriptPath,
  loadProxyState,
  persistProxyState,
};
