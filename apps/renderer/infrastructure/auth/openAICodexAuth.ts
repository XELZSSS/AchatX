export type OpenAICodexAuthStatus = {
  authenticated: boolean;
  accountId?: string;
  expiresAt?: number;
};

export type OpenAICodexAuthSession = OpenAICodexAuthStatus & {
  accessToken: string;
};

const UNAUTHENTICATED_STATUS: OpenAICodexAuthStatus = {
  authenticated: false,
};

export const getOpenAICodexAuthStatus = async (): Promise<OpenAICodexAuthStatus> => {
  try {
    return (await window.orlinx?.getOpenAICodexAuthStatus?.()) ?? UNAUTHENTICATED_STATUS;
  } catch (error) {
    console.error('Failed to read OpenAI Codex auth status:', error);
    return UNAUTHENTICATED_STATUS;
  }
};

export const getOpenAICodexAuthSession = async (): Promise<OpenAICodexAuthSession | null> => {
  try {
    return (await window.orlinx?.getOpenAICodexAuthSession?.()) ?? null;
  } catch (error) {
    console.error('Failed to read OpenAI Codex auth session:', error);
    return null;
  }
};

export const loginOpenAICodexAuth = async (): Promise<OpenAICodexAuthStatus> => {
  const status = await window.orlinx?.loginOpenAICodexAuth?.();
  return status ?? UNAUTHENTICATED_STATUS;
};

export const logoutOpenAICodexAuth = async (): Promise<OpenAICodexAuthStatus> => {
  const status = await window.orlinx?.logoutOpenAICodexAuth?.();
  return status ?? UNAUTHENTICATED_STATUS;
};

