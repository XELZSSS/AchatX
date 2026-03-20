const { ipcMain } = require('electron');
const { buildSystemHandlers } = require('./ipc/systemHandlers.cjs');
const { buildSessionHandlers } = require('./ipc/sessionHandlers.cjs');

const registerSyncIpcHandlers = (handlers) => {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.on(channel, (event, ...args) => {
      event.returnValue = handler(event, ...args);
    });
  }
};

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
}) => {
  registerWindowIpcHandlers();

  const systemHandlers = buildSystemHandlers({
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
  });

  registerSyncIpcHandlers({
    'storage:app:read-sync': systemHandlers['storage:app:read-sync'],
  });

  registerIpcHandlers(
    Object.fromEntries(
      Object.entries(systemHandlers).filter(([channel]) => channel !== 'storage:app:read-sync')
    )
  );

  registerIpcHandlers(buildSessionHandlers());
};

module.exports = {
  registerAppIpcHandlers,
};
