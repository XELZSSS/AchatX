/* global process */
const path = require('path');
const { readAppStorageValue, writeAppStorageValue } = require('../storage/appStorage.cjs');

const loadProxyConfig = () => {
  try {
    return require('../../shared/proxy-routes.cjs');
  } catch {
    const fallback = path.join(process.resourcesPath, 'shared', 'proxy-routes.cjs');
    return require(fallback);
  }
};

const APP_SETTINGS_STORAGE_KEY = 'appSettings';

const loadProxyState = () => {
  try {
    const raw = readAppStorageValue(APP_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { allowHttpTargets: false };
    }

    const parsed = JSON.parse(raw);
    return {
      allowHttpTargets: parsed?.allowHttpTargets === true,
    };
  } catch {
    return { allowHttpTargets: false };
  }
};

const persistProxyState = (state) => {
  try {
    const raw = readAppStorageValue(APP_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const nextSettings =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    nextSettings.allowHttpTargets = state?.allowHttpTargets === true;
    writeAppStorageValue(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  } catch {
    // ignore persistence failures
  }
};

module.exports = {
  loadProxyConfig,
  loadProxyState,
  persistProxyState,
};
