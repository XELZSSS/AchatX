export type UpdaterStatus = {
  status:
    | 'idle'
    | 'disabled'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'redirecting'
    | 'not-available'
    | 'error';
  distribution: 'development' | 'portable' | 'installer';
  message: string;
  version: string;
  availableVersion: string;
  error: string;
  downloadUrl?: string;
};

export const DEFAULT_UPDATER_STATUS: UpdaterStatus = {
  status: 'idle',
  distribution: 'development',
  message: '',
  version: '',
  availableVersion: '',
  error: '',
  downloadUrl: '',
};

export const getUpdaterStatus = async (): Promise<UpdaterStatus> => {
  const status = await window.orlinx?.getUpdaterStatus?.();
  return status ?? DEFAULT_UPDATER_STATUS;
};

export const subscribeUpdaterStatus = (callback: (status: UpdaterStatus) => void): (() => void) => {
  return window.orlinx?.onUpdaterStatus?.(callback as (status: unknown) => void) ?? (() => {});
};

export const checkForUpdates = async (): Promise<void> => {
  await window.orlinx?.checkForUpdates?.();
};

export const openUpdateDownload = async (): Promise<void> => {
  await window.orlinx?.openUpdateDownload?.();
};

