const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let trayLanguage = 'en';
let trayLabels = null;
let isDev = false;
let getMainWindow = null;
let showWindow = null;
let onQuit = null;

const getTrayIcon = () => {
  const root = app.getAppPath();
  const icoPath = path.join(root, 'assets', 'icons', 'app.ico');
  const pngPath = path.join(root, 'assets', 'icons', 'app.png');
  if (fs.existsSync(icoPath)) return nativeImage.createFromPath(icoPath);
  if (fs.existsSync(pngPath)) return nativeImage.createFromPath(pngPath);
  return nativeImage.createEmpty();
};

const TRAY_LABELS = {
  'zh-CN': {
    open: '打开',
    hide: '隐藏',
    toggleDevTools: '切换开发者工具',
    quit: '退出',
  },
  en: {
    open: 'Open',
    hide: 'Hide',
    toggleDevTools: 'Toggle DevTools',
    quit: 'Quit',
  },
};

const getTrayLabels = (language) => TRAY_LABELS[language] ?? TRAY_LABELS.en;

const resolveActiveTrayLabels = () => trayLabels ?? getTrayLabels(trayLanguage);

const getWindow = () => getMainWindow?.();

const showMainWindow = () => {
  showWindow?.();
};

const hideMainWindow = () => {
  getWindow()?.hide();
};

const toggleWindowDevTools = () => {
  const window = getWindow();
  if (!isDev || !window) return;
  if (window.webContents.isDevToolsOpened()) {
    window.webContents.closeDevTools();
  } else {
    window.webContents.openDevTools({ mode: 'detach' });
  }
};

const toggleMainWindowVisibility = () => {
  const window = getWindow();
  if (!window) return;
  if (window.isVisible()) {
    window.hide();
  } else {
    showMainWindow();
  }
};

const buildTrayMenu = () => {
  const labels = resolveActiveTrayLabels();
  return Menu.buildFromTemplate([
    { label: labels.open, click: showMainWindow },
    { label: labels.hide, click: hideMainWindow },
    {
      label: labels.toggleDevTools,
      enabled: isDev,
      click: toggleWindowDevTools,
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        onQuit?.();
        app.quit();
      },
    },
  ]);
};

const updateTrayMenu = () => {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
};

const createTray = (options) => {
  if (tray) return;
  isDev = Boolean(options?.isDev);
  getMainWindow = options?.getMainWindow ?? null;
  showWindow = options?.showWindow ?? null;
  onQuit = options?.onQuit ?? null;
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Orlinx');
  updateTrayMenu();
  tray.on('click', toggleMainWindowVisibility);
};

const setTrayLanguage = (language) => {
  trayLanguage = language === 'zh-CN' ? 'zh-CN' : 'en';
  trayLabels = null;
  updateTrayMenu();
};

const setTrayLabels = (labels) => {
  trayLabels = labels && typeof labels === 'object' ? labels : null;
  updateTrayMenu();
};

const destroyTray = () => {
  if (!tray) return;
  tray.removeAllListeners();
  tray.destroy();
  tray = null;
  getMainWindow = null;
  showWindow = null;
  onQuit = null;
};

module.exports = {
  createTray,
  destroyTray,
  setTrayLanguage,
  setTrayLabels,
  updateTrayMenu,
};

