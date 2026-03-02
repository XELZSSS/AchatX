import React from 'react';
import Button from './Button';
import { cn } from './cn';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  danger?: boolean;
};

const TONES = {
  default: 'text-[var(--ink-3)] hover:text-[var(--ink-1)]',
  active: 'bg-[var(--bg-2)] text-[var(--ink-1)]',
  danger: 'text-[var(--ink-3)] hover:text-red-400',
} as const;

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active = false, danger = false, className, ...props }, ref) => {
    const tone = danger ? TONES.danger : active ? TONES.active : TONES.default;

    return (
      <Button
        ref={ref}
        size="icon"
        variant="subtle"
        className={cn(tone, className)}
        {...props}
      />
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
