import { useCallback, useEffect, useRef, useState } from 'react';
import { readSessionDraft, writeSessionDraft } from '@/presentation/components/chatInputHelpers';

type UseChatInputDraftProps = {
  sessionId: string;
  onSessionDraftRestored: (nextDraft: string) => void;
};

const DRAFT_SAVE_DELAY_MS = 350;

export const useChatInputDraft = ({
  sessionId,
  onSessionDraftRestored,
}: UseChatInputDraftProps) => {
  const [input, setInput] = useState(() => readSessionDraft(sessionId));
  const currentInputRef = useRef(input);
  const activeDraftSessionIdRef = useRef(sessionId);
  const draftSaveTimerRef = useRef<number | null>(null);

  const clearDraftTimer = useCallback(() => {
    if (draftSaveTimerRef.current === null) return;
    window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = null;
  }, []);

  const persistDraftNow = useCallback((targetSessionId: string, value: string) => {
    writeSessionDraft(targetSessionId, value);
  }, []);

  const persistDraft = useCallback(
    (value: string, targetSessionId: string = activeDraftSessionIdRef.current) => {
      clearDraftTimer();
      draftSaveTimerRef.current = window.setTimeout(() => {
        persistDraftNow(targetSessionId, value);
        clearDraftTimer();
      }, DRAFT_SAVE_DELAY_MS);
    },
    [clearDraftTimer, persistDraftNow]
  );

  const clearDraft = useCallback(() => {
    clearDraftTimer();
    persistDraftNow(activeDraftSessionIdRef.current, '');
  }, [clearDraftTimer, persistDraftNow]);

  useEffect(() => {
    currentInputRef.current = input;
  }, [input]);

  useEffect(
    () => () => {
      clearDraftTimer();
      persistDraftNow(activeDraftSessionIdRef.current, currentInputRef.current);
    },
    [clearDraftTimer, persistDraftNow]
  );

  useEffect(() => {
    const previousSessionId = activeDraftSessionIdRef.current;
    if (previousSessionId === sessionId) return;
    clearDraftTimer();
    persistDraftNow(previousSessionId, currentInputRef.current);
    activeDraftSessionIdRef.current = sessionId;
    const nextDraft = readSessionDraft(sessionId);
    setInput(nextDraft);
    currentInputRef.current = nextDraft;
    onSessionDraftRestored(nextDraft);
  }, [clearDraftTimer, onSessionDraftRestored, persistDraftNow, sessionId]);

  return {
    activeDraftSessionIdRef,
    clearDraft,
    currentInputRef,
    input,
    persistDraft,
    setInput,
  };
};
