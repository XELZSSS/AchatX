import type { FormEvent, KeyboardEvent, MouseEvent } from 'react';
import { ChatSession } from '@/shared/types/chat';
import { t } from '@/shared/utils/i18n';
import { IconButton, Input } from '@/shared/ui';
import {
  CheckIcon,
  CloseIcon,
  DeleteOutlineIcon,
  EditOutlinedIcon,
} from '@/shared/ui/icons';

type SessionEditorProps = {
  editTitleInput: string;
  onEditTitleInputChange: (value: string) => void;
  onEditInputClick: (event: MouseEvent) => void;
  onEditKeyDown: (event: KeyboardEvent) => void;
  onSaveEdit: (event: FormEvent | MouseEvent) => void;
  onCancelEdit: (event: MouseEvent) => void;
};

type SessionActionsProps = {
  session: ChatSession;
  disabled: boolean;
  disabledReason: string | null;
  onStartEdit: (event: MouseEvent, session: ChatSession) => void;
  onRequestDeleteSession: (event: MouseEvent, session: ChatSession) => void;
};

export const SessionEditor = ({
  editTitleInput,
  onEditTitleInputChange,
  onEditInputClick,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
}: SessionEditorProps) => (
  <div className="flex items-center gap-1 w-full" onClick={onEditInputClick}>
    <Input
      type="text"
      autoFocus
      value={editTitleInput}
      onChange={(event) => onEditTitleInputChange(event.target.value)}
      onKeyDown={onEditKeyDown}
      className="flex-1 px-2 text-xs"
      compact
    />
    <IconButton
      onClick={onSaveEdit}
      size="xs"
      aria-label={t('settings.modal.save')}
      title={t('settings.modal.save')}
    >
      <CheckIcon size={14} strokeWidth={2} />
    </IconButton>
    <IconButton
      onClick={onCancelEdit}
      danger
      size="xs"
      aria-label={t('settings.modal.cancel')}
      title={t('settings.modal.cancel')}
    >
      <CloseIcon size={14} strokeWidth={2} />
    </IconButton>
  </div>
);

export const SessionActions = ({
  session,
  disabled,
  disabledReason,
  onStartEdit,
  onRequestDeleteSession,
}: SessionActionsProps) => (
  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
    <IconButton
      onClick={(event) => onStartEdit(event, session)}
      disabled={disabled}
      size="sm"
      aria-label={t('sidebar.editTitle')}
      title={disabled ? (disabledReason ?? t('sidebar.editTitle')) : t('sidebar.editTitle')}
    >
      <EditOutlinedIcon size={13} strokeWidth={2} />
    </IconButton>
    <IconButton
      onClick={(event) => onRequestDeleteSession(event, session)}
      disabled={disabled}
      danger
      size="sm"
      aria-label={t('sidebar.deleteTitle')}
      title={disabled ? (disabledReason ?? t('sidebar.deleteTitle')) : t('sidebar.deleteTitle')}
    >
      <DeleteOutlineIcon size={13} strokeWidth={2} />
    </IconButton>
  </div>
);
