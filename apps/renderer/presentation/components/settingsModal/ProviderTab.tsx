import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { ProviderId } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import type { OpenAIRequestMode } from '@/infrastructure/providers/types';
import {
  fullInputClass,
  resolveBaseUrlForRegion,
  settingsSectionLabelClass,
  smInputClass,
} from '@/presentation/components/settingsModal/constants';
import { Dropdown, Field, Input } from '@/shared/ui';
import type { DropdownOption } from '@/shared/ui';
import SecretInput from '@/presentation/components/settingsModal/SecretInput';
import {
  getSettingsInputValidationClass,
  SettingsControlGroup,
  SettingsFieldMessages,
} from '@/presentation/components/settingsModal/formParts';
import type { ProviderTabProps } from '@/presentation/components/settingsModal/providerTab.types';
import {
  GeminiCliAuthCard,
  OpenAICodexAuthCard,
  useGeminiCliAuthState,
  useOpenAICodexAuthState,
} from '@/presentation/components/settingsModal/providerTabAuth';
import {
  CustomHeadersSection,
  GeminiEmbeddingSection,
  RegionSelector,
} from '@/presentation/components/settingsModal/providerTabSections';
const ProviderTab = ({
  providerId,
  providerOptions,
  modelName,
  currentConversationModelName,
  apiKey,
  requestMode,
  baseUrl,
  geminiCliProjectId,
  googleCloudProject,
  customHeaders,
  embedding,
  showApiKey,
  supportsRequestMode,
  supportsEmbedding,
  supportsBaseUrl,
  supportsCustomHeaders,
  supportsRegion,
  isOfficialProvider: _isOfficialProvider,
  validationIssuesByField,
  onProviderChange,
  onModelNameChange,
  onApiKeyChange,
  onRequestModeChange,
  onToggleApiKeyVisibility,
  onClearApiKey,
  onBaseUrlChange,
  onGeminiCliProjectIdChange,
  onGoogleCloudProjectChange,
  onSetEmbeddingField,
  onAddCustomHeader,
  onSetCustomHeaderKey,
  onSetCustomHeaderValue,
  onRemoveCustomHeader,
  onSetRegionBaseUrl,
}: ProviderTabProps) => {
  const apiKeyVisibilityLabel = useMemo(
    () => (showApiKey ? t('settings.apiKey.hide') : t('settings.apiKey.show')),
    [showApiKey]
  );
  const requestModeOptions = useMemo<DropdownOption[]>(
    () => [
      { value: 'chat_completions', label: t('settings.modal.requestMode.chatCompletions') },
      { value: 'responses', label: t('settings.modal.requestMode.responses') },
    ],
    []
  );
  const handleProviderChange = useCallback(
    (value: string) => onProviderChange(value as ProviderId),
    [onProviderChange]
  );
  const handleRequestModeChange = useCallback(
    (value: string) => onRequestModeChange(value as OpenAIRequestMode),
    [onRequestModeChange]
  );
  const handleModelNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onModelNameChange(event.target.value),
    [onModelNameChange]
  );
  const handleApiKeyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onApiKeyChange(event.target.value),
    [onApiKeyChange]
  );
  const handleBaseUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onBaseUrlChange(event.target.value),
    [onBaseUrlChange]
  );
  const handleGeminiCliProjectIdChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onGeminiCliProjectIdChange(event.target.value),
    [onGeminiCliProjectIdChange]
  );
  const handleGoogleCloudProjectChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onGoogleCloudProjectChange(event.target.value),
    [onGoogleCloudProjectChange]
  );
  const canOpenLocalConfig =
    typeof window !== 'undefined' && typeof window.axchat?.openAxchatLocalConfig === 'function';
  const canOpenCredentialPage =
    typeof window !== 'undefined' && typeof window.axchat?.openExternal === 'function';
  const handleOpenLocalConfig = useCallback(
    () => void window.axchat?.openAxchatLocalConfig?.(),
    []
  );
  const handleOpenCredentialPage = useCallback(
    () => void window.axchat?.openExternal?.('https://console.cloud.google.com/auth/clients/'),
    []
  );
  const baseUrlIssues = validationIssuesByField['provider.baseUrl'];
  const embeddingOutputDimensionalityIssues =
    validationIssuesByField['provider.embedding.outputDimensionality'];
  const embeddingTitleIssues = validationIssuesByField['provider.embedding.title'];
  const baseUrlValidationClassName = getSettingsInputValidationClass(baseUrlIssues);
  const hasBaseUrlError = baseUrlIssues?.some((issue) => issue.severity === 'error');
  const isIntlRegion = baseUrl === resolveBaseUrlForRegion(providerId, 'intl');
  const isCnRegion = baseUrl === resolveBaseUrlForRegion(providerId, 'cn');
  const handleRegionIntl = useCallback(() => onSetRegionBaseUrl('intl'), [onSetRegionBaseUrl]);
  const handleRegionCn = useCallback(() => onSetRegionBaseUrl('cn'), [onSetRegionBaseUrl]);
  const isOpenAICodexAuthProvider = providerId === 'openai-codex-auth';
  const isGeminiCliAuthProvider = providerId === 'gemini-cli-auth';
  const conversationModelHint =
    currentConversationModelName && currentConversationModelName !== modelName
      ? `${t('settings.modal.modelCurrentHint')} ${currentConversationModelName}`
      : t('settings.modal.modelHint');
  const openAICodexAuth = useOpenAICodexAuthState(isOpenAICodexAuthProvider);
  const geminiCliAuth = useGeminiCliAuthState(isGeminiCliAuthProvider);
  return (
    <div className="space-y-4">
      <Field
        label={
          <div className="space-y-1">
            <div>{t('settings.modal.provider')}</div>
            <div className="text-[11px] font-normal text-[var(--ink-3)]">
              {t('settings.modal.providerHint')}
            </div>
          </div>
        }
      >
        <Dropdown value={providerId} options={providerOptions} onChange={handleProviderChange} />
      </Field>

      <Field
        label={
          <div className="space-y-1">
            <div>{t('settings.modal.model')}</div>
            <div className="text-[11px] font-normal text-[var(--ink-3)]">
              {conversationModelHint}
            </div>
          </div>
        }
      >
        <Input
          type="text"
          value={modelName}
          onChange={handleModelNameChange}
          className={smInputClass}
          compact
          autoComplete="off"
        />
      </Field>

      {supportsRequestMode ? (
        <Field label={t('settings.modal.requestMode')}>
          <Dropdown
            value={requestMode ?? 'chat_completions'}
            options={requestModeOptions}
            onChange={handleRequestModeChange}
          />
        </Field>
      ) : null}

      {isGeminiCliAuthProvider ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingsControlGroup
            label={t('settings.modal.geminiCliAuth.projectId')}
            labelClassName={settingsSectionLabelClass}
          >
            <Input
              type="text"
              value={geminiCliProjectId ?? ''}
              onChange={handleGeminiCliProjectIdChange}
              className={fullInputClass}
              compact
              autoComplete="off"
            />
          </SettingsControlGroup>

          <SettingsControlGroup
            label={t('settings.modal.geminiCliAuth.googleCloudProject')}
            labelClassName={settingsSectionLabelClass}
          >
            <Input
              type="text"
              value={googleCloudProject ?? ''}
              onChange={handleGoogleCloudProjectChange}
              className={fullInputClass}
              compact
              autoComplete="off"
            />
          </SettingsControlGroup>
        </div>
      ) : null}

      {isOpenAICodexAuthProvider ? (
        <OpenAICodexAuthCard
          authBusy={openAICodexAuth.authBusy}
          authError={openAICodexAuth.authError}
          authStatus={openAICodexAuth.authStatus}
          onLogin={() => {
            void openAICodexAuth.login();
          }}
          onLogout={() => {
            void openAICodexAuth.logout();
          }}
          onRefresh={() => {
            void openAICodexAuth.refreshAuthStatus();
          }}
        />
      ) : isGeminiCliAuthProvider ? (
        <GeminiCliAuthCard
          authBusy={geminiCliAuth.authBusy}
          authError={geminiCliAuth.authError}
          authStatus={geminiCliAuth.authStatus}
          canOpenLocalConfig={canOpenLocalConfig}
          canOpenCredentialPage={canOpenCredentialPage}
          onLogin={() => {
            void geminiCliAuth.login();
          }}
          onLogout={() => {
            void geminiCliAuth.logout();
          }}
          onOpenLocalConfig={handleOpenLocalConfig}
          onOpenCredentialPage={handleOpenCredentialPage}
          onRefresh={() => {
            void geminiCliAuth.refreshAuthStatus();
          }}
        />
      ) : (
        <SecretInput
          label={t('settings.modal.apiKey')}
          value={apiKey}
          onChange={handleApiKeyChange}
          showSecret={showApiKey}
          onToggleVisibility={onToggleApiKeyVisibility}
          onClear={onClearApiKey}
          visibilityLabel={apiKeyVisibilityLabel}
          inputClassName={`${fullInputClass} pr-20`}
        />
      )}

      {supportsEmbedding ? (
        <GeminiEmbeddingSection
          embedding={embedding}
          outputDimensionalityIssues={embeddingOutputDimensionalityIssues}
          titleIssues={embeddingTitleIssues}
          onSetEmbeddingField={onSetEmbeddingField}
        />
      ) : null}

      {supportsBaseUrl || supportsCustomHeaders ? (
        <div className="space-y-3">
          {supportsBaseUrl ? (
            <SettingsControlGroup
              label={t('settings.modal.baseUrl')}
              labelClassName={settingsSectionLabelClass}
            >
              <div className="space-y-2">
                <Input
                  type="text"
                  value={baseUrl ?? ''}
                  onChange={handleBaseUrlChange}
                  className={[fullInputClass, baseUrlValidationClassName].filter(Boolean).join(' ')}
                  compact
                  autoComplete="off"
                  aria-invalid={hasBaseUrlError || undefined}
                />
                <SettingsFieldMessages issues={baseUrlIssues} />
              </div>
            </SettingsControlGroup>
          ) : null}

          {supportsCustomHeaders ? (
            <CustomHeadersSection
              customHeaders={customHeaders}
              validationIssuesByField={validationIssuesByField}
              onAddCustomHeader={onAddCustomHeader}
              onSetCustomHeaderKey={onSetCustomHeaderKey}
              onSetCustomHeaderValue={onSetCustomHeaderValue}
              onRemoveCustomHeader={onRemoveCustomHeader}
            />
          ) : null}
        </div>
      ) : null}

      {supportsRegion ? (
        <RegionSelector
          isCnRegion={isCnRegion}
          isIntlRegion={isIntlRegion}
          onSetRegionCn={handleRegionCn}
          onSetRegionIntl={handleRegionIntl}
        />
      ) : null}
    </div>
  );
};

export default ProviderTab;
