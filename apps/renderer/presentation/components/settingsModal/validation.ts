import { MAX_TOOL_CALL_ROUNDS, MIN_TOOL_CALL_ROUNDS } from '@/infrastructure/providers/utils';
import { t } from '@/shared/utils/i18n';
import { providerMeta } from '@/presentation/components/settingsModal/constants';
import type {
  ActiveSettingsTab,
  SettingsModalState,
} from '@/presentation/components/settingsModal/reducer';

export type SettingsValidationSeverity = 'error' | 'warning';

export type SettingsValidationField =
  | 'provider.baseUrl'
  | 'provider.embedding.outputDimensionality'
  | 'provider.embedding.title'
  | `provider.customHeaders.${number}`
  | 'search.apiKey'
  | 'search.searxngBaseUrl'
  | 'search.toolCallMaxRounds'
  | 'search.maxResults';

export type SettingsValidationIssue = {
  severity: SettingsValidationSeverity;
  tab: ActiveSettingsTab;
  field?: SettingsValidationField;
  message: string;
};

export type SettingsValidationResult = {
  issues: SettingsValidationIssue[];
  errors: SettingsValidationIssue[];
  warnings: SettingsValidationIssue[];
  issuesByTab: Record<ActiveSettingsTab, SettingsValidationIssue[]>;
  issuesByField: Record<string, SettingsValidationIssue[]>;
};

const createEmptyIssuesByTab = (): Record<ActiveSettingsTab, SettingsValidationIssue[]> => ({
  provider: [],
  appearance: [],
  agent: [],
  search: [],
  version: [],
  shortcuts: [],
});

const parseHttpUrl = (value: string): URL | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const baseOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const url =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? new URL(trimmed)
        : new URL(trimmed, baseOrigin);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

const pushIssue = (
  issuesByTab: Record<ActiveSettingsTab, SettingsValidationIssue[]>,
  issuesByField: Record<string, SettingsValidationIssue[]>,
  issue: SettingsValidationIssue
): void => {
  issuesByTab[issue.tab].push(issue);
  if (issue.field) {
    issuesByField[issue.field] = [...(issuesByField[issue.field] ?? []), issue];
  }
};

const validateProviderTab = (
  state: SettingsModalState,
  issuesByTab: Record<ActiveSettingsTab, SettingsValidationIssue[]>,
  issuesByField: Record<string, SettingsValidationIssue[]>
): void => {
  const activeProviderMeta = providerMeta[state.provider.providerId];

  if (activeProviderMeta?.supportsBaseUrl && state.provider.baseUrl?.trim()) {
    const parsedBaseUrl = parseHttpUrl(state.provider.baseUrl);

    if (!parsedBaseUrl) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'provider',
        field: 'provider.baseUrl',
        message: t('settings.validation.provider.baseUrl.invalid'),
      });
    } else if (
      state.provider.providerId === 'openai-compatible' &&
      parsedBaseUrl.protocol === 'http:' &&
      !state.app.allowHttpTargets
    ) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'warning',
        tab: 'provider',
        field: 'provider.baseUrl',
        message: t('settings.validation.provider.baseUrl.httpBlocked'),
      });
    }
  }

  if (state.provider.providerId === 'openai-compatible' && !state.provider.baseUrl?.trim()) {
    pushIssue(issuesByTab, issuesByField, {
      severity: 'warning',
      tab: 'provider',
      field: 'provider.baseUrl',
      message: t('settings.validation.provider.baseUrl.missingOpenAICompatible'),
    });
  }

  const duplicateHeaderRows = new Map<string, number[]>();
  const firstHeaderRowByKey = new Map<string, number>();

  state.provider.customHeaders.forEach((header, index) => {
    const key = header.key.trim();
    const value = header.value.trim();

    if ((key && !value) || (!key && value)) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'provider',
        field: `provider.customHeaders.${index}`,
        message: `${t('settings.validation.provider.customHeaders.incomplete')} #${index + 1}`,
      });
    }

    if (!key) {
      return;
    }

    const normalizedKey = key.toLowerCase();
    const firstRow = firstHeaderRowByKey.get(normalizedKey);
    if (firstRow === undefined) {
      firstHeaderRowByKey.set(normalizedKey, index);
      return;
    }

    const rows = duplicateHeaderRows.get(normalizedKey) ?? [firstRow];
    rows.push(index);
    duplicateHeaderRows.set(normalizedKey, rows);
  });

  duplicateHeaderRows.forEach((rows) => {
    const label = state.provider.customHeaders[rows[0]]?.key.trim();
    rows.forEach((rowIndex) => {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'provider',
        field: `provider.customHeaders.${rowIndex}`,
        message: `${t('settings.validation.provider.customHeaders.duplicate')} ${label}`,
      });
    });
  });

  if (
    activeProviderMeta?.supportsEmbedding &&
    state.provider.embedding.outputDimensionality !== undefined
  ) {
    const value = state.provider.embedding.outputDimensionality;

    if (!Number.isInteger(value) || value <= 0) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'provider',
        field: 'provider.embedding.outputDimensionality',
        message: t('settings.validation.provider.embedding.outputDimensionality.invalid'),
      });
    }
  }

  if (activeProviderMeta?.supportsEmbedding && state.provider.embedding.title?.trim()) {
    const taskType = state.provider.embedding.taskType ?? 'RETRIEVAL_DOCUMENT';
    if (taskType !== 'RETRIEVAL_DOCUMENT') {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'warning',
        tab: 'provider',
        field: 'provider.embedding.title',
        message: t('settings.validation.provider.embedding.titleIgnored'),
      });
    }
  }
};

