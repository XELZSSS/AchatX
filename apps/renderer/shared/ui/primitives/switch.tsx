import { forwardRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/shared/ui/cn';

export type SwitchPrimitiveProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

const SWITCH_ROOT_BASE_CLASS = [
  'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full',
  'border border-[var(--line-1)] bg-[var(--bg-1)]',
  'transition-colors duration-160 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'data-[state=checked]:bg-[var(--action-interactive)]',
  'data-[state=checked]:border-[var(--line-1)]',
].join(' ');

const SWITCH_THUMB_BASE_CLASS = [
  'pointer-events-none block h-3.5 w-3.5 rounded-full bg-[var(--ink-3)] shadow-sm',
  'translate-x-0.5 transition-transform duration-160 ease-out',
  'data-[state=checked]:translate-x-4',
  'data-[state=checked]:bg-[var(--text-on-interactive)]',
].join(' ');

const SwitchRoot = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchPrimitiveProps
>(({ className, children, ...props }, ref) => {
  return (
    <SwitchPrimitive.Root ref={ref} className={cn(SWITCH_ROOT_BASE_CLASS, className)} {...props}>
      {children ?? <SwitchPrimitive.Thumb className={SWITCH_THUMB_BASE_CLASS} />}
    </SwitchPrimitive.Root>
  );
});

SwitchRoot.displayName = 'SwitchPrimitive';

export default SwitchRoot;
