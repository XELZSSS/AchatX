import { ProviderId } from '@/shared/types/chat';
import type { AppSettings } from '@/infrastructure/persistence/appSettingsStore';
import { normalizeAppSettings } from '@/infrastructure/persistence/appSettingsStore';
import type { ProviderSettings } from '@/infrastructure/providers/defaults';
import { buildDefaultProviderSettings } from '@/infrastructure/providers/defaults';
import { listProviderIds } from '@/infrastructure/providers/registry';
import {
  normalizePartialProviderSettingsRecord,
  normalizeProviderSettingsRecord,
} from '@/infrastructure/persistence/providerSettingsStore';
import { MAX_TOOL_CALL_ROUNDS, MIN_TOOL_CALL_ROUNDS } from '@/infrastructure/providers/utils';
import { t } from '@/shared/utils/i18n';

export const SETTINGS_TRANSFER_SCHEMA = 'orlinx-settings';
export const SETTINGS_TRANSFER_VERSION = 2;

export type SettingsImportMode = 'merge' | 'replace';

export type ResolvedAppSettingsSnapshot = AppSettings;

type PartialAppSettingsSnapshot = Partial<ResolvedAppSettingsSnapshot>;

type SettingsTransferFile = {
  schema: typeof SETTINGS_TRANSFER_SCHEMA;
  version: typeof SETTINGS_TRANSFER_VERSION;
  exportedAt: string;
  includesSecrets: boolean;
  appSettings: PartialAppSettingsSnapshot;
  providerSettings: Partial<Record<ProviderId, Partial<ProviderSettings>>>;
};

export type SettingsImportPreview = {
  fileName: string;
  exportedAt: string;
  includesSecrets: boolean;
  providerIds: ProviderId[];
  providerCount: number;
  appSettings: PartialAppSettingsSnapshot;
};

export type ParsedSettingsImport = {
  preview: SettingsImportPreview;
  includesSecrets: boolean;
  appSettings: PartialAppSettingsSnapshot;
  providerSettings: Partial<Record<ProviderId, ProviderSettings>>;
};

export type AppliedSettingsImport = {
  appSettings: ResolvedAppSettingsSnapshot;
  providerSettings: Record<ProviderId, ProviderSettings>;
};

const isProviderId = (value: unknown): value is ProviderId => {
  return typeof value === 'string' && listProviderIds().includes(value as ProviderId);
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  return undefined;
};

const normalizeToolCallMaxRounds = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return String(Math.min(Math.max(parsed, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS));
};

const toSerializableProviderSettings = (
  settings: ProviderSettings,
  includeSecrets: boolean
): Partial<ProviderSettings> => {
  if (includeSecrets) {
    return settings;
  }

  const next: Partial<ProviderSettings> = {
    ...settings,
    apiKey: undefined,
    customHeaders: undefined,
    tavily: settings.tavily
      ? {
          ...settings.tavily,
          apiKey: undefined,
        }
      : settings.tavily,
  };

  return next;
};

export const buildResolvedAppSettingsSnapshot = (
  current: PartialAppSettingsSnapshot
): ResolvedAppSettingsSnapshot => {
  return normalizeAppSettings(current);
};

