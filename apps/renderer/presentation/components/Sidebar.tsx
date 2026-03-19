import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react';
import { ChatSession } from '@/shared/types/chat';
import type { Language } from '@/shared/utils/i18n';
import { t } from '@/shared/utils/i18n';
import { Button, Input } from '@/shared/ui';
import { ConfirmDialog } from '@/shared/ui';
import {
  AddIcon,
  ChatBubbleOutlineIcon,
  SearchIcon,
  SettingsOutlinedIcon,
} from '@/shared/ui/icons';
import { SessionActions, SessionEditor } from '@/presentation/components/sidebarParts';

const SIDEBAR_FOOTER_BUTTON_CLASS =
  'flex w-full items-center justify-start gap-3 rounded-md bg-transparent text-sm text-[var(--ink-1)] hover:bg-[var(--bg-2)]';

type SidebarProps = {
  currentSessionId: string;
  sessions: ChatSession[];
  filteredSessions: ChatSession[];
  searchQuery: string;
  editingSessionId: string | null;
  editTitleInput: string;
  sessionActionsDisabled: boolean;
  sessionActionsDisabledReason: string | null;
  sessionNotice: string | null;
  language: Language;
  onNewChatClick: () => void;
  onSearchChange: (value: string) => void;
  onLoadSession: (session: ChatSession) => void;
  onStartEdit: (e: MouseEvent, session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onEditTitleInputChange: (value: string) => void;
  onEditInputClick: (e: MouseEvent) => void;
  onEditKeyDown: (e: KeyboardEvent) => void;
  onSaveEdit: (e: FormEvent | MouseEvent) => void;
  onCancelEdit: (e: MouseEvent) => void;
  onOpenSettings: () => void;
};

const SIDEBAR_SESSION_ROW_BASE_CLASS =
  'group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-interactive)]';
const SIDEBAR_SESSION_ROW_ACTIVE_CLASS =
  'bg-[var(--bg-2)] text-[var(--ink-1)] ring-1 ring-[var(--line-1)]';
const SIDEBAR_SESSION_ROW_IDLE_CLASS =
  'text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]';
const SIDEBAR_SESSION_ROW_DISABLED_CLASS = 'cursor-not-allowed text-[var(--ink-3)] opacity-55';
const SIDEBAR_NOTICE_CLASS =
  'mb-3 rounded-md border border-[var(--line-1)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--ink-2)]';

const SidebarComponent = ({
  currentSessionId,
  sessions,
  filteredSessions,
  searchQuery,
  editingSessionId,
  editTitleInput,
  sessionActionsDisabled,
  sessionActionsDisabledReason,
  sessionNotice,
  language,
  onNewChatClick,
  onSearchChange,
  onLoadSession,
  onStartEdit,
  onDeleteSession,
  onEditTitleInputChange,
  onEditInputClick,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onOpenSettings,
}: SidebarProps) => {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<ChatSession | null>(null);

  const visibleNotice = sessionNotice ?? sessionActionsDisabledReason;
  const deleteDescription = useMemo(() => {
    if (!pendingDeleteSession) {
      return '';
    }

    return t('sidebar.deleteConfirm.description').replace('{title}', pendingDeleteSession.title);
  }, [pendingDeleteSession]);

  const handleSessionItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, session: ChatSession, disabled: boolean) => {
      if (disabled) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onLoadSession(session);
    },
    [onLoadSession]
  );

  const handleRequestDeleteSession = useCallback(
    (event: MouseEvent, session: ChatSession) => {
      event.stopPropagation();
      if (sessionActionsDisabled) {
        return;
      }
      setPendingDeleteSession(session);
    },
    [sessionActionsDisabled]
  );

  const handleConfirmDeleteSession = useCallback(() => {
    if (!pendingDeleteSession || sessionActionsDisabled) {
      return;
    }

    onDeleteSession(pendingDeleteSession.id);
    setPendingDeleteSession(null);
  }, [onDeleteSession, pendingDeleteSession, sessionActionsDisabled]);

  const handleCancelDeleteSession = useCallback(() => {
    setPendingDeleteSession(null);
  }, []);

  const hasNoSessions = sessions.length === 0;
  const hasNoMatchingSessions = !hasNoSessions && filteredSessions.length === 0;

  return (
    <aside
      className="sidebar relative z-30 h-full w-64 border-r border-[var(--line-1)] bg-[var(--bg-1)]"
      data-language={language}
    >
      <div className="flex h-full flex-col px-3 py-4">
        <Button
          onClick={onNewChatClick}
          variant="primary"
          size="md"
          disabled={sessionActionsDisabled}
          title={sessionActionsDisabled ? (sessionActionsDisabledReason ?? undefined) : undefined}
          className="mb-4 flex h-10 w-full items-center justify-center gap-2 text-[var(--text-on-interactive)] hover:text-[var(--text-on-interactive)]"
        >
          <AddIcon size={16} strokeWidth={2} />
          <span className="tracking-[0.02em]">{t('sidebar.newChat')}</span>
        </Button>

        <div className="mb-3">
          <div className="relative group">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] group-focus-within:text-[var(--action-interactive)]"
              size={14}
              strokeWidth={2}
            />
            <Input
              type="text"
              placeholder={t('sidebar.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full pl-9 pr-3 py-0 text-sm"
            />
          </div>
        </div>

        {visibleNotice ? <div className={SIDEBAR_NOTICE_CLASS}>{visibleNotice}</div> : null}

        <div ref={listContainerRef} className="flex-1 overflow-y-auto">
          <div className="mb-2 px-2 text-[11px] font-normal uppercase tracking-[0.16em] text-[var(--ink-2)]">
            {t('sidebar.history')}
          </div>

          {hasNoSessions ? (
            <div className="px-2 py-2 text-sm text-[var(--ink-3)]">
              {t('sidebar.noConversations')}
            </div>
          ) : hasNoMatchingSessions ? (
            <div className="px-2 py-2 text-sm text-[var(--ink-3)]">{t('sidebar.noMatching')}</div>
          ) : (
            <div className="space-y-0.5">
              {filteredSessions.map((session) => {
                const isCurrentSession = currentSessionId === session.id;
                const isRowDisabled = sessionActionsDisabled && !isCurrentSession;

                return (
                  <div key={session.id}>
                    <div
                      onClick={() => {
                        if (!isRowDisabled) {
                          onLoadSession(session);
                        }
                      }}
                      onKeyDown={(event) => handleSessionItemKeyDown(event, session, isRowDisabled)}
                      role="button"
                      tabIndex={editingSessionId === session.id || isRowDisabled ? -1 : 0}
                      aria-disabled={isRowDisabled || undefined}
                      aria-current={
                        isCurrentSession && editingSessionId !== session.id ? 'page' : undefined
                      }
                      title={
                        isRowDisabled ? (sessionActionsDisabledReason ?? undefined) : undefined
                      }
                      className={`${SIDEBAR_SESSION_ROW_BASE_CLASS} ${
                        isCurrentSession && editingSessionId !== session.id
                          ? SIDEBAR_SESSION_ROW_ACTIVE_CLASS
                          : isRowDisabled
                            ? SIDEBAR_SESSION_ROW_DISABLED_CLASS
                            : SIDEBAR_SESSION_ROW_IDLE_CLASS
                      }`}
                    >
                      {editingSessionId === session.id ? (
                        <SessionEditor
                          editTitleInput={editTitleInput}
                          onEditTitleInputChange={onEditTitleInputChange}
                          onEditInputClick={onEditInputClick}
                          onEditKeyDown={onEditKeyDown}
                          onSaveEdit={onSaveEdit}
                          onCancelEdit={onCancelEdit}
                        />
                      ) : (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <ChatBubbleOutlineIcon
                              className="flex-shrink-0 text-[var(--ink-3)]"
                              size={14}
                              strokeWidth={2}
                            />
                            <span className="truncate font-normal tracking-[-0.01em]">
                              {session.title}
                            </span>
                          </div>
                          <SessionActions
                            session={session}
                            disabled={sessionActionsDisabled}
                            disabledReason={sessionActionsDisabledReason}
                            onStartEdit={onStartEdit}
                            onRequestDeleteSession={handleRequestDeleteSession}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-0.5">
          <Button
            onClick={onOpenSettings}
            variant="ghost"
            size="md"
            className={SIDEBAR_FOOTER_BUTTON_CLASS}
          >
            <SettingsOutlinedIcon size={16} strokeWidth={2} />
            <span className="tracking-[0.015em]">{t('sidebar.settings')}</span>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingDeleteSession}
        title={t('sidebar.deleteConfirm.title')}
        description={deleteDescription}
        confirmLabel={t('sidebar.deleteConfirm.confirm')}
        cancelLabel={t('settings.modal.cancel')}
        onConfirm={handleConfirmDeleteSession}
        onCancel={handleCancelDeleteSession}
        danger
      />
    </aside>
  );
};

const Sidebar = memo(SidebarComponent);
export default Sidebar;
