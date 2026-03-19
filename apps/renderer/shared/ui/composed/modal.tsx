import type { ReactNode } from 'react';
import * as Dialog from '@/shared/ui/primitives/dialog';
import { cn } from '@/shared/ui/cn';

export type ModalProps = {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  onClose?: () => void;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};

const DIALOG_OVERLAY_CLASS =
  'fixed inset-0 z-70 flex items-center justify-center bg-[var(--overlay-bg)] p-4 titlebar-no-drag';

const handleOpenChange = (open: boolean, onClose?: () => void) => {
  if (!open) onClose?.();
};

const Modal = ({
  isOpen,
  children,
  className,
  overlayClassName,
  onClose,
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalProps) => (
  <Dialog.Root open={isOpen} onOpenChange={(open) => handleOpenChange(open, onClose)}>
    <Dialog.Portal>
      <Dialog.Overlay className={cn(DIALOG_OVERLAY_CLASS, overlayClassName)} />
      <Dialog.Content
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={cn(
          'fixed left-1/2 top-1/2 z-[71] max-h-[92vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-[var(--bg-1)] ring-1 ring-[var(--line-1)] focus:outline-none',
          className
        )}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Modal;
