import type { ChangeEvent } from 'react';
import { t } from '@/shared/utils/i18n';
import { Button, Input } from '@/shared/ui';
import { DeleteOutlineIcon, VisibilityIcon, VisibilityOffIcon } from '@/shared/ui/icons';
import {
  getSettingsInputValidationClass,
  SettingsFieldMessages,
} from '@/presentation/components/settingsModal/formParts';
import type { SettingsValidationIssue } from '@/presentation/components/settingsModal/validation';

const ICON_BUTTON_CLASS = 'min-w-0';
const ACTIONS_CLASS = 'absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1';
const LABEL_CLASS = 'text-xs font-medium text-[var(--ink-2)]';
const CLEAR_BUTTON_CLASS = `${ICON_BUTTON_CLASS} hover:text-[var(--status-error)]`;

const getVisibilityIcon = (showSecret: boolean) =>
  showSecret ? (
    <VisibilityOffIcon size={16} strokeWidth={2} />
  ) : (
    <VisibilityIcon size={16} strokeWidth={2} />
  );

type SecretInputProps = {
  label: string;
  labelClassName?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  showSecret: boolean;
  onToggleVisibility: () => void;
  onClear: () => void;
  visibilityLabel: string;
  clearLabel?: string;
  inputClassName?: string;
  compact?: boolean;
  autoComplete?: string;
  issues?: SettingsValidationIssue[];
};

const SecretInput = ({
  label,
  labelClassName,
  value,
  onChange,
  showSecret,
  onToggleVisibility,
  onClear,
  visibilityLabel,
  clearLabel,
  inputClassName,
  compact,
  autoComplete = 'off',
  issues,
}: SecretInputProps) => {
  const resolvedClearLabel = clearLabel ?? t('settings.apiKey.clear');
  const validationClassName = getSettingsInputValidationClass(issues);
  const hasError = issues?.some((issue) => issue.severity === 'error');

  return (
    <div className="space-y-2">
      <label className={labelClassName ?? LABEL_CLASS}>{label}</label>
      <div className="relative">
        <Input
          type={showSecret ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={[inputClassName, validationClassName].filter(Boolean).join(' ')}
          compact={compact}
          autoComplete={autoComplete}
          aria-invalid={hasError || undefined}
        />
        <div className={ACTIONS_CLASS}>
          <Button
            onClick={onToggleVisibility}
            variant="ghost"
            size="icon-xs"
            className={ICON_BUTTON_CLASS}
            aria-label={visibilityLabel}
          >
            {getVisibilityIcon(showSecret)}
          </Button>
          <Button
            onClick={onClear}
            variant="ghost"
            size="icon-xs"
            className={CLEAR_BUTTON_CLASS}
            aria-label={resolvedClearLabel}
            title={resolvedClearLabel}
          >
            <DeleteOutlineIcon size={16} strokeWidth={2} />
          </Button>
        </div>
      </div>
      <SettingsFieldMessages issues={issues} />
    </div>
  );
};

export default SecretInput;
