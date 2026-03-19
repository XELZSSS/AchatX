/* global process */
const fs = require('fs');
const path = require('path');

const loadProxyConfig = () => {
  try {
    return require('../../shared/proxy-routes.cjs');
  } catch {
    const fallback = path.join(process.resourcesPath, 'shared', 'proxy-routes.cjs');
    return require(fallback);
  }
};

const PROXY_STATE_FILE_NAME = 'proxy-state.json';

const getProxyStatePath = (app) => path.join(app.getPath('userData'), PROXY_STATE_FILE_NAME);

const loadProxyState = (app) => {
  const fallback = { allowHttpTargets: false };
  try {
    const raw = fs.readFileSync(getProxyStatePath(app), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      allowHttpTargets: parsed?.allowHttpTargets === true,
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
  loadProxyState,
  persistProxyState,
};
