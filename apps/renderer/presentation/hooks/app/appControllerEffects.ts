import { useEffect, useRef } from 'react';
import { t, applyLanguageToDocument, type Language } from '@/shared/utils/i18n';
import {
  applyThemeToDocument,
  refreshSystemTheme,
  type AccentPreference,
  type Theme,
  type ThemePreference,
} from '@/shared/utils/theme';
import {
  refreshSystemLanguage,
  syncExternalSystemLanguage,
  type LanguagePreference,
} from '@/shared/utils/i18n';
import { getUpdaterStatus, subscribeUpdaterStatus } from '@/infrastructure/updater/updaterClient';
import type { UpdaterStatus } from '@/infrastructure/updater/updaterClient';
import { writeAppStorage } from '@/infrastructure/persistence/storageKeys';

export const useElectronBodyClass = () => {
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.orlinx;
    document.body.classList.toggle('electron', isElectron);
  }, []);
};

export const useDocumentAppearance = (
  language: Language,
  theme: Theme,
  accentPreference: AccentPreference
) => {
  useEffect(() => {
    applyLanguageToDocument();
    document.title = t('app.title');
  }, [language]);

  useEffect(() => {
    applyThemeToDocument();
  }, [accentPreference, theme]);
};

export const useUpdaterDownloadPrompt = () => {
  const hasPromptedAvailableUpdateRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.orlinx) return;

    const resetPromptFlagIfNeeded = (status: UpdaterStatus['status']) => {
      if (status !== 'available') {
        hasPromptedAvailableUpdateRef.current = false;
      }
    };

    const promptDownloadIfNeeded = (status: UpdaterStatus) => {
      resetPromptFlagIfNeeded(status.status);
      if (
        status.distribution !== 'portable' ||
        status.status !== 'available' ||
        hasPromptedAvailableUpdateRef.current
      ) {
        return;
      }

      hasPromptedAvailableUpdateRef.current = true;
      const shouldOpenDownload = window.confirm(t('settings.update.prompt.downloadNow'));
      if (shouldOpenDownload) {
        void window.orlinx?.openUpdateDownload?.();
      }
    };

    void getUpdaterStatus().then((status) => {
      if (status) {
        promptDownloadIfNeeded(status);
      }
    });

    const unsubscribe = subscribeUpdaterStatus((status) => {
      promptDownloadIfNeeded(status);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);
};

export const useAppMetadataSync = ({
  setAppVersion,
  setUpdaterStatus,
}: {
  setAppVersion: (version: string) => void;
  setUpdaterStatus: (status: UpdaterStatus) => void;
}) => {
  useEffect(() => {
    let active = true;

    const syncUpdaterStatus = (status: UpdaterStatus) => {
      if (!active) return;
      setUpdaterStatus(status);
      writeAppStorage('updaterStatus', JSON.stringify(status));
    };

    void getUpdaterStatus().then((status) => {
      syncUpdaterStatus(status);
    });

    void (async () => {
      const version = await window.orlinx?.getAppVersion?.();
      if (!active || !version) return;
      setAppVersion(version);
      writeAppStorage('appVersion', version);
    })();

    const unsubscribe = subscribeUpdaterStatus((status) => {
      syncUpdaterStatus(status);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [setAppVersion, setUpdaterStatus]);
};

export const useTrayLanguageSync = (
  language: Language,
  syncTrayLabels: (language: Language) => void
) => {
  useEffect(() => {
    syncTrayLabels(language);
  }, [language, syncTrayLabels]);
};

export const useSystemLanguageSync = ({
  languagePreference,
  setLanguage,
  syncTrayLabels,
}: {
  languagePreference: LanguagePreference;
  setLanguage: (language: Language) => void;
  syncTrayLabels: (language: Language) => void;
}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSystemLanguage = async () => {
      if (languagePreference !== 'system') {
        return;
      }

      let nextLanguage: Language | null = null;
      try {
        const systemLanguage = await window.orlinx?.getSystemLanguage?.();
        nextLanguage = syncExternalSystemLanguage(systemLanguage);
      } catch (error) {
        console.error('Failed to read system language from Electron:', error);
      }

      nextLanguage = nextLanguage ?? refreshSystemLanguage();
      if (!nextLanguage) return;
      setLanguage(nextLanguage);
      syncTrayLabels(nextLanguage);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void syncSystemLanguage();
    };

    const handleSystemLanguageChanged = () => {
      void syncSystemLanguage();
    };

    void syncSystemLanguage();

    window.addEventListener('languagechange', handleSystemLanguageChanged);
    window.addEventListener('focus', handleSystemLanguageChanged);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const removeNativeLanguageListener = window.orlinx?.onSystemLanguageChanged?.(
      handleSystemLanguageChanged
    );

    return () => {
      removeNativeLanguageListener?.();
      window.removeEventListener('languagechange', handleSystemLanguageChanged);
      window.removeEventListener('focus', handleSystemLanguageChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [languagePreference, setLanguage, syncTrayLabels]);
};

export const useSystemThemeSync = ({
  themePreference,
  setTheme,
}: {
  themePreference: ThemePreference;
  setTheme: (theme: Theme) => void;
}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (themePreference !== 'system') {
      return;
    }

    const syncSystemTheme = () => {
      const nextTheme = refreshSystemTheme();
      if (!nextTheme) return;
      setTheme(nextTheme);
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const removeNativeThemeListener = window.orlinx?.onSystemThemeChanged?.(syncSystemTheme);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncSystemTheme);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(syncSystemTheme);
    }

    window.addEventListener('focus', syncSystemTheme);
    return () => {
      removeNativeThemeListener?.();
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', syncSystemTheme);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(syncSystemTheme);
      }
      window.removeEventListener('focus', syncSystemTheme);
    };
  }, [setTheme, themePreference]);
};

