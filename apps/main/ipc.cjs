const { ipcMain, shell } = require('electron');

const registerIpcHandlers = (handlers) => {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }
};

const registerAppIpcHandlers = ({
  registerWindowIpcHandlers,
  setTrayLanguage,
  setTrayLabels,
  checkForUpdates,
  quitAndInstall,
  getUpdaterState,
  setStaticProxyHttp2Enabled,
}) => {
  registerWindowIpcHandlers();
  registerIpcHandlers({
    'tray:set-language': (_event, language) => {
      setTrayLanguage(language);
    },
    'tray:set-labels': (_event, labels) => {
      setTrayLabels(labels);
    },
    'updater:check': async () => {
      await checkForUpdates();
    },
    'updater:quit-and-install': () => {
      quitAndInstall();
    },
    'updater:get-status': () => {
      return getUpdaterState();
    },
    'app:open-external': async (_event, url) => {
      const target = String(url ?? '').trim();
      if (!target) return;
      await shell.openExternal(target);
    },
    'proxy:set-static-http2': (_event, enabled) => {
      return setStaticProxyHttp2Enabled(enabled);
    },
  });
};

module.exports = {
  registerAppIpcHandlers,
};
