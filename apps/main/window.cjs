/* global setTimeout, clearTimeout, setInterval, process */
const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { listAppStorageValues, readAppStorageValue } = require('./storage/appStorage.cjs');
const { shouldOpenExternalUrl } = require('../shared/external-url.cjs');
const {
  DEFAULT_THEME_PREFERENCE,
  MIN_WINDOW_SIZE,
  WINDOW_SHOW_TIMEOUT_MS,
  encodeAppStorageBootstrap,
  getSystemLanguage,
  getSystemTheme,
  getWindowBackgroundColor,
  getWindowIcon,
  isThemePreference,
  loadThemeState,
  loadWindowState,
  persistJsonFile,
} = require('./windowHelpers.cjs');

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

let mainWindow = null;
let saveTimer = null;
let currentTheme = 'dark';
let currentThemePreference = DEFAULT_THEME_PREFERENCE;
let systemLanguageMonitor = null;
let lastSystemLanguage = null;

const isLiveWindow = (win) => Boolean(win && !win.isDestroyed());

const setWindowBackground = (win, theme) => {
  if (!isLiveWindow(win)) return;
  win.setBackgroundColor(getWindowBackgroundColor(theme));
};

const applyWindowTheme = (theme) => {
  const preference = isThemePreference(theme) ? theme : DEFAULT_THEME_PREFERENCE;
  const resolved = preference === 'system' ? getSystemTheme(nativeTheme) : preference;
  currentThemePreference = preference;
  currentTheme = resolved;
  nativeTheme.themeSource = preference;
  setWindowBackground(mainWindow, resolved);
  return { preference, resolved };
};

const scheduleWindowStateSave = (win) => {
  if (!win) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (!win || win.isDestroyed()) return;
      const bounds = win.getBounds();
      const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized(),
      };
      persistJsonFile(fs, WINDOW_STATE_FILE, state);
    } catch {
      // ignore destroyed window or persistence errors
    }
  }, 250);
};

const showWindow = (win = mainWindow) => {
  if (!isLiveWindow(win)) return;
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
};

const getMainWindow = () => mainWindow;

const emitWindowStateEvent = (channel) => {
  if (!isLiveWindow(mainWindow)) return;
  mainWindow.webContents.send(channel);
};

const emitSystemThemeChanged = () => {
  if (currentThemePreference === 'system') {
    currentTheme = getSystemTheme(nativeTheme);
    setWindowBackground(mainWindow, currentTheme);
  }
  emitWindowStateEvent('window:system-theme-changed');
};

const emitSystemLanguageChanged = () => {
  emitWindowStateEvent('window:system-language-changed');
};

const startSystemLanguageMonitor = () => {
  if (systemLanguageMonitor) {
    return;
  }

  lastSystemLanguage = getSystemLanguage(app);
  systemLanguageMonitor = setInterval(() => {
    const nextLanguage = getSystemLanguage(app);
    if (nextLanguage === lastSystemLanguage) {
      return;
    }

    lastSystemLanguage = nextLanguage;
    emitSystemLanguageChanged();
  }, 1500);
};

const withMainWindow =
  (handler, fallback) =>
  (_event, ...args) => {
    if (!mainWindow) return fallback;
    return handler(mainWindow, ...args);
  };

const loadWindowContent = async (win, isDev) => {
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:3000';
    try {
      await win.loadURL(devUrl);
    } catch {
      setTimeout(() => win?.loadURL(devUrl), 500);
    }
    return;
  }

  await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
};

