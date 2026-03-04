/* global process */
const { app } = require('electron');
const { getProxyScriptPath, loadProxyConfig, loadProxyState, persistProxyState } = require('./proxy/config.cjs');
const { startProxyProcess, stopProxyProcess } = require('./proxy/process-manager.cjs');

const { DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT, resolveProxyHost, resolveProxyPort } =
  loadProxyConfig();
let isDevMode = false;
let proxyState = loadProxyState(app);

const startProxy = (isDev) => {
  isDevMode = isDev;
  const scriptPath = getProxyScriptPath(app, isDev);
  process.env.ACHATX_PROXY_STATIC_HTTP2 = proxyState.staticHttp2Enabled ? '1' : '0';
  startProxyProcess({
    scriptPath,
    isDev,
    resolveProxyPort,
    resolveProxyHost,
    staticProxyHttp2Enabled: proxyState.staticHttp2Enabled,
    defaults: {
      DEFAULT_PROXY_HOST,
      DEFAULT_PROXY_PORT,
    },
  });
};

const stopProxy = () => {
  void stopProxyProcess();
};

const setStaticProxyHttp2Enabled = async (enabled) => {
  const nextEnabled = enabled === true;
  if (proxyState.staticHttp2Enabled === nextEnabled) {
    return { changed: false, enabled: nextEnabled };
  }

  proxyState = { ...proxyState, staticHttp2Enabled: nextEnabled };
  persistProxyState(app, proxyState);
  process.env.ACHATX_PROXY_STATIC_HTTP2 = nextEnabled ? '1' : '0';

  await stopProxyProcess();
  startProxy(isDevMode);
  return { changed: true, enabled: nextEnabled };
};

module.exports = {
  startProxy,
  stopProxy,
  setStaticProxyHttp2Enabled,
};
