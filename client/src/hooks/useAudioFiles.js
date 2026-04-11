import { useEffect, useRef, useState } from 'react';

/**
 * Loads audio files from the backend and exposes loading/error state.
 *
 * @param {object} [options] - Hook options.
 * @param {boolean} [options.enabled=true] - Whether the request should run.
 * @param {(files: Array<object>) => Array<object>} [options.select] - Optional mapper/filter.
 * @returns {{ files: Array<object>, loading: boolean, error: string|null, setFiles: Function }} Hook state.
 */
export function useAudioFiles({ enabled = true, select } = {}) {
  const [files, setFiles] = useState([]);
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

    const loadFiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/system/audio-files', {
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error('Failed to load audio files');
        }

        const data = await response.json();
        const nextFiles = data.files || [];
        setFiles(selectRef.current ? selectRef.current(nextFiles) : nextFiles);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          return;
        }

        console.error('Failed to load files:', fetchError);
        setError(fetchError.message);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFiles();

    return () => abortController.abort();
  }, [enabled]);

  return { files, loading, error, setFiles };
}
