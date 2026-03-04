import type { UpdaterStatus } from '../services/updaterClient';

export {};

declare global {
  interface Window {
    gero?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      getAppVersion: () => Promise<string>;
      setTheme: (theme: 'dark' | 'light') => Promise<void>;
      checkForUpdates: () => Promise<void>;
      quitAndInstallUpdate: () => Promise<void>;
      getUpdaterStatus: () => Promise<UpdaterStatus>;
      onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
      setProxyStaticHttp2: (enabled: boolean) => Promise<{
        changed: boolean;
        enabled: boolean;
      }>;
      getProxyToken: () => string | undefined;
      getProxyPort: () => string;
      getProxyHost: () => string;
      onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void;
      setTrayLanguage: (language: 'en' | 'zh-CN') => Promise<void>;
      setTrayLabels: (labels: {
        open: string;
        hide: string;
        toggleDevTools: string;
        quit: string;
      }) => Promise<void>;
      notifyBootstrapReady: () => void;
    };
  }
}
