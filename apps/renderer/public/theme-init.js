/* global document, window */
(function () {
  var DEFAULT_THEME = 'dark';
  var DEFAULT_THEME_PREFERENCE = 'system';
  var APP_SETTINGS_KEY = 'axchat_app_settings';
  var THEME_KEY = 'axchat_theme';
  var DARK_BG = '#0a0a0a';
  var LIGHT_BG = '#ffffff';
  var isTheme = function (theme) {
    return theme === 'light' || theme === 'dark';
  };
  var getSystemTheme = function () {
    if (!window.matchMedia) return DEFAULT_THEME;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  var resolveTheme = function (theme) {
    if (theme === 'system') return getSystemTheme();
    return isTheme(theme) ? theme : DEFAULT_THEME;
  };
  var parseThemePreferenceFromSettings = function (raw) {
    if (typeof raw !== 'string' || !raw) return null;

    try {
      var parsed = JSON.parse(raw);
      var themePreference = parsed && parsed.themePreference;
      return themePreference === 'system' || isTheme(themePreference) ? themePreference : null;
    } catch {
      return null;
    }
  };

  var applyTheme = function (theme) {
    var resolved = resolveTheme(theme);
    var background = resolved === 'light' ? LIGHT_BG : DARK_BG;
    var root = document.documentElement;

    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    root.style.backgroundColor = background;
  };

  try {
    var readNativeValue =
      window.axchat && typeof window.axchat.readStoredAppValue === 'function'
        ? function (key) {
            try {
              return window.axchat.readStoredAppValue(key);
            } catch {
              return null;
            }
          }
        : function () {
            return null;
          };
    var storage = window.localStorage;
    var theme = parseThemePreferenceFromSettings(storage.getItem(APP_SETTINGS_KEY));

    if (!theme) {
      var nativeAppSettings = readNativeValue('appSettings');
      theme = parseThemePreferenceFromSettings(nativeAppSettings);
      if (theme && nativeAppSettings) {
        storage.setItem(APP_SETTINGS_KEY, nativeAppSettings);
      }
    }

    if (!theme) {
      theme = storage.getItem(THEME_KEY);
      if (theme !== 'system' && !isTheme(theme)) {
        theme = readNativeValue('theme');
        if (theme === 'system' || isTheme(theme)) {
          storage.setItem(THEME_KEY, theme);
        }
      }
    }

    applyTheme(theme || DEFAULT_THEME_PREFERENCE);
  } catch {
    applyTheme(DEFAULT_THEME);
  }
})();
