/* global __dirname, process, setTimeout, console */
const { app, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { parseExternalHttpUrl, shouldOpenExternalUrl } = require('../../shared/external-url.cjs');
const { getDistributionMode } = require('../distribution.cjs');
const {
  readAppStorageValue,
  writeAppStorageValue,
  removeAppStorageValue,
} = require('../storage/appStorage.cjs');

const clearBrowserData = async () => {
  const { session } = require('electron');
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData();
  return { ok: true };
};

const scheduleAppRestartAction = (action) => {
  setTimeout(() => {
    if (action === 'relaunch') {
      app.relaunch();
    }
    app.exit(0);
  }, 600);
};

const resolveOrlinxLocalConfigPath = () => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'orlinx.local.json');
  }

  return path.resolve(__dirname, '..', '..', '..', 'orlinx.local.json');
};

const getConfigTransferDefaultPath = () => {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(app.getPath('documents'), `orlinx-settings-${date}.json`);
};

const runLocalDataReset = async ({
  prepareForResetLocalData,
  clearPersistedLocalData,
  recoverFromFailedLocalDataReset,
}) => {
  const action = getDistributionMode() === 'portable' ? 'exit' : 'relaunch';
  if (typeof prepareForResetLocalData === 'function') {
    await prepareForResetLocalData();
  }

  try {
    if (typeof clearPersistedLocalData === 'function') {
      await clearPersistedLocalData();
    }

    const result = await clearBrowserData();
    scheduleAppRestartAction(action);
    return {
      ...result,
      action,
      relaunching: action === 'relaunch',
    };
  } catch (error) {
    if (typeof recoverFromFailedLocalDataReset === 'function') {
      try {
        await recoverFromFailedLocalDataReset();
      } catch (recoveryError) {
        console.error('Failed to recover after local data reset error:', recoveryError);
      }
    }

    throw error;
  }
};

const buildSystemHandlers = ({
  setTrayLanguage,
  setTrayLabels,
  checkForUpdates,
  openUpdateDownload,
  getUpdaterState,
  setAllowHttpTargets,
  getOpenAICodexAuthSession,
  getOpenAICodexAuthStatus,
  loginOpenAICodexAuth,
  logoutOpenAICodexAuth,
  getGeminiCliAuthSession,
  getGeminiCliAuthStatus,
  loginGeminiCliAuth,
  logoutGeminiCliAuth,
  prepareForResetLocalData,
  clearPersistedLocalData,
  recoverFromFailedLocalDataReset,
}) => ({
  'storage:app:read-sync': (_event, key) => {
    return readAppStorageValue(key);
  },
  'storage:app:read': async (_event, key) => {
    return readAppStorageValue(key);
  },
  'storage:app:write': async (_event, payload) => {
    const record = payload && typeof payload === 'object' ? payload : {};
    writeAppStorageValue(record.key, record.value);
  },
  'storage:app:remove': async (_event, key) => {
    removeAppStorageValue(key);
  },
  'tray:set-language': (_event, language) => {
    setTrayLanguage(language);
  },
  'tray:set-labels': (_event, labels) => {
    setTrayLabels(labels);
  },
  'updater:check': async () => {
    await checkForUpdates();
  },
  'updater:open-download': () => {
    openUpdateDownload();
  },
  'updater:get-status': () => {
    return getUpdaterState();
  },
  'app:open-external': async (_event, url) => {
    const target = String(url ?? '').trim();
    if (!target) return;
    if (!shouldOpenExternalUrl(target, !app.isPackaged, process.env.VITE_DEV_SERVER_URL)) {
      throw new Error(
        'Blocked external URL: only http/https URLs outside the app origin are allowed'
      );
    }

    const parsed = parseExternalHttpUrl(target);
    await shell.openExternal(parsed.toString());
  },
  'app:open-local-config': async () => {
    const configPath = resolveOrlinxLocalConfigPath();
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, '{\n}\n', 'utf8');
    }
    await shell.openPath(configPath);
  },
  'proxy:set-allow-http-targets': (_event, enabled) => {
    return setAllowHttpTargets(enabled);
  },
  'auth:openai-codex:get-status': async () => {
    return getOpenAICodexAuthStatus();
  },
  'auth:openai-codex:get-session': async () => {
    return getOpenAICodexAuthSession();
  },
  'auth:openai-codex:login': async () => {
    return loginOpenAICodexAuth();
  },
  'auth:openai-codex:logout': async () => {
    return logoutOpenAICodexAuth();
  },
  'auth:gemini-cli:get-status': async () => {
    return getGeminiCliAuthStatus();
  },
  'auth:gemini-cli:get-session': async () => {
    return getGeminiCliAuthSession();
  },
  'auth:gemini-cli:login': async () => {
    return loginGeminiCliAuth();
  },
  'auth:gemini-cli:logout': async () => {
    return logoutGeminiCliAuth();
  },
  'app:clear-cache': async () => {
    return clearBrowserData();
  },
  'app:reset-local-data': async () => {
    return runLocalDataReset({
      prepareForResetLocalData,
      clearPersistedLocalData,
      recoverFromFailedLocalDataReset,
    });
  },
  'settings:transfer:export': async (_event, payload) => {
    const record = payload && typeof payload === 'object' ? payload : {};
    const defaultPath =
      typeof record.defaultPath === 'string' && record.defaultPath.trim()
        ? record.defaultPath.trim()
        : getConfigTransferDefaultPath();
    const contents = typeof record.contents === 'string' ? record.contents : '';
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'Orlinx Settings', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(result.filePath, contents, 'utf8');
    return {
      canceled: false,
      filePath: result.filePath,
      fileName: path.basename(result.filePath),
    };
  },
  'settings:transfer:import': async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: app.getPath('documents'),
      properties: ['openFile'],
      filters: [{ name: 'Orlinx Settings', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      contents: fs.readFileSync(filePath, 'utf8'),
    };
  },
});

module.exports = {
  buildSystemHandlers,
};

