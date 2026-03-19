import { memo, useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { t } from '@/shared/utils/i18n';
import {
  fullInputClass,
  getGeminiEmbeddingTaskOptions,
} from '@/presentation/components/settingsModal/constants';
import { Button, Dropdown, Field, Input } from '@/shared/ui';
import { DeleteOutlineIcon } from '@/shared/ui/icons';
import {
  getSettingsInputValidationClass,
  SettingsControlGroup,
  SettingsFieldMessages,
  SettingsSectionHeading,
} from '@/presentation/components/settingsModal/formParts';
import {
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
  DEFAULT_GEMINI_EMBEDDING_TASK_TYPE,
} from '@/infrastructure/providers/geminiEmbeddings';
import type {
  CustomHeaderRowProps,
  CustomHeadersSectionProps,
  GeminiEmbeddingSectionProps,
  RegionSelectorProps,
} from '@/presentation/components/settingsModal/providerTab.types';

const REGION_BUTTON_BASE =
  'flex-1 rounded-md border border-[var(--line-1)] px-3 py-1.5 text-xs font-medium transition-colors duration-160 ease-out';
const REGION_ACTIVE_CLASS = 'bg-[var(--bg-2)] text-[var(--ink-1)]';
const REGION_INACTIVE_CLASS =
  'text-[var(--ink-3)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]';

export const GeminiEmbeddingSection = memo<GeminiEmbeddingSectionProps>(
  ({ embedding, outputDimensionalityIssues, titleIssues, onSetEmbeddingField }) => {
    const embeddingTaskOptions = useMemo(() => getGeminiEmbeddingTaskOptions(), []);
    const outputDimensionalityClassName = getSettingsInputValidationClass(
      outputDimensionalityIssues
    );
    const titleClassName = getSettingsInputValidationClass(titleIssues);
    const hasOutputDimensionalityError = outputDimensionalityIssues?.some(
      (issue) => issue.severity === 'error'
    );
    const hasTitleError = titleIssues?.some((issue) => issue.severity === 'error');

    const handleEmbeddingModelChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) =>
        onSetEmbeddingField('model', event.target.value || undefined),
      [onSetEmbeddingField]
    );
    const handleEmbeddingOutputDimensionalityChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        const normalized = event.target.value.replace(/[^\d]/g, '');
        onSetEmbeddingField('outputDimensionality', normalized ? Number(normalized) : undefined);
      },
      [onSetEmbeddingField]
    );
    const handleEmbeddingTitleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) =>
        onSetEmbeddingField('title', event.target.value || undefined),
      [onSetEmbeddingField]
    );
    const handleEmbeddingTaskTypeChange = useCallback(
      (value: string) =>
        onSetEmbeddingField('taskType', value as GeminiEmbeddingSectionProps['embedding']['taskType']),
      [onSetEmbeddingField]
    );

    return (
      <Field label={null}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SettingsControlGroup label={t('settings.modal.embedding.model')}>
              <Input
                type="text"
                value={embedding.model ?? ''}
                onChange={handleEmbeddingModelChange}
                placeholder={DEFAULT_GEMINI_EMBEDDING_MODEL}
                className={fullInputClass}
                compact
                autoComplete="off"
              />
            </SettingsControlGroup>

            <SettingsControlGroup label={t('settings.modal.embedding.outputDimensionality')}>
              <div className="space-y-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={embedding.outputDimensionality ?? ''}
                  onChange={handleEmbeddingOutputDimensionalityChange}
                  placeholder={String(DEFAULT_GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY)}
                  className={[fullInputClass, outputDimensionalityClassName].filter(Boolean).join(' ')}
                  compact
                  autoComplete="off"
                  aria-invalid={hasOutputDimensionalityError || undefined}
                />
                <SettingsFieldMessages issues={outputDimensionalityIssues} />
              </div>
            </SettingsControlGroup>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SettingsControlGroup label={t('settings.modal.embedding.taskType')}>
              <Dropdown
                value={embedding.taskType ?? DEFAULT_GEMINI_EMBEDDING_TASK_TYPE}
                options={embeddingTaskOptions}
                onChange={handleEmbeddingTaskTypeChange}
                widthClassName="w-full"
              />
            </SettingsControlGroup>

            <SettingsControlGroup label={t('settings.modal.embedding.titleField')}>
              <div className="space-y-2">
                <Input
                  type="text"
                  value={embedding.title ?? ''}
                  onChange={handleEmbeddingTitleChange}
                  className={[fullInputClass, titleClassName].filter(Boolean).join(' ')}
                  compact
                  autoComplete="off"
                  aria-invalid={hasTitleError || undefined}
                />
                <SettingsFieldMessages issues={titleIssues} />
              </div>
            </SettingsControlGroup>
          </div>
        </div>
      </Field>
    );
  }
);

