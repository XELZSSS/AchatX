import { useCallback, useEffect, useState } from 'react';
import type { SetStateAction } from 'react';
import type { ChatService } from '@/application/chat/chatService';
import { readAppStorage, writeAppStorage } from '@/infrastructure/persistence/storageKeys';

type UseReasoningToggleOptions = {
  chatService: ChatService;
  currentProviderId: string;
};

const REASONING_ENABLED_STORAGE_KEY = 'reasoningEnabled';

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

const readPersistedReasoningEnabled = (providerId: string): boolean => {
  const stored = readAppStorage(REASONING_ENABLED_STORAGE_KEY);
  const toggleMap = parseStoredToggleMap(stored);
  return toggleMap?.[providerId] ?? false;
};

const persistReasoningEnabled = (providerId: string, enabled: boolean): void => {
  const toggleMap = parseStoredToggleMap(readAppStorage(REASONING_ENABLED_STORAGE_KEY)) ?? {};
  writeAppStorage(
    REASONING_ENABLED_STORAGE_KEY,
    JSON.stringify({ ...toggleMap, [providerId]: enabled })
  );
};

export const useReasoningToggle = ({
  chatService,
  currentProviderId,
}: UseReasoningToggleOptions) => {
  const [reasoningEnabled, setReasoningEnabledState] = useState(() =>
    readPersistedReasoningEnabled(currentProviderId)
  );

  useEffect(() => {
    setReasoningEnabledState(readPersistedReasoningEnabled(currentProviderId));
  }, [currentProviderId]);

  const setReasoningEnabled = useCallback(
    (value: SetStateAction<boolean>) => {
      setReasoningEnabledState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        persistReasoningEnabled(currentProviderId, next);
        chatService.setReasoningEnabled(next);
        return next;
      });
    },
    [chatService, currentProviderId]
  );

  useEffect(() => {
    chatService.setReasoningEnabled(reasoningEnabled);
  }, [chatService, currentProviderId, reasoningEnabled]);

  return { reasoningEnabled, setReasoningEnabled };
};
