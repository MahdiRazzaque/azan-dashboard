import { useState, useEffect, useCallback } from 'react';

export const usePrayerTimes = () => {
    const [prayers, setPrayers] = useState({});
    const [nextPrayer, setNextPrayer] = useState(null);
    const [meta, setMeta] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPrayers = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const res = await fetch('/api/prayers');
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data = await res.json();
            
            setPrayers(data.prayers || {});
            setNextPrayer(data.nextPrayer);
            setMeta(data.meta || {});
            setError(null);
        } catch (err) {
            console.error("Prayer Times Fetch Error:", err);
            setError(err.message);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPrayers(true);
        const interval = setInterval(() => fetchPrayers(false), 15 * 60 * 1000); // 15 mins
        return () => clearInterval(interval);
    }, [fetchPrayers]);

    return { prayers, nextPrayer, meta, loading, error, refetch: () => fetchPrayers(false) };
};
