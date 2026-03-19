import { useCallback, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import * as TabsPrimitive from '@/shared/ui/primitives/tabs';
import { cn } from '@/shared/ui/cn';

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

export type TabsProps<T extends string> = {
  items: Array<TabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  idPrefix?: string;
};

const TAB_BASE =
  'border-b border-transparent px-0 py-2 text-left text-sm font-medium transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)] sm:border-b-0 sm:border-l sm:px-3';

const TAB_STYLES = {
  active: 'border-[var(--ink-1)] text-[var(--ink-1)]',
  inactive: 'text-[var(--ink-3)] hover:border-[var(--line-1)] hover:text-[var(--ink-1)]',
} as const;

const getWrappedIndex = (index: number, length: number) => {
  if (length === 0) return -1;
  return (index + length) % length;
};

const getTabAction = (key: string, index: number, length: number) => {
  const actions: Record<string, number> = {
    ArrowRight: index + 1,
    ArrowDown: index + 1,
    ArrowLeft: index - 1,
    ArrowUp: index - 1,
    Home: 0,
    End: length - 1,
  };

  return key in actions ? getWrappedIndex(actions[key], length) : null;
};

const Tabs = <T extends string>({
  items,
  activeId,
  onChange,
  className,
  idPrefix,
}: TabsProps<T>) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const autoId = useId().replace(/:/g, '');
  const prefix = idPrefix ?? `tabs-${autoId}`;

  const focusAndSelect = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      onChange(item.id);
      tabRefs.current[index]?.focus();
    },
    [items, onChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const nextIndex = getTabAction(event.key, index, items.length);
      if (nextIndex === null) return;
      event.preventDefault();
      focusAndSelect(nextIndex);
    },
    [focusAndSelect, items.length]
  );

  return (
    <TabsPrimitive.Root
      value={activeId}
      onValueChange={(value) => onChange(value as T)}
      className={cn('w-full flex-none sm:w-40', className)}
    >
      <TabsPrimitive.List className="flex w-full gap-4 overflow-x-auto border-b border-[var(--line-1)] pb-0 sm:flex-col sm:gap-1 sm:overflow-visible sm:border-b-0 sm:border-r sm:pr-4">
        {items.map((item, index) => {
          const isActive = activeId === item.id;
          return (
            <TabsPrimitive.Trigger
              key={item.id}
              value={item.id}
              id={`${prefix}-tab-${item.id}`}
              aria-controls={`${prefix}-panel-${item.id}`}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              className={cn(TAB_BASE, isActive ? TAB_STYLES.active : TAB_STYLES.inactive)}
            >
              {item.label}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
};

export default Tabs;
