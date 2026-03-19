import { forwardRef, memo } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/ui/cn';
import ButtonPrimitive from '@/shared/ui/primitives/button';

export type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon' | 'icon-sm' | 'icon-xs';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border border-[var(--action-interactive)] bg-[var(--action-interactive)] text-[var(--text-on-interactive)] hover:border-[var(--action-interactive-hover)] hover:bg-[var(--action-interactive-hover)]',
  ghost: 'text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-2)]',
  subtle: 'border border-[var(--line-1)] text-[var(--ink-1)] hover:bg-[var(--bg-2)]',
  danger:
    'border border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--text-on-brand)] hover:bg-[var(--status-error-bg)]/80',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  icon: 'h-8 w-8',
  'icon-sm': 'h-7 w-7',
  'icon-xs': 'h-6 w-6',
};

const BUTTON_BASE_CLASS = 'font-normal tracking-[0.014em]';

const ButtonBase = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ghost', size = 'md', className, type = 'button', ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        type={type}
        className={cn(BUTTON_BASE_CLASS, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
        {...props}
      />
    );
  }
);

ButtonBase.displayName = 'Button';

const Button = memo(ButtonBase);
export default Button;
