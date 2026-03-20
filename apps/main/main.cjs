/* global __dirname, setTimeout, console, process */
const { app, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { installConsoleStyle } = require('./consoleStyle.cjs');

installConsoleStyle('main');

const resolveMainModule = (name) => {
  const localPath = path.join(__dirname, `${name}.cjs`);
  if (fs.existsSync(localPath)) return localPath;
  return path.join(__dirname, 'apps', 'main', `${name}.cjs`);
};

const { createMainWindow, getMainWindow, registerWindowIpcHandlers, showWindow } = require(
  resolveMainModule('window')
);
const { createTray, destroyTray, setTrayLanguage, setTrayLabels } = require(
  resolveMainModule('tray')
);
const { startProxy, stopProxy, setAllowHttpTargets, installProxyAuthHeaderInjection } = require(
  resolveMainModule('proxy')
);
const { registerAppIpcHandlers } = require(resolveMainModule('ipc'));
const { ensureDatabase, closeDatabase, resetDatabaseFiles } = require(
  resolveMainModule('storage/db')
);
const {
  getOpenAICodexAuthSession,
  getOpenAICodexAuthStatus,
  loginOpenAICodexAuth,
  logoutOpenAICodexAuth,
} = require(resolveMainModule('openaiCodexAuth'));
const {
  getGeminiCliAuthSession,
  getGeminiCliAuthStatus,
  loginGeminiCliAuth,
  logoutGeminiCliAuth,
} = require(resolveMainModule('geminiCliAuth'));
const { initUpdater, checkForUpdates, openUpdateDownload, getUpdaterState } = require(
  resolveMainModule('updater')
);

const LEGACY_THEME_STATE_FILE = path.join(app.getPath('userData'), 'theme-state.json');

const removeFileIfPresent = (filePath) => {
  try {
    fs.rmSync(filePath, { force: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
};

const isDev = !app.isPackaged;
const APP_USER_MODEL_ID = 'com.orlinx.app';
const shouldPreventClose = () => !isQuitting && process.platform === 'win32';

let isQuitting = false;

const allowSecondInstance = isDev && process.env.Orlinx_ALLOW_SECOND_INSTANCE === '1';
if (!allowSecondInstance) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      showWindow();
    });
  }
}

app.on('before-quit', () => {
  isQuitting = true;
  destroyTray();
  stopProxy();
  closeDatabase();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (isQuitting || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (getMainWindow()) {
    showWindow();
  } else {
    void createMainWindow({
      isDev,
      shouldPreventClose,
    }).catch((error) => {
      console.error('Failed to recreate main window on activate:', error);
    });
  }
});

void app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  ensureDatabase();
  Menu.setApplicationMenu(null);
  registerAppIpcHandlers({
    registerWindowIpcHandlers,
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
    prepareForResetLocalData: async () => {
      stopProxy();
      closeDatabase();
      await new Promise((resolve) => setTimeout(resolve, 200));
    },
    clearPersistedLocalData: async () => {
      await logoutOpenAICodexAuth();
      await logoutGeminiCliAuth();
      resetDatabaseFiles();
      removeFileIfPresent(LEGACY_THEME_STATE_FILE);
    },
    recoverFromFailedLocalDataReset: async () => {
      ensureDatabase();
      await startProxy(isDev);
    },
  });
  void (async () => {
    try {
      await startProxy(isDev);
    } catch (error) {
      console.error('Failed to start network bridge:', error);
    }

    try {
      await createMainWindow({
        isDev,
        shouldPreventClose,
      });
    } catch (error) {
      console.error('Failed to create main window:', error);
    }

    installProxyAuthHeaderInjection();

    createTray({
      isDev,
      getMainWindow,
      showWindow,
      onQuit: () => {
        isQuitting = true;
      },
    });
    initUpdater({ getMainWindow });
  })();
  setTimeout(() => {
    void checkForUpdates();
  }, 15000);
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const window = getMainWindow();
    if (!window) return;
    if (window.webContents.isDevToolsOpened()) {
      window.webContents.closeDevTools();
    } else {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  });
});

