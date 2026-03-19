import { forwardRef, memo } from 'react';
import SwitchRoot from '@/shared/ui/primitives/switch';

export type ToggleProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  onCheckedChange?: (checked: boolean) => void;
};

const ToggleBase = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ onCheckedChange, ...props }, ref) => {
    return <SwitchRoot ref={ref} onCheckedChange={onCheckedChange} {...props} />;
  }
);

ToggleBase.displayName = 'Toggle';

const Toggle = memo(ToggleBase);
export default Toggle;
