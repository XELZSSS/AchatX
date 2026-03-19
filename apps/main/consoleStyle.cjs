/* global console, process, window */
const INSTALL_MARK = Symbol.for('axchat.console.style.installed');
const DEFAULT_SCOPE = 'app';

const RESET = '\x1b[0m';
const DIM = '\x1b[90m';
const BADGE_BG = '\x1b[48;5;236m';
const BADGE_FG = '\x1b[38;5;255m';
const BROWSER_BADGE_STYLE =
  'background:#1f2937;color:#f8fafc;padding:2px 8px;border-radius:999px;font-weight:700;';
const BROWSER_SCOPE_STYLE = 'color:#94a3b8;font-weight:600;';
const BROWSER_BODY_STYLE = 'color:inherit;';

const LEVEL_THEME = {
  log: { symbol: '•', accent: '\x1b[38;5;110m', label: 'LOG', browserColor: '#7dd3fc' },
  info: { symbol: 'ℹ', accent: '\x1b[38;5;81m', label: 'INFO', browserColor: '#60a5fa' },
  warn: { symbol: '▲', accent: '\x1b[38;5;221m', label: 'WARN', browserColor: '#fbbf24' },
  error: { symbol: '✕', accent: '\x1b[38;5;203m', label: 'ERROR', browserColor: '#f87171' },
  debug: { symbol: '◦', accent: '\x1b[38;5;141m', label: 'DEBUG', browserColor: '#c084fc' },
};

const isBrowserConsole = () => {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
};

const isInteractiveTerminal = () => {
  return Boolean(
    (process.stdout && process.stdout.isTTY) || (process.stderr && process.stderr.isTTY)
  );
};

const normalizeScope = (scope) => {
  if (typeof scope !== 'string') return DEFAULT_SCOPE;
  const normalized = scope.trim();
  return normalized.length > 0 ? normalized : DEFAULT_SCOPE;
};

const buildPlainPrefix = (level, scope) => {
  const normalizedScope = normalizeScope(scope);
  const theme = LEVEL_THEME[level] ?? LEVEL_THEME.log;
  return `[AXCHAT/${normalizedScope}/${theme.label}]`;
};

const buildAnsiPrefix = (level, scope) => {
  const normalizedScope = normalizeScope(scope);
  const theme = LEVEL_THEME[level] ?? LEVEL_THEME.log;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return `${DIM}${time}${RESET} ${theme.accent}${theme.symbol}${RESET} ${BADGE_BG}${BADGE_FG} AXCHAT ${RESET} ${DIM}${normalizedScope}${RESET}`;
};

const buildBrowserPrefix = (level, scope) => {
  const normalizedScope = normalizeScope(scope);
  const theme = LEVEL_THEME[level] ?? LEVEL_THEME.log;
  return [
    `%c AXCHAT %c ${normalizedScope} %c ${theme.label} %c`,
    BROWSER_BADGE_STYLE,
    BROWSER_SCOPE_STYLE,
    `color:${theme.browserColor};font-weight:700;`,
    BROWSER_BODY_STYLE,
  ];
};

const wrapConsoleMethod = (target, method, scope) => {
  const fallback = typeof target.log === 'function' ? target.log.bind(target) : () => {};
  const original = typeof target[method] === 'function' ? target[method].bind(target) : fallback;

  target[method] = (...args) => {
    if (isBrowserConsole()) {
      const [template, badgeStyle, scopeStyle, levelStyle, bodyStyle] = buildBrowserPrefix(
        method,
        scope
      );

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
      return;
    }

    const prefix = isInteractiveTerminal()
      ? buildAnsiPrefix(method, scope)
      : buildPlainPrefix(method, scope);

    if (args.length === 0) {
      original(prefix);
      return;
    }

    if (typeof args[0] === 'string') {
      original(`${prefix} ${args[0]}`, ...args.slice(1));
      return;
    }

    original(prefix, ...args);
  };
};

const installConsoleStyle = (scope = DEFAULT_SCOPE) => {
  const target = console;
  if (target[INSTALL_MARK]) return;

  Object.defineProperty(target, INSTALL_MARK, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    wrapConsoleMethod(target, method, scope);
  }
};

module.exports = {
  installConsoleStyle,
};
