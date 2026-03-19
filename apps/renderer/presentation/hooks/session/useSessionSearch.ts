import { useEffect, useMemo, useState } from 'react';
import type { ChatSession } from '@/shared/types/chat';
import { searchSessionSummaries } from '@/infrastructure/persistence/sessionStore';

type UseSessionSearchOptions = {
  sessionSummaries: ChatSession[];
};

export const useSessionSearch = ({ sessionSummaries }: UseSessionSearchOptions) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    query: string;
    sessions: ChatSession[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = searchQuery.trim();
    const queryLower = query.toLowerCase();

    if (!query) {
      return () => {
        cancelled = true;
      };
    }

    const fallbackByTitle = () =>
      sessionSummaries.filter((session) => session.title.toLowerCase().includes(queryLower));

    void (async () => {
      try {
        const results = await searchSessionSummaries(query, 200);
        if (!cancelled) {
          setSearchResult({ query, sessions: results });
        }
      } catch (error) {
        console.error('Failed to search sessions:', error);
        if (!cancelled) {
          setSearchResult({ query, sessions: fallbackByTitle() });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, sessionSummaries]);

  const normalizedQuery = searchQuery.toLowerCase();

  const filteredSessions = useMemo(() => {
    if (!normalizedQuery) {
      return sessionSummaries;
    }

    const matchingSearchResult =
      searchResult && searchResult.query.toLowerCase() === normalizedQuery
        ? searchResult.sessions
        : null;

    if (!matchingSearchResult) {
      return sessionSummaries.filter((session) =>
        session.title.toLowerCase().includes(normalizedQuery)
      );
    }

    const sessionsById = new Map(sessionSummaries.map((session) => [session.id, session] as const));

    return matchingSearchResult.flatMap((session) => {
      const latestSession = sessionsById.get(session.id);
      return latestSession ? [latestSession] : [];
    });
  }, [normalizedQuery, searchResult, sessionSummaries]);

  return {
    searchQuery,
    setSearchQuery,
    filteredSessions,
  };
};
