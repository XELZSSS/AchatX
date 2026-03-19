import type { ReactNode } from 'react';
import { Toggle } from '@/shared/ui';
import type { SettingsValidationIssue } from '@/presentation/components/settingsModal/validation';
import {
  settingsCardClass,
  settingsHintClass,
  settingsSectionLabelClass,
  settingsSubLabelClass,
  settingsToggleRowClass,
} from '@/presentation/components/settingsModal/constants';

type SettingsCardProps = {
  children: ReactNode;
  className?: string;
};

type SettingsControlGroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
};

type SettingsToggleRowProps = {
  checked: boolean;
  title?: string;
  description?: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export const SettingsCard = ({ children, className }: SettingsCardProps) => (
  <div className={`${settingsCardClass}${className ? ` ${className}` : ''}`}>{children}</div>
);

export const SettingsControlGroup = ({
  label,
  children,
  className,
  labelClassName = settingsSubLabelClass,
}: SettingsControlGroupProps) => (
  <div className={className ?? 'space-y-2'}>
    <label className={labelClassName}>{label}</label>
    {children}
  </div>
);

export const SettingsSectionHeading = ({ children }: { children: ReactNode }) => (
  <div className={settingsSectionLabelClass}>{children}</div>
);

export const SettingsHint = ({ children }: { children: ReactNode }) => (
  <div className={settingsHintClass}>{children}</div>
);

export const getSettingsInputValidationClass = (
  issues?: SettingsValidationIssue[]
): string | undefined => {
  if (issues?.some((issue) => issue.severity === 'error')) {
    return 'ring-[var(--status-error)] focus:ring-[var(--status-error)]';
  }

  if (issues?.some((issue) => issue.severity === 'warning')) {
    return 'ring-[var(--status-warning-border)] focus:ring-[var(--status-warning-border)]';
  }

  return undefined;
};

export const SettingsFieldMessages = ({ issues }: { issues?: SettingsValidationIssue[] }) => {
  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {issues.map((issue) => (
        <div
          key={`${issue.severity}-${issue.field ?? issue.tab}-${issue.message}`}
          className={
            issue.severity === 'error'
              ? 'text-[11px] leading-5 text-[var(--status-error)]'
              : 'text-[11px] leading-5 text-[var(--status-warning-border)]'
          }
        >
          {issue.message}
        </div>
      ))}
    </div>
  );
};

export const SettingsToggleRow = ({
  checked,
  title,
  description,
  disabled,
  onCheckedChange,
}: SettingsToggleRowProps) => (
  <label className={settingsToggleRowClass}>
    <Toggle checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    {description ? (
      <span className="space-y-1">
        <span className="block text-xs font-medium text-[var(--ink-2)]">{title}</span>
        <span className={`block ${settingsHintClass}`}>{description}</span>
      </span>
    ) : title ? (
      title
    ) : null}
  </label>
);
