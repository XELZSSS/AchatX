import React from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'ghost' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'icon';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent)] text-[#1a1a1a] hover:bg-[#d4d4d8]',
  ghost: 'text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-[var(--bg-2)]',
  subtle: 'ring-1 ring-[var(--line-1)] text-[var(--ink-2)] hover:bg-[var(--bg-2)]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-1.5 text-sm',
  icon: 'h-8 w-8 flex items-center justify-center',
};

const BASE = 'rounded-lg font-medium transition-colors duration-160 ease-out disabled:opacity-50 disabled:cursor-not-allowed';

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ghost', size = 'md', className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;
