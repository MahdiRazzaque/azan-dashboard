import { useEffect, useRef, useState } from 'react';

/**
 * Loads output strategies from the backend and exposes loading/error state.
 *
 * @param {object} [options] - Hook options.
 * @param {boolean} [options.enabled=true] - Whether the request should run.
 * @param {(strategies: Array<object>) => Array<object>} [options.select] - Optional mapper/filter.
 * @returns {{ strategies: Array<object>, loading: boolean, error: string|null }} Hook state.
 */
export function useOutputStrategies({ enabled = true, select } = {}) {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const selectRef = useRef(select);

  useEffect(() => {
    selectRef.current = select;
  }, [select]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    const abortController = new AbortController();

    const loadStrategies = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/system/outputs/registry', {
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error('Failed to fetch strategies');
        }

        const data = await response.json();
        setStrategies(selectRef.current ? selectRef.current(data) : data);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          return;
        }

        console.error(fetchError);
        setError(fetchError.message);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadStrategies();

    return () => abortController.abort();
  }, [enabled]);

  return { strategies, loading, error };
}
