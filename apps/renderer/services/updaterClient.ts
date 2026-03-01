export type UpdaterStatus = {
  status: 'idle' | 'disabled' | 'checking' | 'available' | 'not-available' | 'error';
  message: string;
  version: string;
  availableVersion: string;
  error: string;
  downloadUrl?: string;
};

export const DEFAULT_UPDATER_STATUS: UpdaterStatus = {
  status: 'idle',
  message: '',
  version: '',
  availableVersion: '',
  error: '',
  downloadUrl: '',
};

export const getUpdaterStatus = async (): Promise<UpdaterStatus> => {
  const status = await window.gero?.getUpdaterStatus?.();
  return status ?? DEFAULT_UPDATER_STATUS;
};

export const subscribeUpdaterStatus = (callback: (status: UpdaterStatus) => void): (() => void) => {
  return window.gero?.onUpdaterStatus?.(callback as (status: unknown) => void) ?? (() => {});
};

export const checkForUpdates = async (): Promise<void> => {
  await window.gero?.checkForUpdates?.();
};

export const openUpdateDownload = async (): Promise<void> => {
  await window.gero?.quitAndInstallUpdate?.();
};