GeminiEmbeddingSection.displayName = 'GeminiEmbeddingSection';

const CustomHeaderRow = ({
  header,
  index,
  issues,
  onSetCustomHeaderKey,
  onSetCustomHeaderValue,
  onRemoveCustomHeader,
}: CustomHeaderRowProps) => {
  const validationClassName = getSettingsInputValidationClass(issues);
  const hasError = issues?.some((issue) => issue.severity === 'error');

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="text"
          value={header.key}
          onChange={(event) => onSetCustomHeaderKey(index, event.target.value)}
          placeholder={t('settings.modal.customHeaders.key')}
          className={[fullInputClass, validationClassName].filter(Boolean).join(' ')}
          compact
          autoComplete="off"
          aria-invalid={hasError || undefined}
        />
        <Input
          type="text"
          value={header.value}
          onChange={(event) => onSetCustomHeaderValue(index, event.target.value)}
          placeholder={t('settings.modal.customHeaders.value')}
          className={[fullInputClass, validationClassName].filter(Boolean).join(' ')}
          compact
          autoComplete="off"
          aria-invalid={hasError || undefined}
        />
        <Button
          onClick={() => onRemoveCustomHeader(index)}
          variant="ghost"
          size="icon-sm"
          className="hover:text-[var(--status-error)]"
          aria-label={t('settings.modal.customHeaders.remove')}
          title={t('settings.modal.customHeaders.remove')}
        >
          <DeleteOutlineIcon size={16} strokeWidth={2} />
        </Button>
      </div>
      <SettingsFieldMessages issues={issues} />
    </div>
  );
};

export const CustomHeadersSection = ({
  customHeaders,
  validationIssuesByField,
  onAddCustomHeader,
  onSetCustomHeaderKey,
  onSetCustomHeaderValue,
  onRemoveCustomHeader,
}: CustomHeadersSectionProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <SettingsSectionHeading>{t('settings.modal.customHeaders')}</SettingsSectionHeading>
      <Button
        onClick={onAddCustomHeader}
        variant="ghost"
        size="sm"
        className="h-auto bg-transparent px-0 py-0 text-xs hover:bg-transparent"
      >
        {t('settings.modal.customHeaders.add')}
      </Button>
    </div>
    <div className="space-y-1.5">
      {customHeaders.map((header, index) => (
        <CustomHeaderRow
          key={`${header.key}-${index}`}
          header={header}
          index={index}
          issues={validationIssuesByField[`provider.customHeaders.${index}`]}
          onSetCustomHeaderKey={onSetCustomHeaderKey}
          onSetCustomHeaderValue={onSetCustomHeaderValue}
          onRemoveCustomHeader={onRemoveCustomHeader}
        />
      ))}
    </div>
  </div>
);

export const RegionSelector = ({
  isCnRegion,
  isIntlRegion,
  onSetRegionCn,
  onSetRegionIntl,
}: RegionSelectorProps) => (
  <div className="space-y-2">
    <SettingsSectionHeading>{t('settings.modal.region')}</SettingsSectionHeading>
    <div className="flex gap-2">
      <Button
        onClick={onSetRegionIntl}
        variant="ghost"
        className={`${REGION_BUTTON_BASE} ${isIntlRegion ? REGION_ACTIVE_CLASS : REGION_INACTIVE_CLASS}`}
      >
        {t('settings.modal.region.international')}
      </Button>
      <Button
        onClick={onSetRegionCn}
        variant="ghost"
        className={`${REGION_BUTTON_BASE} ${isCnRegion ? REGION_ACTIVE_CLASS : REGION_INACTIVE_CLASS}`}
      >
        {t('settings.modal.region.china')}
      </Button>
    </div>
  </div>
);
