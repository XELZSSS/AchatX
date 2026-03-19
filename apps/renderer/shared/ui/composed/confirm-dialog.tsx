import { useId } from 'react';
import Button from '@/shared/ui/composed/button';
import Modal from '@/shared/ui/composed/modal';
import { WarningAmberOutlinedIcon } from '@/shared/ui/icons';

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

const DIALOG_CLASS = 'max-w-md bg-[var(--bg-1)] shadow-none';
const DANGER_ICON_CLASS =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--text-on-brand)]';

type ConfirmDialogHeaderProps = {
  title: string;
  titleId: string;
  description?: string;
  descriptionId: string;
  danger: boolean;
};

const ConfirmDialogHeader = ({
  title,
  titleId,
  description,
  descriptionId,
  danger,
}: ConfirmDialogHeaderProps) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      {danger ? (
        <span className={DANGER_ICON_CLASS}>
          <WarningAmberOutlinedIcon size={16} strokeWidth={2} />
        </span>
      ) : null}
      <h3 id={titleId} className="text-sm font-semibold text-[var(--ink-1)]">
        {title}
      </h3>
    </div>
    {description ? (
      <p id={descriptionId} className="text-xs text-[var(--ink-2)]">
        {description}
      </p>
    ) : null}
  </div>
);

const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) => {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Modal
      isOpen={isOpen}
      className={DIALOG_CLASS}
      onClose={onCancel}
      ariaLabelledBy={titleId}
      ariaDescribedBy={description ? descriptionId : undefined}
    >
      <div className="px-5 py-4">
        <ConfirmDialogHeader
          title={title}
          titleId={titleId}
          description={description}
          descriptionId={descriptionId}
          danger={danger}
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
