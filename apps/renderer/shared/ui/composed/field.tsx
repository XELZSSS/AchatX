import { memo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/ui/cn';

export type FieldProps = {
  label: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

const FIELD_LABEL_CLASS = 'text-xs font-medium text-[var(--ink-2)]';

const FieldBase = ({ label, actions, children, className, id }: FieldProps) => {
  const LabelTag = id ? 'label' : 'div';
  const hasHeader = (label !== null && label !== undefined && label !== '') || Boolean(actions);

  return (
    <div className={cn('space-y-2', className)}>
      {hasHeader ? (
        <div className="flex items-center justify-between gap-2">
          {label !== null && label !== undefined && label !== '' ? (
            <LabelTag {...(id ? { htmlFor: id } : {})} className={FIELD_LABEL_CLASS}>
              {label}
            </LabelTag>
          ) : (
            <div />
          )}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
};

const Field = memo(FieldBase);
export default Field;
