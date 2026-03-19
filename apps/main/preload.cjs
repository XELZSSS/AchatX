/* global console, process, Buffer */
const { contextBridge, ipcRenderer } = require('electron');

const PRELOAD_CONSOLE_INSTALL_MARK = '__axchat_preload_console_style_installed__';
const PRELOAD_BADGE_STYLE =
  'background:#1f2937;color:#f8fafc;padding:2px 8px;border-radius:999px;font-weight:700;';
const PRELOAD_SCOPE_STYLE = 'color:#94a3b8;font-weight:600;';
const PRELOAD_BODY_STYLE = 'color:inherit;';
const PRELOAD_LEVEL_THEME = {
  log: { label: 'LOG', color: '#7dd3fc' },
  info: { label: 'INFO', color: '#60a5fa' },
  warn: { label: 'WARN', color: '#fbbf24' },
  error: { label: 'ERROR', color: '#f87171' },
  debug: { label: 'DEBUG', color: '#c084fc' },
};

const installPreloadConsoleStyle = () => {
  const target = console;
  if (target[PRELOAD_CONSOLE_INSTALL_MARK]) return;

  Object.defineProperty(target, PRELOAD_CONSOLE_INSTALL_MARK, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    const fallback = typeof target.log === 'function' ? target.log.bind(target) : () => {};
    const original = typeof target[method] === 'function' ? target[method].bind(target) : fallback;
    const theme = PRELOAD_LEVEL_THEME[method] ?? PRELOAD_LEVEL_THEME.log;

    target[method] = (...args) => {
      const template = `%c AXCHAT %c preload %c ${theme.label} %c`;

      if (args.length === 0) {
        original(
          template,
          PRELOAD_BADGE_STYLE,
          PRELOAD_SCOPE_STYLE,
          `color:${theme.color};font-weight:700;`,
          PRELOAD_BODY_STYLE
        );
        return;
      }

      if (typeof args[0] === 'string') {
        original(
          `${template}${args[0]}`,
          PRELOAD_BADGE_STYLE,
          PRELOAD_SCOPE_STYLE,
          `color:${theme.color};font-weight:700;`,
          PRELOAD_BODY_STYLE,
          ...args.slice(1)
        );
        return;
      }

      original(
        template,
        PRELOAD_BADGE_STYLE,
        PRELOAD_SCOPE_STYLE,
        `color:${theme.color};font-weight:700;`,
        PRELOAD_BODY_STYLE,
        ...args
      );
    };
  }
};

installPreloadConsoleStyle();

const APP_STORAGE_BOOTSTRAP_PREFIX = '--axchat-app-storage-bootstrap=';

const toPrimitiveString = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  return undefined;
};

const appStorageCache = new Map();

const hydrateAppStorageCache = () => {
  try {
    const bootstrapArg = process.argv.find(
      (entry) => typeof entry === 'string' && entry.startsWith(APP_STORAGE_BOOTSTRAP_PREFIX)
    );
    if (!bootstrapArg) {
      return;
    }

    const encodedPayload = bootstrapArg.slice(APP_STORAGE_BOOTSTRAP_PREFIX.length).trim();
    if (!encodedPayload) {
      return;
    }

    const snapshot = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(snapshot)) {
      const normalizedValue = toPrimitiveString(value);
      if (normalizedValue === undefined) {
        continue;
      }
      appStorageCache.set(key, normalizedValue);
    }
  } catch {
    // Ignore bootstrap storage failures so the renderer can still start.
  }
};

hydrateAppStorageCache();

const readStoredAppValue = (key) => {
  const normalizedKey = toPrimitiveString(key) ?? '';
  return appStorageCache.has(normalizedKey) ? appStorageCache.get(normalizedKey) : null;
};

const writeStoredAppValue = (key, value) => {
  const normalizedKey = toPrimitiveString(key) ?? '';
  const normalizedValue = toPrimitiveString(value) ?? '';
  const hadPreviousValue = appStorageCache.has(normalizedKey);
  const previousValue = hadPreviousValue ? appStorageCache.get(normalizedKey) : null;

  appStorageCache.set(normalizedKey, normalizedValue);
  void ipcRenderer
    .invoke('storage:app:write', {
      key: normalizedKey,
      value: normalizedValue,
    })
    .catch((error) => {
      if (hadPreviousValue) {
        appStorageCache.set(normalizedKey, previousValue);
      } else {
        appStorageCache.delete(normalizedKey);
      }
      console.error(`Failed to persist app storage key "${normalizedKey}":`, error);
    });
};

