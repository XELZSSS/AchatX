import { memo } from 'react';
import { t } from '@/shared/utils/i18n';
import { Field } from '@/shared/ui';
import { textareaClass } from '@/presentation/components/settingsModal/constants';
import { SettingsToggleRow } from '@/presentation/components/settingsModal/formParts';

type AgentTabProps = {
  enabled: boolean;
  promptParts: {
    identity: string;
    role: string;
    setting: string;
  };
  searchEnabled: boolean;
  supportsChatAgent?: boolean;
  supportsAgentSearch?: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onPromptPartChange: (key: 'identity' | 'role' | 'setting', value: string) => void;
  onToggleSearchEnabled: (enabled: boolean) => void;
};

const AgentTab = ({
  enabled,
  promptParts,
  searchEnabled,
  supportsChatAgent,
  supportsAgentSearch,
  onToggleEnabled,
  onPromptPartChange,
  onToggleSearchEnabled,
}: AgentTabProps) => {
  if (!supportsChatAgent) {
    return (
      <div className="space-y-4">
        <Field label={t('settings.modal.agent.title')}>
          <div className="text-xs text-[var(--ink-3)]">{t('settings.modal.agent.unsupported')}</div>
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label={t('settings.modal.agent.title')}>
        <SettingsToggleRow checked={enabled} onCheckedChange={onToggleEnabled} />
      </Field>

      {supportsAgentSearch ? (
        <Field label={t('settings.modal.agent.search.title')}>
          <SettingsToggleRow
            checked={searchEnabled}
            disabled={!enabled}
            onCheckedChange={onToggleSearchEnabled}
          />
        </Field>
      ) : null}

      <Field label={t('settings.modal.agent.identity')}>
        <textarea
          value={promptParts.identity}
          onChange={(event) => onPromptPartChange('identity', event.target.value)}
          rows={3}
          className={textareaClass}
        />
      </Field>

      <Field label={t('settings.modal.agent.role')}>
        <textarea
          value={promptParts.role}
          onChange={(event) => onPromptPartChange('role', event.target.value)}
          rows={3}
          className={textareaClass}
        />
      </Field>

      <Field label={t('settings.modal.agent.setting')}>
        <textarea
          value={promptParts.setting}
          onChange={(event) => onPromptPartChange('setting', event.target.value)}
          rows={4}
          className={textareaClass}
        />
      </Field>
    </div>
  );
};

export default memo(AgentTab);
