import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';

export type DropdownOption = {
  value: string;
  label: string;
  group?: string;
};

export type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  widthClassName?: string;
};

const DEFAULT_WIDTH_CLASS = 'sm:w-56';
const TRIGGER_CLASS =
  'flex w-full items-center justify-between rounded-md border border-[var(--line-1)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--ink-2)] outline-none focus:ring-2 focus:ring-[var(--action-interactive)]';
const MENU_CLASS =
  'z-[90] max-h-56 overflow-auto scrollbar-hide rounded-md border border-[var(--line-1)] bg-[var(--bg-1)] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.26)]';
const OPTION_ACTIVE_CLASS = 'bg-[var(--bg-2)] text-[var(--ink-1)]';
const OPTION_INACTIVE_CLASS =
  'text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]';

const resolveSelectedIndex = (options: DropdownOption[], value: string) =>
  Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

const shouldRenderGroupLabel = (options: DropdownOption[], index: number) => {
  const option = options[index];
  return !!option?.group && option.group !== options[index - 1]?.group;
};

const getWrappedIndex = (index: number, length: number) => {
  if (length === 0) return -1;
  return (index + length) % length;
};

const getNextFocusedIndex = (key: string, index: number, length: number) => {
  const actions: Record<string, number> = {
    ArrowDown: index + 1,
    ArrowUp: index - 1,
    Home: 0,
    End: length - 1,
  };

  return key in actions ? getWrappedIndex(actions[key], length) : null;
};

const Dropdown = ({ value, options, onChange, widthClassName }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = useMemo(() => resolveSelectedIndex(options, value), [options, value]);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    optionRefs.current[focusedIndex]?.focus();
  }, [focusedIndex, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setFocusedIndex(selectedIndex);
  };

  const handleSelect = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
    setFocusedIndex(event.key === 'ArrowDown' ? selectedIndex : options.length - 1);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(focusedIndex);
      return;
    }

    const nextIndex = getNextFocusedIndex(event.key, focusedIndex, options.length);
    if (nextIndex === null) return;
    event.preventDefault();
    setFocusedIndex(nextIndex);
  };

  return (
    <div className={`relative w-full ${widthClassName ?? DEFAULT_WIDTH_CLASS}`}>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            onKeyDown={handleTriggerKeyDown}
            className={TRIGGER_CLASS}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
          >
            <span>{selectedOption?.label ?? value}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            id={listboxId}
            role="listbox"
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onKeyDown={handleMenuKeyDown}
            className={`${MENU_CLASS} w-[var(--radix-popover-trigger-width)]`}
          >
            {options.map((option, index) => (
              <div key={option.value}>
                {shouldRenderGroupLabel(options, index) ? (
                  <div className="px-3 pb-1 pt-2 text-xs font-medium text-[var(--ink-2)] first:pt-1">
                    {option.group}
                  </div>
                ) : null}
                <div className="px-1 py-0.5">
                  <button
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`flex w-full items-center rounded-md px-2.5 py-2 text-sm transition-colors duration-90 ease-out ${
                      focusedIndex === index || option.value === value
                        ? OPTION_ACTIVE_CLASS
                        : OPTION_INACTIVE_CLASS
                    }`}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    {option.label}
                  </button>
                </div>
              </div>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export default Dropdown;