const registerExternalNavigationGuards = (win, isDev) => {
  // Route all external window.open requests to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternalUrl(url, isDev, process.env.VITE_DEV_SERVER_URL)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Keep the app shell locked and route external navigations out of process.
  win.webContents.on('will-navigate', (event, url) => {
    if (!shouldOpenExternalUrl(url, isDev, process.env.VITE_DEV_SERVER_URL)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
};

const createMainWindow = async ({ isDev, shouldPreventClose }) => {
  const [state, theme] = await Promise.all([
    loadWindowState({ fs, windowStateFile: WINDOW_STATE_FILE }),
    Promise.resolve(loadThemeState({ readAppStorageValue })),
  ]);
  const { resolved: initialTheme } = applyWindowTheme(theme);

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    x: state.x,
    y: state.y,
    show: false,
    backgroundColor: getWindowBackgroundColor(initialTheme),
    transparent: false,
    autoHideMenuBar: true,
    frame: false,
    icon: getWindowIcon(app, process.platform),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(app.getAppPath(), 'apps', 'main', 'preload.cjs'),
      additionalArguments: [
        `--axchat-app-storage-bootstrap=${encodeAppStorageBootstrap(listAppStorageValues)}`,
      ],
    },
  });
  mainWindow.setIcon(getWindowIcon(app, process.platform));
  mainWindow.setBackgroundColor(getWindowBackgroundColor(initialTheme));
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();
  registerExternalNavigationGuards(mainWindow, isDev);

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  let hasShownWindow = false;

  const showMainWindowOnce = () => {
    if (!isLiveWindow(mainWindow) || hasShownWindow) return;
    hasShownWindow = true;
    showWindow();
  };

  const onRendererReady = (event) => {
    if (!isLiveWindow(mainWindow)) return;
    if (event.sender !== mainWindow.webContents) return;
    showMainWindowOnce();
  };

  const showTimeout = setTimeout(
    () => {
      if (!isLiveWindow(mainWindow) || hasShownWindow) return;
      showMainWindowOnce();
    },
    isDev ? WINDOW_SHOW_TIMEOUT_MS.dev : WINDOW_SHOW_TIMEOUT_MS.prod
  );

  ipcMain.on('app:renderer-ready', onRendererReady);

  mainWindow.on('close', (event) => {
    if (shouldPreventClose?.()) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    scheduleWindowStateSave(mainWindow);
  });
  mainWindow.on('closed', () => {
    clearTimeout(showTimeout);
    ipcMain.removeListener('app:renderer-ready', onRendererReady);
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    mainWindow = null;
  });

  const handleBoundsChanged = () => scheduleWindowStateSave(mainWindow);
  const handleResize = () => {
    scheduleWindowStateSave(mainWindow);
    setWindowBackground(mainWindow, currentTheme);
  };
  mainWindow.on('resize', handleResize);
  mainWindow.on('move', handleBoundsChanged);

  mainWindow.on('maximize', () => emitWindowStateEvent('window:maximize'));
  mainWindow.on('unmaximize', () => emitWindowStateEvent('window:unmaximize'));

  await loadWindowContent(mainWindow, isDev);
};

const registerWindowIpcHandlers = () => {
  startSystemLanguageMonitor();
  nativeTheme.removeListener('updated', emitSystemThemeChanged);
  nativeTheme.on('updated', emitSystemThemeChanged);
  ipcMain.handle(
    'window:minimize',
    withMainWindow((win) => {
      win.minimize();
    })
  );
  ipcMain.handle(
    'window:toggle-maximize',
    withMainWindow((win) => {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    })
  );
  ipcMain.handle(
    'window:close',
    withMainWindow((win) => {
      win.hide();
    })
  );
  ipcMain.handle(
    'window:is-maximized',
    withMainWindow((win) => win.isMaximized(), false)
  );
  ipcMain.handle('window:get-app-version', () => app.getVersion());
  ipcMain.handle('window:get-system-language', () => getSystemLanguage(app));
  ipcMain.handle('window:get-system-theme', () => getSystemTheme(nativeTheme));
  ipcMain.handle('window:set-theme', (_event, theme) => {
    applyWindowTheme(theme);
  });
};

module.exports = {
  createMainWindow,
  getMainWindow,
  registerWindowIpcHandlers,
  showWindow,
};