const removeStoredAppValue = (key) => {
  const normalizedKey = String(key ?? '');
  const hadPreviousValue = appStorageCache.has(normalizedKey);
  const previousValue = hadPreviousValue ? appStorageCache.get(normalizedKey) : null;

  appStorageCache.delete(normalizedKey);
  void ipcRenderer.invoke('storage:app:remove', normalizedKey).catch((error) => {
    if (hadPreviousValue) {
      appStorageCache.set(normalizedKey, previousValue);
    }
    console.error(`Failed to remove app storage key "${normalizedKey}":`, error);
  });
};

const resetStoredAppCache = () => {
  appStorageCache.clear();
};

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

const subscribe = (channel, mapPayload = (...args) => args[0]) => (callback) => {
  const handler = (_event, ...args) => callback(mapPayload(...args));
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

contextBridge.exposeInMainWorld('axchat', {
  readStoredAppValue,
  writeStoredAppValue,
  removeStoredAppValue,
  minimize: invoke('window:minimize'),
  toggleMaximize: invoke('window:toggle-maximize'),
  close: invoke('window:close'),
  isMaximized: invoke('window:is-maximized'),
  getAppVersion: invoke('window:get-app-version'),
  getSystemLanguage: invoke('window:get-system-language'),
  getSystemTheme: invoke('window:get-system-theme'),
  setTheme: invoke('window:set-theme'),
  checkForUpdates: invoke('updater:check'),
  openUpdateDownload: invoke('updater:open-download'),
  getUpdaterStatus: invoke('updater:get-status'),
  getOpenAICodexAuthStatus: invoke('auth:openai-codex:get-status'),
  getOpenAICodexAuthSession: invoke('auth:openai-codex:get-session'),
  loginOpenAICodexAuth: invoke('auth:openai-codex:login'),
  logoutOpenAICodexAuth: invoke('auth:openai-codex:logout'),
  getGeminiCliAuthStatus: invoke('auth:gemini-cli:get-status'),
  getGeminiCliAuthSession: invoke('auth:gemini-cli:get-session'),
  loginGeminiCliAuth: invoke('auth:gemini-cli:login'),
  logoutGeminiCliAuth: invoke('auth:gemini-cli:logout'),
  openExternal: invoke('app:open-external'),
  openAxchatLocalConfig: invoke('app:open-local-config'),
  setProxyAllowHttpTargets: invoke('proxy:set-allow-http-targets'),
  listStoredSessions: invoke('storage:sessions:list'),
  getStoredSession: invoke('storage:sessions:get'),
  getStoredActiveSessionId: invoke('storage:sessions:get-active-id'),
  setStoredActiveSessionId: invoke('storage:sessions:set-active-id'),
  clearStoredActiveSessionId: invoke('storage:sessions:clear-active-id'),
  saveStoredSession: invoke('storage:sessions:save'),
  renameStoredSession: invoke('storage:sessions:rename'),
  deleteStoredSession: invoke('storage:sessions:delete'),
  searchStoredSessions: invoke('storage:sessions:search'),
  onMaximizeChanged: (callback) => {
    const onMax = () => callback(true);
    const onUnmax = () => callback(false);
    ipcRenderer.on('window:maximize', onMax);
    ipcRenderer.on('window:unmaximize', onUnmax);
    return () => {
      ipcRenderer.removeListener('window:maximize', onMax);
      ipcRenderer.removeListener('window:unmaximize', onUnmax);
    };
  },
  onSystemThemeChanged: subscribe('window:system-theme-changed', () => undefined),
  onSystemLanguageChanged: subscribe('window:system-language-changed', () => undefined),
  onUpdaterStatus: subscribe('updater:status'),
  setTrayLanguage: invoke('tray:set-language'),
  setTrayLabels: invoke('tray:set-labels'),
  clearCache: invoke('app:clear-cache'),
  resetLocalData: async () => {
    const result = await invoke('app:reset-local-data')();
    resetStoredAppCache();
    return result;
  },
  exportSettingsTransfer: invoke('settings:transfer:export'),
  importSettingsTransfer: invoke('settings:transfer:import'),
  notifyRendererReady: () => ipcRenderer.send('app:renderer-ready'),
});
