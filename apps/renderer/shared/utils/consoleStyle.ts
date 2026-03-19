const INSTALL_MARK = '__axchat_console_style_installed__';
const DEFAULT_SCOPE = 'renderer';

const BADGE_STYLE =
  'background:#1e1e1e;color:#ededed;padding:2px 8px;border-radius:999px;font-weight:700;';
const SCOPE_STYLE = 'color:#8f8f8f;font-weight:600;';
const BODY_STYLE = 'color:inherit;';

const LEVEL_THEME = {
  log: { label: 'LOG', color: '#9dbefe' },
  info: { label: 'INFO', color: '#edb2f1' },
  warn: { label: 'WARN', color: '#fcd53a' },
  error: { label: 'ERROR', color: '#fc533a' },
  debug: { label: 'DEBUG', color: '#fab283' },
} as const;

type ConsoleMethod = keyof typeof LEVEL_THEME;
type ConsoleWithInstallMark = Console & { [INSTALL_MARK]?: boolean };

const normalizeScope = (scope: string): string => {
  const normalized = scope.trim();
  return normalized.length > 0 ? normalized : DEFAULT_SCOPE;
};

const buildPrefix = (method: ConsoleMethod, scope: string) => {
  const theme = LEVEL_THEME[method] ?? LEVEL_THEME.log;
  const normalizedScope = normalizeScope(scope);

  return [
    `%c AXCHAT %c ${normalizedScope} %c ${theme.label} %c`,
    BADGE_STYLE,
    SCOPE_STYLE,
    `color:${theme.color};font-weight:700;`,
    BODY_STYLE,
  ] as const;
};

const wrapConsoleMethod = (target: Console, method: ConsoleMethod, scope: string) => {
  const fallback = typeof target.log === 'function' ? target.log.bind(target) : () => undefined;
  const original = typeof target[method] === 'function' ? target[method].bind(target) : fallback;

  target[method] = (...args: unknown[]) => {
    const [template, badgeStyle, scopeStyle, levelStyle, bodyStyle] = buildPrefix(method, scope);

    if (args.length === 0) {
      original(template, badgeStyle, scopeStyle, levelStyle, bodyStyle);
      return;
    }

    if (typeof args[0] === 'string') {
      original(
        `${template}${args[0]}`,
        badgeStyle,
        scopeStyle,
        levelStyle,
        bodyStyle,
        ...args.slice(1)
      );
      return;
    }

    original(template, badgeStyle, scopeStyle, levelStyle, bodyStyle, ...args);
  };
};

export const installConsoleStyle = (scope = DEFAULT_SCOPE): void => {
  if (typeof window === 'undefined') return;

  const target = window.console as ConsoleWithInstallMark;
  if (target[INSTALL_MARK]) return;

  Object.defineProperty(target, INSTALL_MARK, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    wrapConsoleMethod(target, method, scope);
  }
};
