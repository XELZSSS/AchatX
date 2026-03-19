import { useCallback, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ChatSession } from '@/shared/types/chat';
import { updateSessionTitle } from '@/infrastructure/persistence/sessionStore';

type UseSessionTitleEditingOptions = {
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
};

export const useSessionTitleEditing = ({ setSessions }: UseSessionTitleEditingOptions) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const resetEditState = useCallback(() => {
    setEditingSessionId(null);
    setEditTitleInput('');
  }, []);

  const handleStartEdit = useCallback((event: MouseEvent, session: ChatSession) => {
    event.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleInput(session.title);
  }, []);

  const handleCancelEdit = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      resetEditState();
    },
    [resetEditState]
  );

  const commitTitleEdit = useCallback(() => {
    const nextTitle = editTitleInput.trim();
    if (!editingSessionId || !nextTitle) {
      return;
    }

    void (async () => {
      try {
        const updated = await updateSessionTitle(editingSessionId, nextTitle);
        setSessions(updated);
        resetEditState();
      } catch (error) {
        console.error(`Failed to rename session "${editingSessionId}":`, error);
      }
    })();
  }, [editTitleInput, editingSessionId, resetEditState, setSessions]);

  const handleSaveEdit = useCallback(
    (event: FormEvent | MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      commitTitleEdit();
    },
    [commitTitleEdit]
  );

  const handleEditInputClick = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commitTitleEdit();
      } else if (event.key === 'Escape') {
        resetEditState();
      }
    },
    [commitTitleEdit, resetEditState]
  );

  return {
    editingSessionId,
    editTitleInput,
    setEditTitleInput,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditInputClick,
    handleEditKeyDown,
    resetEditState,
  };
};
