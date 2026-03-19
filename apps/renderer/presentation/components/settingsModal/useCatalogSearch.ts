import { useCallback, useState } from 'react';

type SearchStatusTone = 'default' | 'success' | 'error';

type CatalogSearchResult<T> = {
  connectors: T[];
};

type UseCatalogSearchOptions<T> = {
  load: (query: string) => Promise<CatalogSearchResult<T>>;
  missingQueryText: string;
  searchingText: string;
  loadedText: string;
  noResultsText: string;
  failedText: string;
  validate?: () => string | null;
};

const formatCountTemplate = (template: string, count: number): string => {
  return template.replace('{count}', String(count));
};

export const useCatalogSearch = <T>({
  load,
  missingQueryText,
  searchingText,
  loadedText,
  noResultsText,
  failedText,
  validate,
}: UseCatalogSearchOptions<T>) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [statusText, setStatusText] = useState('');
  const [statusTone, setStatusTone] = useState<SearchStatusTone>('default');
  const [isSearching, setIsSearching] = useState(false);

  const resetStatus = useCallback(() => {
    setStatusText('');
    setStatusTone('default');
  }, []);

  const search = useCallback(async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setStatusText(missingQueryText);
      setStatusTone('error');
      return;
    }

    const validationError = validate?.();
    if (validationError) {
      setResults([]);
      setStatusText(validationError);
      setStatusTone('error');
      return;
    }

    setIsSearching(true);
    setStatusText(searchingText);
    setStatusTone('default');

    try {
      const result = await load(normalizedQuery);
      setResults(result.connectors);
      setStatusText(
        result.connectors.length
          ? formatCountTemplate(loadedText, result.connectors.length)
          : noResultsText
      );
      setStatusTone(result.connectors.length ? 'success' : 'default');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResults([]);
      setStatusText(`${failedText}: ${message}`);
      setStatusTone('error');
    } finally {
      setIsSearching(false);
    }
  }, [
    failedText,
    load,
    loadedText,
    missingQueryText,
    noResultsText,
    query,
    searchingText,
    validate,
  ]);

  return {
    query,
    results,
    statusText,
    statusTone,
    isSearching,
    setQuery,
    resetStatus,
    search,
  };
};