export const createSettingsExportContent = ({
  appSettings,
  providerSettings,
  includeSecrets,
}: {
  appSettings: ResolvedAppSettingsSnapshot;
  providerSettings: Record<ProviderId, ProviderSettings>;
  includeSecrets: boolean;
}): string => {
  const nextProviderSettings = {} as Partial<Record<ProviderId, Partial<ProviderSettings>>>;

  for (const providerId of listProviderIds()) {
    nextProviderSettings[providerId] = toSerializableProviderSettings(
      providerSettings[providerId],
      includeSecrets
    );
  }

  const payload: SettingsTransferFile = {
    schema: SETTINGS_TRANSFER_SCHEMA,
    version: SETTINGS_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    includesSecrets: includeSecrets,
    appSettings,
    providerSettings: nextProviderSettings,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

const normalizeImportedAppSettings = (value: unknown): PartialAppSettingsSnapshot => {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const next: PartialAppSettingsSnapshot = {};

  if (isProviderId(raw.defaultProviderId)) {
    next.defaultProviderId = raw.defaultProviderId;
  }
  if (
    raw.languagePreference === 'system' ||
    raw.languagePreference === 'en' ||
    raw.languagePreference === 'zh-CN'
  ) {
    next.languagePreference = raw.languagePreference;
  }
  if (
    raw.themePreference === 'system' ||
    raw.themePreference === 'light' ||
    raw.themePreference === 'dark'
  ) {
    next.themePreference = raw.themePreference;
  }
  if (
    raw.accentPreference === 'neutral' ||
    raw.accentPreference === 'blue' ||
    raw.accentPreference === 'sky' ||
    raw.accentPreference === 'cyan' ||
    raw.accentPreference === 'teal' ||
    raw.accentPreference === 'green' ||
    raw.accentPreference === 'lime' ||
    raw.accentPreference === 'amber' ||
    raw.accentPreference === 'orange' ||
    raw.accentPreference === 'rose' ||
    raw.accentPreference === 'red' ||
    raw.accentPreference === 'violet'
  ) {
    next.accentPreference = raw.accentPreference;
  }

  const allowHttpTargets = normalizeBoolean(raw.allowHttpTargets);
  if (allowHttpTargets !== undefined) {
    next.allowHttpTargets = allowHttpTargets;
  }

  const toolCallMaxRounds = normalizeToolCallMaxRounds(raw.toolCallMaxRounds);
  if (toolCallMaxRounds !== undefined) {
    next.toolCallMaxRounds = toolCallMaxRounds;
  }

  return next;
};

const parseTransferFile = (contents: string): SettingsTransferFile => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(t('settings.transfer.import.error.invalidJson'));
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('settings.transfer.import.error.invalidSchema'));
  }

  const file = parsed as Partial<SettingsTransferFile>;
  if (file.schema !== SETTINGS_TRANSFER_SCHEMA) {
    throw new Error(t('settings.transfer.import.error.invalidSchema'));
  }

  if (file.version !== SETTINGS_TRANSFER_VERSION) {
    throw new Error(t('settings.transfer.import.error.unsupportedVersion'));
  }

  return {
    schema: SETTINGS_TRANSFER_SCHEMA,
    version: file.version,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : new Date(0).toISOString(),
    includesSecrets: file.includesSecrets === true,
    appSettings: normalizeImportedAppSettings(file.appSettings),
    providerSettings:
      file.providerSettings &&
      typeof file.providerSettings === 'object' &&
      !Array.isArray(file.providerSettings)
        ? file.providerSettings
        : {},
  };
};

export const parseSettingsImport = ({
  fileName,
  contents,
}: {
  fileName: string;
  contents: string;
}): ParsedSettingsImport => {
  const file = parseTransferFile(contents);
  const providerSettings = normalizePartialProviderSettingsRecord(file.providerSettings);
  const providerIds = Object.keys(providerSettings) as ProviderId[];

  return {
    preview: {
      fileName,
      exportedAt: file.exportedAt,
      includesSecrets: file.includesSecrets,
      providerIds,
      providerCount: providerIds.length,
      appSettings: file.appSettings,
    },
    includesSecrets: file.includesSecrets,
    appSettings: file.appSettings,
    providerSettings,
  };
};

export const applyParsedSettingsImport = ({
  mode,
  imported,
  currentAppSettings,
  currentProviderSettings,
}: {
  mode: SettingsImportMode;
  imported: ParsedSettingsImport;
  currentAppSettings: ResolvedAppSettingsSnapshot;
  currentProviderSettings: Record<ProviderId, ProviderSettings>;
}): AppliedSettingsImport => {
  const appSettings = buildResolvedAppSettingsSnapshot({
    ...currentAppSettings,
    ...imported.appSettings,
  });

  const baseProviderSettings =
    mode === 'replace' ? buildDefaultProviderSettings() : currentProviderSettings;

  const providerSettings = normalizeProviderSettingsRecord({
    ...baseProviderSettings,
    ...imported.providerSettings,
  });

  return {
    appSettings,
    providerSettings,
  };
};

