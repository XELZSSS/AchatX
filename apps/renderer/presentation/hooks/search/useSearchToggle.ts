import { useCallback, useEffect, useState } from 'react';
import type { SetStateAction } from 'react';
import type { ChatService } from '@/application/chat/chatService';
import { readAppStorage, writeAppStorage } from '@/infrastructure/persistence/storageKeys';

type UseSearchToggleOptions = {
  chatService: ChatService;
  tavilyAvailable: boolean;
  currentProviderId: string;
};

const SEARCH_ENABLED_STORAGE_KEY = 'searchEnabled';

type ProviderToggleMap = Record<string, boolean>;

const parseStoredToggleMap = (value: string | null): ProviderToggleMap | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'boolean'
      )
    );
  } catch {
    return null;
  }
};

const readPersistedSearchEnabled = (providerId: string): boolean => {
  const stored = readAppStorage(SEARCH_ENABLED_STORAGE_KEY);
  const toggleMap = parseStoredToggleMap(stored);
  return toggleMap?.[providerId] ?? true;
};

const persistSearchEnabled = (providerId: string, enabled: boolean): void => {
  const toggleMap = parseStoredToggleMap(readAppStorage(SEARCH_ENABLED_STORAGE_KEY)) ?? {};
  writeAppStorage(
    SEARCH_ENABLED_STORAGE_KEY,
    JSON.stringify({ ...toggleMap, [providerId]: enabled })
  );
};

const resolveRuntimeSearchEnabled = (searchEnabled: boolean, tavilyAvailable: boolean): boolean => {
  return tavilyAvailable ? searchEnabled : false;
};

export const useSearchToggle = ({
  chatService,
  tavilyAvailable,
  currentProviderId,
}: UseSearchToggleOptions) => {
  const [preferredSearchEnabled, setSearchEnabledState] = useState(() =>
    readPersistedSearchEnabled(currentProviderId)
  );

  useEffect(() => {
    setSearchEnabledState(readPersistedSearchEnabled(currentProviderId));
  }, [currentProviderId]);

  const setSearchEnabled = useCallback(
    (value: SetStateAction<boolean>) => {
      setSearchEnabledState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        persistSearchEnabled(currentProviderId, next);
        return next;
      });
    },
    [currentProviderId]
  );

  const searchEnabled = resolveRuntimeSearchEnabled(preferredSearchEnabled, tavilyAvailable);

  useEffect(() => {
    chatService.setSearchEnabled(searchEnabled);
  }, [chatService, currentProviderId, searchEnabled]);

  return { searchEnabled, setSearchEnabled };
};
