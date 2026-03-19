import type { MouseEvent, ReactNode } from 'react';
import type { TwemojiEntry } from '@/shared/data/twemojiCatalog';
import { EMOJI_FONT_FAMILY } from '@/shared/utils/emojiSupport';
import { ACTION_BUTTON_CLASS } from '@/presentation/components/chatInputHelpers';
import ButtonPrimitive from '@/shared/ui/primitives/button';

type ChatInputActionButtonProps = {
  disabled: boolean;
  label: string;
  toneClassName: string;
  onClick: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaHasPopup?: boolean;
  ariaControls?: string;
  children: ReactNode;
};

const getActionButtonClassName = (toneClassName: string, disabled: boolean) =>
  `${ACTION_BUTTON_CLASS} ${toneClassName}${disabled ? ' opacity-50 cursor-not-allowed' : ''}`;

export const TwemojiPickerGlyph = ({ entry }: { entry: TwemojiEntry }) => (
  <span
    aria-hidden="true"
    className="inline-flex h-6 w-6 items-center justify-center text-[20px]"
    style={{ fontFamily: EMOJI_FONT_FAMILY }}
  >
    {entry.glyph}
  </span>
);

export const ChatInputActionButton = ({
  disabled,
  label,
  toneClassName,
  onClick,
  buttonRef,
  onMouseDown,
  ariaPressed,
  ariaExpanded,
  ariaHasPopup,
  ariaControls,
  children,
}: ChatInputActionButtonProps) => (
  <ButtonPrimitive
    ref={buttonRef}
    onMouseDown={onMouseDown}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={ariaPressed}
    aria-expanded={ariaExpanded}
    aria-haspopup={ariaHasPopup ? 'dialog' : undefined}
    aria-controls={ariaControls}
    aria-label={label}
    title={label}
    className={getActionButtonClassName(toneClassName, disabled)}
  >
    {children}
  </ButtonPrimitive>
);
