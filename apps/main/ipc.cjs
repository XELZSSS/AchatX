const { ipcMain } = require('electron');
const { buildSystemHandlers } = require('./ipc/systemHandlers.cjs');
const { buildSessionHandlers } = require('./ipc/sessionHandlers.cjs');

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

  registerIpcHandlers(
    buildSystemHandlers({
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
    })
  );

  registerIpcHandlers(buildSessionHandlers());
};

module.exports = {
  registerAppIpcHandlers,
};
