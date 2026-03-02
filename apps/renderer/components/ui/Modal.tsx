import React, { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

type ModalProps = {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  overlayRef?: React.RefObject<HTMLDivElement>;
  onClose?: () => void;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ANIMATION = {
  enter: 220,
  exit: 160,
} as const;

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true'
  );
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  children,
  className,
  overlayRef,
  onClose,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const fallbackOverlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resolvedOverlayRef = overlayRef ?? fallbackOverlayRef;
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timer = setTimeout(() => setIsMounted(false), ANIMATION.exit);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousActive = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const frame = requestAnimationFrame(() => {
      const focusable = getFocusableElements(dialogRef.current);
      (focusable[0] ?? dialogRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previousActive?.focus();
    };
  }, [isOpen]);

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey) {
      if (!active || active === first || !dialogRef.current?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (!active || active === last || !dialogRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!isMounted) return null;

  const duration = isVisible ? ANIMATION.enter : ANIMATION.exit;
  const easing = isVisible ? 'var(--motion-ease-emphasized)' : 'var(--motion-ease-standard)';

  return (
    <div
      ref={resolvedOverlayRef}
      className={cn(
        'fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 titlebar-no-drag',
        'transition-opacity',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        pointerEvents: isVisible ? 'auto' : 'none',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'var(--motion-ease-standard)',
      }}
      onMouseDown={handleOverlayMouseDown}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={cn(
          'w-full max-h-[92vh] overflow-hidden rounded-xl bg-[var(--bg-1)] ring-1 ring-[var(--line-1)]',
          'transition-opacity transition-transform motion-reduce:transition-none',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          className
        )}
        style={{
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: easing,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
