export type GeminiCliAuthStatus = {
  authenticated: boolean;
  email?: string;
  expiresAt?: number;
  projectId?: string;
};

export type GeminiCliAuthSession = GeminiCliAuthStatus & {
  accessToken: string;
};

const UNAUTHENTICATED_STATUS: GeminiCliAuthStatus = {
  authenticated: false,
};

export const getGeminiCliAuthStatus = async (): Promise<GeminiCliAuthStatus> => {
  try {
    return (await window.orlinx?.getGeminiCliAuthStatus?.()) ?? UNAUTHENTICATED_STATUS;
  } catch (error) {
    console.error('Failed to read Gemini CLI auth status:', error);
    return UNAUTHENTICATED_STATUS;
  }
};

export const getGeminiCliAuthSession = async (): Promise<GeminiCliAuthSession | null> => {
  try {
    return (await window.orlinx?.getGeminiCliAuthSession?.()) ?? null;
  } catch (error) {
    console.error('Failed to read Gemini CLI auth session:', error);
    return null;
  }
};

export const loginGeminiCliAuth = async (): Promise<GeminiCliAuthStatus> => {
  const status = await window.orlinx?.loginGeminiCliAuth?.();
  return status ?? UNAUTHENTICATED_STATUS;
};

export const logoutGeminiCliAuth = async (): Promise<GeminiCliAuthStatus> => {
  const status = await window.orlinx?.logoutGeminiCliAuth?.();
  return status ?? UNAUTHENTICATED_STATUS;
};

