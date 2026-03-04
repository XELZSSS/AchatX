import { useEffect, useState } from 'react';
import { ChatService } from '../../../services/chatService';
import { readAppStorage, writeAppStorage } from '../../../services/storageKeys';

type UseSearchToggleOptions = {
  chatService: ChatService;
  tavilyAvailable: boolean;
  currentProviderId: string;
};

export const useSearchToggle = ({
  chatService,
  tavilyAvailable,
  currentProviderId,
}: UseSearchToggleOptions) => {
  const [searchEnabled, setSearchEnabled] = useState(
    () => readAppStorage('searchEnabled') !== 'false'
  );

  useEffect(() => {
    if (!tavilyAvailable && searchEnabled) {
      setSearchEnabled(false);
      return;
    }

    const nextEnabled = tavilyAvailable ? searchEnabled : false;
    chatService.setSearchEnabled(nextEnabled);
    writeAppStorage('searchEnabled', String(nextEnabled));
  }, [chatService, currentProviderId, searchEnabled, tavilyAvailable]);

  return { searchEnabled, setSearchEnabled };
};
