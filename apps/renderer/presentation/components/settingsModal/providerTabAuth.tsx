import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/shared/utils/i18n';
import { Button, Field } from '@/shared/ui';
import {
  getOpenAICodexAuthStatus,
  loginOpenAICodexAuth,
  logoutOpenAICodexAuth,
  type OpenAICodexAuthStatus,
} from '@/infrastructure/auth/openAICodexAuth';
import {
  getGeminiCliAuthStatus,
  loginGeminiCliAuth,
  logoutGeminiCliAuth,
  type GeminiCliAuthStatus,
} from '@/infrastructure/auth/geminiCliAuth';
import type {
  GeminiCliAuthCardProps,
  OpenAICodexAuthCardProps,
} from '@/presentation/components/settingsModal/providerTab.types';

const AUTH_CARD_CLASS = 'space-y-3 rounded-xl border border-[var(--line-1)] bg-[var(--bg-2)] p-3';
const UNAUTHENTICATED_OPENAI_CODEX_AUTH_STATUS: OpenAICodexAuthStatus = { authenticated: false };
const UNAUTHENTICATED_GEMINI_CLI_AUTH_STATUS: GeminiCliAuthStatus = { authenticated: false };

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : t('error.generic');

const useProviderAuthState = <TStatus extends { authenticated: boolean }>(
  enabled: boolean,
  fallbackStatus: TStatus,
  loadStatus: () => Promise<TStatus>,
  loginAction: () => Promise<TStatus>,
  logoutAction: () => Promise<TStatus>,
  loadErrorMessage: string,
  loginErrorMessage: string,
  logoutErrorMessage: string
) => {
  const [authStatus, setAuthStatus] = useState<TStatus>(fallbackStatus);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const authActionSequenceRef = useRef(0);

  const runAuthAction = useCallback(
    async (action: () => Promise<TStatus>, errorMessage: string, nextFallback?: TStatus) => {
      if (!enabled) return;
      const actionSequence = authActionSequenceRef.current + 1;
      authActionSequenceRef.current = actionSequence;
      setAuthBusy(true);
      try {
        const nextStatus = await action();
        if (authActionSequenceRef.current !== actionSequence) {
          return;
        }
        setAuthStatus(nextStatus);
        setAuthError('');
      } catch (error) {
        if (authActionSequenceRef.current !== actionSequence) {
          return;
        }
        console.error(errorMessage, error);
        if (nextFallback) {
          setAuthStatus(nextFallback);
        }
        setAuthError(getErrorMessage(error));
      } finally {
        if (authActionSequenceRef.current === actionSequence) {
          setAuthBusy(false);
        }
      }
    },
    [enabled]
  );

  const refreshAuthStatus = useCallback(
    () => runAuthAction(loadStatus, loadErrorMessage, fallbackStatus),
    [fallbackStatus, loadErrorMessage, loadStatus, runAuthAction]
  );
  const login = useCallback(
    () => runAuthAction(loginAction, loginErrorMessage),
    [loginAction, loginErrorMessage, runAuthAction]
  );
  const logout = useCallback(
    () => runAuthAction(logoutAction, logoutErrorMessage),
    [logoutAction, logoutErrorMessage, runAuthAction]
  );

  useEffect(() => {
    if (!enabled) {
      authActionSequenceRef.current += 1;
      setAuthStatus(fallbackStatus);
      setAuthBusy(false);
      setAuthError('');
      return;
    }
    void refreshAuthStatus();
  }, [enabled, fallbackStatus, refreshAuthStatus]);

  return { authBusy, authError, authStatus, login, logout, refreshAuthStatus };
};

export const useOpenAICodexAuthState = (enabled: boolean) =>
  useProviderAuthState<OpenAICodexAuthStatus>(
    enabled,
    UNAUTHENTICATED_OPENAI_CODEX_AUTH_STATUS,
    getOpenAICodexAuthStatus,
    loginOpenAICodexAuth,
    logoutOpenAICodexAuth,
    'Failed to load OpenAI Codex auth status:',
    'OpenAI Codex login failed:',
    'OpenAI Codex logout failed:'
  );

