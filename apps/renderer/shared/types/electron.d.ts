import type { UpdaterStatus } from '@/infrastructure/updater/updaterClient';
import type {
  OpenAICodexAuthSession,
  OpenAICodexAuthStatus,
} from '@/infrastructure/auth/openAICodexAuth';
import type {
  GeminiCliAuthSession,
  GeminiCliAuthStatus,
} from '@/infrastructure/auth/geminiCliAuth';
import type { ChatSession } from '@/shared/types/chat';

export {};

declare global {
  interface Window {
    orlinx?: {
      readStoredAppValue: (key: string) => string | null;
      writeStoredAppValue: (key: string, value: string) => void;
      removeStoredAppValue: (key: string) => void;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      getAppVersion: () => Promise<string>;
      getSystemLanguage: () => Promise<string>;
      getSystemTheme: () => Promise<'dark' | 'light'>;
      setTheme: (theme: 'system' | 'dark' | 'light') => Promise<void>;
      checkForUpdates: () => Promise<void>;
      openUpdateDownload: () => Promise<void>;
      getUpdaterStatus: () => Promise<UpdaterStatus>;
      onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void;
      getOpenAICodexAuthStatus: () => Promise<OpenAICodexAuthStatus>;
      getOpenAICodexAuthSession: () => Promise<OpenAICodexAuthSession | null>;
      loginOpenAICodexAuth: () => Promise<OpenAICodexAuthStatus>;
      logoutOpenAICodexAuth: () => Promise<OpenAICodexAuthStatus>;
      getGeminiCliAuthStatus: () => Promise<GeminiCliAuthStatus>;
      getGeminiCliAuthSession: () => Promise<GeminiCliAuthSession | null>;
      loginGeminiCliAuth: () => Promise<GeminiCliAuthStatus>;
      logoutGeminiCliAuth: () => Promise<GeminiCliAuthStatus>;
      openExternal: (url: string) => Promise<void>;
      openOrlinxLocalConfig: () => Promise<void>;
      setProxyAllowHttpTargets: (enabled: boolean) => Promise<{
        changed: boolean;
        enabled: boolean;
      }>;
      listStoredSessions: (payload?: { limit?: number }) => Promise<ChatSession[]>;
      getStoredSession: (sessionId: string) => Promise<ChatSession | null>;
      getStoredActiveSessionId: () => Promise<string | null>;
      setStoredActiveSessionId: (sessionId: string) => Promise<void>;
      clearStoredActiveSessionId: () => Promise<void>;
      saveStoredSession: (session: ChatSession) => Promise<void>;
      renameStoredSession: (payload: { sessionId: string; title: string }) => Promise<void>;
      deleteStoredSession: (sessionId: string) => Promise<void>;
      searchStoredSessions: (payload: { query: string; limit?: number }) => Promise<ChatSession[]>;
      onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void;
      onSystemLanguageChanged: (callback: () => void) => () => void;
      onSystemThemeChanged: (callback: () => void) => () => void;
      setTrayLanguage: (language: 'en' | 'zh-CN') => Promise<void>;
      setTrayLabels: (labels: {
        open: string;
        hide: string;
        toggleDevTools: string;
        quit: string;
      }) => Promise<void>;
      clearCache: () => Promise<{ ok: boolean; relaunching?: boolean }>;
      resetLocalData: () => Promise<{ ok: boolean; relaunching?: boolean; action?: 'exit' | 'relaunch' }>;
      exportSettingsTransfer: (payload: {
        contents: string;
        defaultPath?: string;
      }) => Promise<{ canceled: boolean; filePath?: string; fileName?: string }>;
      importSettingsTransfer: () => Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
        contents?: string;
      }>;
      notifyRendererReady: () => void;
    };
  }
}

