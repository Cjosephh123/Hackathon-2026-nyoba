import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async function on mount and exposes { data, loading, error, reload }.
 * Existing data is kept while reloading, so the UI doesn't flash empty.
 */
export default function useAsyncData(fetcher) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  const requestId = useRef(0);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === requestId.current) {
        setState((prev) => ({ ...prev, loading: false, error: err.message || 'Something went wrong.' }));
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
