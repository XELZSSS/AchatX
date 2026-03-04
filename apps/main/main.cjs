/* global __dirname, setTimeout, setImmediate, console */
const { app, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const resolveMainModule = (name) => {
  const localPath = path.join(__dirname, `${name}.cjs`);
  if (fs.existsSync(localPath)) return localPath;
  return path.join(__dirname, 'apps', 'main', `${name}.cjs`);
};

const { createMainWindow, getMainWindow, registerWindowIpcHandlers, showWindow } = require(
  resolveMainModule('window')
);
const { createTray, setTrayLanguage, setTrayLabels } = require(resolveMainModule('tray'));
const { startProxy, stopProxy, setStaticProxyHttp2Enabled } = require(resolveMainModule('proxy'));
const { registerAppIpcHandlers } = require(resolveMainModule('ipc'));
const { initUpdater, checkForUpdates, quitAndInstall, getUpdaterState } = require(
  resolveMainModule('updater')
);

const isDev = !app.isPackaged;
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  stopProxy();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('activate', () => {
  if (getMainWindow()) {
    showWindow();
  } else {
    void createMainWindow({ isDev, shouldPreventClose: () => !isQuitting }).catch((error) => {
      console.error('Failed to recreate main window on activate:', error);
    });
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerAppIpcHandlers({
    registerWindowIpcHandlers,
    setTrayLanguage,
    setTrayLabels,
    checkForUpdates,
    quitAndInstall,
    getUpdaterState,
    setStaticProxyHttp2Enabled,
  });
  void createMainWindow({ isDev, shouldPreventClose: () => !isQuitting }).catch((error) => {
    console.error('Failed to create main window:', error);
  });
  setImmediate(() => {
    startProxy(isDev);
    createTray({
      isDev,
      getMainWindow,
      showWindow,
      onQuit: () => {
        isQuitting = true;
      },
    });
    initUpdater({ getMainWindow });
  });
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