export const useGeminiCliAuthState = (enabled: boolean) =>
  useProviderAuthState<GeminiCliAuthStatus>(
    enabled,
    UNAUTHENTICATED_GEMINI_CLI_AUTH_STATUS,
    getGeminiCliAuthStatus,
    loginGeminiCliAuth,
    logoutGeminiCliAuth,
    'Failed to load Gemini CLI auth status:',
    'Gemini CLI login failed:',
    'Gemini CLI logout failed:'
  );

export const OpenAICodexAuthCard = ({
  authBusy,
  authError,
  authStatus,
  onLogin,
  onLogout,
  onRefresh,
}: OpenAICodexAuthCardProps) => {
  const authStatusLabel = authBusy
    ? t('settings.modal.openaiCodexAuth.loading')
    : authStatus.authenticated
      ? t('settings.modal.openaiCodexAuth.connected')
      : t('settings.modal.openaiCodexAuth.disconnected');

  return (
    <Field label={t('settings.modal.openaiCodexAuth.title')}>
      <div className={AUTH_CARD_CLASS}>
        <div className="space-y-1">
          <div className="text-sm font-medium text-[var(--ink-1)]">{authStatusLabel}</div>
          {authError ? <div className="text-xs text-[var(--status-error)]">{authError}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onLogin} variant="primary" size="sm" disabled={authBusy}>
            {t('settings.modal.openaiCodexAuth.signIn')}
          </Button>
          <Button
            onClick={onLogout}
            variant="ghost"
            size="sm"
            disabled={authBusy || !authStatus.authenticated}
          >
            {t('settings.modal.openaiCodexAuth.signOut')}
          </Button>
          <Button onClick={onRefresh} variant="ghost" size="sm" disabled={authBusy}>
            {t('settings.modal.openaiCodexAuth.refresh')}
          </Button>
        </div>
      </div>
    </Field>
  );
};

export const GeminiCliAuthCard = ({
  authBusy,
  authError,
  authStatus,
  canOpenLocalConfig,
  canOpenCredentialPage,
  onLogin,
  onLogout,
  onOpenLocalConfig,
  onOpenCredentialPage,
  onRefresh,
}: GeminiCliAuthCardProps) => {
  const authStatusLabel = authBusy
    ? t('settings.modal.geminiCliAuth.loading')
    : authStatus.authenticated
      ? t('settings.modal.geminiCliAuth.connected')
      : t('settings.modal.geminiCliAuth.disconnected');

  return (
    <Field label={t('settings.modal.geminiCliAuth.title')}>
      <div className={AUTH_CARD_CLASS}>
        <div className="space-y-1">
          <div className="text-sm font-medium text-[var(--ink-1)]">{authStatusLabel}</div>
          {authError ? <div className="text-xs text-[var(--status-error)]">{authError}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onLogin} variant="primary" size="sm" disabled={authBusy}>
            {t('settings.modal.geminiCliAuth.signIn')}
          </Button>
          <Button
            onClick={onLogout}
            variant="ghost"
            size="sm"
            disabled={authBusy || !authStatus.authenticated}
          >
            {t('settings.modal.geminiCliAuth.signOut')}
          </Button>
          <Button onClick={onRefresh} variant="ghost" size="sm" disabled={authBusy}>
            {t('settings.modal.geminiCliAuth.refresh')}
          </Button>
          <Button
            onClick={onOpenLocalConfig}
            variant="ghost"
            size="sm"
            disabled={authBusy || !canOpenLocalConfig}
          >
            {t('settings.modal.geminiCliAuth.openLocalConfig')}
          </Button>
          <Button
            onClick={onOpenCredentialPage}
            variant="ghost"
            size="sm"
            disabled={authBusy || !canOpenCredentialPage}
          >
            {t('settings.modal.geminiCliAuth.openCredentialPage')}
          </Button>
        </div>
      </div>
    </Field>
  );
};