const validateSearchTab = (
  state: SettingsModalState,
  issuesByTab: Record<ActiveSettingsTab, SettingsValidationIssue[]>,
  issuesByField: Record<string, SettingsValidationIssue[]>
): void => {
  const activeProviderMeta = providerMeta[state.provider.providerId];
  if (!activeProviderMeta?.supportsTavily) {
    return;
  }

  const toolCallRounds = state.app.toolCallMaxRounds.trim();
  if (toolCallRounds) {
    const parsed = Number.parseInt(toolCallRounds, 10);
    if (Number.isNaN(parsed) || parsed < MIN_TOOL_CALL_ROUNDS || parsed > MAX_TOOL_CALL_ROUNDS) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'search',
        field: 'search.toolCallMaxRounds',
        message: `${t('settings.validation.search.toolCallRounds.invalid')} ${MIN_TOOL_CALL_ROUNDS}-${MAX_TOOL_CALL_ROUNDS}`,
      });
    }
  }

  if (state.provider.tavily.maxResults !== undefined) {
    const maxResults = state.provider.tavily.maxResults;
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'search',
        field: 'search.maxResults',
        message: t('settings.validation.search.maxResults.invalid'),
      });
    }
  }

  const engine =
    state.provider.tavily.engine === 'exa' || state.provider.tavily.engine === 'searxng'
      ? state.provider.tavily.engine
      : 'tavily';

  if (engine === 'searxng') {
    if (!state.provider.tavily.searxngBaseUrl?.trim()) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'warning',
        tab: 'search',
        field: 'search.searxngBaseUrl',
        message: t('settings.validation.search.searxng.baseUrl.missing'),
      });
      return;
    }

    if (!parseHttpUrl(state.provider.tavily.searxngBaseUrl)) {
      pushIssue(issuesByTab, issuesByField, {
        severity: 'error',
        tab: 'search',
        field: 'search.searxngBaseUrl',
        message: t('settings.validation.search.searxng.baseUrl.invalid'),
      });
    }

    return;
  }

  if (!state.provider.tavily.apiKey?.trim()) {
    pushIssue(issuesByTab, issuesByField, {
      severity: 'warning',
      tab: 'search',
      field: 'search.apiKey',
      message:
        engine === 'exa'
          ? t('settings.validation.search.exa.apiKey.missing')
          : t('settings.validation.search.tavily.apiKey.missing'),
    });
  }
};

export const validateSettingsState = (state: SettingsModalState): SettingsValidationResult => {
  const issuesByTab = createEmptyIssuesByTab();
  const issuesByField: Record<string, SettingsValidationIssue[]> = {};

  validateProviderTab(state, issuesByTab, issuesByField);
  validateSearchTab(state, issuesByTab, issuesByField);

  const issues = Object.values(issuesByTab).flat();
  return {
    issues,
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    issuesByTab,
    issuesByField,
  };
};
