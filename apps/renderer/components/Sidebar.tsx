import React, { useRef } from 'react';
import { Trash2, Settings, Search, Edit2, Check, X, Plus, Globe, Sun, Moon, MessageSquare } from 'lucide-react';
import { ChatSession } from '../types';
import { Language, t } from '../utils/i18n';
import { Theme } from '../utils/theme';
import { Button, IconButton, Input } from './ui';

type SidebarProps = {
  currentSessionId: string;
  sessions: ChatSession[];
  filteredSessions: ChatSession[];
  searchQuery: string;
  editingSessionId: string | null;
  editTitleInput: string;
  language: Language;
  theme: Theme;
  onNewChatClick: () => void;
  onSearchChange: (value: string) => void;
  onLoadSession: (session: ChatSession) => void;
  onStartEdit: (e: React.MouseEvent, session: ChatSession) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onEditTitleInputChange: (value: string) => void;
  onEditInputClick: (e: React.MouseEvent) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onSaveEdit: (e: React.FormEvent | React.MouseEvent) => void;
  onCancelEdit: (e: React.MouseEvent) => void;
  onThemeToggle: () => void;
  onLanguageChange: (nextLanguage: Language) => void;
  onOpenSettings: () => void;
};

const SidebarComponent: React.FC<SidebarProps> = ({
  currentSessionId,
  sessions,
  filteredSessions,
  searchQuery,
  editingSessionId,
  editTitleInput,
  language,
  theme,
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
  onThemeToggle,
  onLanguageChange,
  onOpenSettings,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);

  const handleSessionItemKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    session: ChatSession
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onLoadSession(session);
  };

  return (
    <aside className="sidebar relative z-30 w-72 h-full bg-[var(--bg-1)] border-r border-[var(--line-1)]">
      <div className="flex flex-col h-full p-4">
        <Button
          onClick={onNewChatClick}
          variant="primary"
          size="md"
          className="w-full flex items-center justify-center gap-2 !py-2 mb-4"
        >
          <Plus size={16} />
          <span>{t('sidebar.newChat')}</span>
        </Button>

        <div className="mb-3">
          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--ink-3)] group-focus-within:text-[var(--ink-2)] transition-colors"
              size={14}
            />
            <Input
              type="text"
              placeholder=""
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full !pl-9 !pr-3 !py-2 text-sm"
            />
          </div>
        </div>

        <div ref={listContainerRef} className="flex-1 overflow-y-auto">
          <div className="text-[10px] font-medium text-[var(--ink-3)] uppercase tracking-wide mb-2 px-2">
            {t('sidebar.history')}
          </div>

          {sessions.length === 0 ? (
            <div className="px-2 py-2 text-sm text-[var(--ink-3)]">
              {t('sidebar.noConversations')}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-2 py-2 text-sm text-[var(--ink-3)]">
              {t('sidebar.noMatching')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredSessions.map((session) => (
                <div key={session.id}>
                  <div
                    onClick={() => onLoadSession(session)}
                    onKeyDown={(event) => handleSessionItemKeyDown(event, session)}
                    role="button"
                    tabIndex={editingSessionId === session.id ? -1 : 0}
                    aria-current={
                      currentSessionId === session.id && editingSessionId !== session.id
                        ? 'page'
                        : undefined
                    }
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors duration-160 ease-out text-sm ${
                      currentSessionId === session.id && editingSessionId !== session.id
                        ? 'bg-[var(--bg-2)] text-[var(--ink-1)]'
                        : 'text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)]'
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      <div className="flex items-center gap-1 w-full" onClick={onEditInputClick}>
                        <Input
                          type="text"
                          autoFocus
                          value={editTitleInput}
                          onChange={(e) => onEditTitleInputChange(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          className="flex-1 !text-xs !px-2 !py-1.5"
                          compact
                        />
                        <IconButton
                          onClick={onSaveEdit}
                          className="!h-6 !w-6 !ring-0 !bg-transparent hover:!bg-[var(--bg-2)]"
                          aria-label={t('settings.modal.save')}
                          title={t('settings.modal.save')}
                        >
                          <Check size={14} />
                        </IconButton>
                        <IconButton
                          onClick={onCancelEdit}
                          danger
                          className="!h-6 !w-6 !ring-0 !bg-transparent hover:!bg-[var(--bg-2)]"
                          aria-label={t('settings.modal.cancel')}
                          title={t('settings.modal.cancel')}
                        >
                          <X size={14} />
                        </IconButton>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 truncate flex-1">
                          <MessageSquare size={14} className="flex-shrink-0 text-[var(--ink-3)]" />
                          <span className="truncate">{session.title}</span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-160 ease-out">
                          <IconButton
                            onClick={(e) => onStartEdit(e, session)}
                            className="!h-7 !w-7 !ring-0 !bg-transparent hover:!bg-[var(--bg-2)]"
                            aria-label={t('sidebar.editTitle')}
                            title={t('sidebar.editTitle')}
                          >
                            <Edit2 size={13} />
                          </IconButton>
                          <IconButton
                            onClick={(e) => onDeleteSession(e, session.id)}
                            danger
                            className="!h-7 !w-7 !ring-0 !bg-transparent hover:!bg-[var(--bg-2)]"
                            aria-label={t('sidebar.deleteTitle')}
                            title={t('sidebar.deleteTitle')}
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-0.5">
          <Button
            onClick={() => onLanguageChange(language === 'en' ? 'zh-CN' : 'en')}
            variant="ghost"
            size="md"
            className="flex items-center gap-3 text-sm w-full justify-start !bg-transparent hover:!bg-[var(--bg-2)]"
          >
            <Globe size={16} />
            <span>{language === 'en' ? t('language.en') : t('language.zhCN')}</span>
          </Button>
          <Button
            onClick={onThemeToggle}
            variant="ghost"
            size="md"
            className="flex items-center gap-3 text-sm w-full justify-start !bg-transparent hover:!bg-[var(--bg-2)]"
            aria-label={t('sidebar.toggleTheme')}
            title={t('sidebar.toggleTheme')}
          >
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'dark' ? t('theme.dark') : t('theme.light')}</span>
          </Button>
          <Button
            onClick={onOpenSettings}
            variant="ghost"
            size="md"
            className="flex items-center gap-3 text-sm w-full justify-start !bg-transparent hover:!bg-[var(--bg-2)]"
          >
            <Settings size={16} />
            <span>{t('sidebar.settings')}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};

const Sidebar = React.memo(SidebarComponent);
export default Sidebar;