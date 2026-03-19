import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/ui/cn';

export type ButtonPrimitiveProps = ButtonHTMLAttributes<HTMLButtonElement>;

const BUTTON_PRIMITIVE_BASE_CLASS = [
  'inline-flex items-center justify-center whitespace-nowrap rounded-md',
  'transition-colors duration-160 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const ButtonPrimitive = forwardRef<HTMLButtonElement, ButtonPrimitiveProps>(
  ({ className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(BUTTON_PRIMITIVE_BASE_CLASS, className)}
        {...props}
      />
    );
  }
);

ButtonPrimitive.displayName = 'ButtonPrimitive';

export default ButtonPrimitive;
