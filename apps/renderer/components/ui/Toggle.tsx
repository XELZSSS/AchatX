import React from 'react';
import { cn } from './cn';

type ToggleProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

const BASE = [
  'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full',
  'border border-[var(--line-1)] bg-[var(--bg-1)] transition-colors duration-160 ease-out',
  'after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full',
  'after:bg-[var(--ink-3)] after:transition-transform after:duration-160',
  'checked:border-[var(--line-1)] checked:bg-[var(--bg-2)]',
  'checked:after:translate-x-4 checked:after:bg-[var(--ink-1)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--line-1)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className={cn(BASE, className)}
        {...props}
      />
    );
  }
);

Toggle.displayName = 'Toggle';

export default Toggle;
