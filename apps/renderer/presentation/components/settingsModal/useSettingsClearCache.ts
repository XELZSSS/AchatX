import { useCallback, useMemo, useState } from 'react';
import { t } from '@/shared/utils/i18n';
import {
  beginLocalDataReset,
  endLocalDataReset,
} from '@/infrastructure/persistence/localDataResetState';

type UseSettingsClearCacheOptions = {
  distribution: 'development' | 'portable' | 'installer';
  interactionLockReason: string | null;
  showClearCacheSuccess: (notice?: string) => void;
  showClearCacheError: () => void;
};

export const useSettingsClearCache = ({
  distribution,
  interactionLockReason,
  showClearCacheSuccess,
  showClearCacheError,
}: UseSettingsClearCacheOptions) => {
  const [isClearCacheConfirmOpen, setIsClearCacheConfirmOpen] = useState(false);
  const clearCacheConfirmDescription = useMemo(
    () =>
      distribution === 'portable'
        ? t('settings.clearCache.confirmPortable')
        : t('settings.clearCache.confirm'),
    [distribution]
  );

  const handleClearCache = useCallback(async () => {
    beginLocalDataReset();
    try {
      const resetLocalData = window.orlinx?.resetLocalData ?? window.orlinx?.clearCache;
      const result = await resetLocalData?.();
      if (result?.ok) {
        const nextAction =
          'action' in result ? result.action : result.relaunching ? 'relaunch' : undefined;
        showClearCacheSuccess(
          nextAction === 'exit'
            ? t('settings.clearCache.successPortable')
            : t('settings.clearCache.success')
        );
        return;
      }
      endLocalDataReset();
      showClearCacheError();
    } catch (error) {
      endLocalDataReset();
      console.error('Failed to reset local data:', error);
      showClearCacheError();
    }
  }, [showClearCacheError, showClearCacheSuccess]);

  const handleOpenClearCacheConfirm = useCallback(() => {
    if (!interactionLockReason) {
      setIsClearCacheConfirmOpen(true);
    }
  }, [interactionLockReason]);

  const handleCancelClearCache = useCallback(() => setIsClearCacheConfirmOpen(false), []);
  const handleConfirmClearCache = useCallback(() => {
    setIsClearCacheConfirmOpen(false);
    void handleClearCache();
  }, [handleClearCache]);

  return {
    clearCacheConfirmDescription,
    isClearCacheConfirmOpen,
    handleOpenClearCacheConfirm,
    handleCancelClearCache,
    handleConfirmClearCache,
  };
};

