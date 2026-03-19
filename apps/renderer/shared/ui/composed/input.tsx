import { forwardRef, memo } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/ui/cn';
import InputPrimitive from '@/shared/ui/primitives/input';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  compact?: boolean;
};

const INPUT_SIZE_CLASS = {
  compact: 'px-2.5 py-1.5 text-sm',
  default: 'px-3 py-2 text-sm',
} as const;

const InputBase = forwardRef<HTMLInputElement, InputProps>(
  ({ className, compact = false, ...props }, ref) => {
    const sizeClassName = compact ? INPUT_SIZE_CLASS.compact : INPUT_SIZE_CLASS.default;
    return <InputPrimitive ref={ref} className={cn(sizeClassName, className)} {...props} />;
  }
);

InputBase.displayName = 'Input';

const Input = memo(InputBase);
export default Input;
