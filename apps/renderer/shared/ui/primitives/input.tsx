import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/ui/cn';

export type InputPrimitiveProps = InputHTMLAttributes<HTMLInputElement>;

const INPUT_PRIMITIVE_BASE_CLASS = [
  'rounded-lg bg-[var(--bg-2)] text-[var(--ink-1)] outline-none',
  'ring-1 ring-[var(--line-1)] focus:ring-[var(--action-interactive)]',
  'tracking-[0.005em] placeholder:text-[var(--ink-3)] placeholder:tracking-[0.012em]',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const InputPrimitive = forwardRef<HTMLInputElement, InputPrimitiveProps>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(INPUT_PRIMITIVE_BASE_CLASS, className)} {...props} />;
  }
);

InputPrimitive.displayName = 'InputPrimitive';

export default InputPrimitive;
