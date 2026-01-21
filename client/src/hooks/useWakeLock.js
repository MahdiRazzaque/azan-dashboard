import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Custom hook to manage the Screen Wake Lock API.
 * Prevents the screen from dimming or turning off.
 */
export const useWakeLock = () => {
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState(null);
    const sentinelRef = useRef(null);

    const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext;

    const request = useCallback(async () => {
        if (!isSupported) return;

        try {
            const sentinel = await navigator.wakeLock.request('screen');
            
            sentinel.addEventListener('release', () => {
                setIsActive(false);
                sentinelRef.current = null;
            });

            sentinelRef.current = sentinel;
            setIsActive(true);
            setError(null);
        } catch (err) {
            console.error('Wake Lock Request Error:', err);
            setIsActive(false);
            setError(err);
        }
    }, [isSupported]);

    const release = useCallback(async () => {
        if (sentinelRef.current) {
            try {
                await sentinelRef.current.release();
            } catch (err) {
                console.error('Wake Lock Release Error:', err);
            }
        }
    }, []);

    // Re-acquire lock on visibility change
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (isActive && document.visibilityState === 'visible' && !sentinelRef.current) {
                await request();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleVisibilityChange);
        };
    }, [isActive, request]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sentinelRef.current) {
                sentinelRef.current.release().catch(console.error);
            }
        };
    }, []);

    return useMemo(() => ({
        isSupported,
        isActive,
        error,
        request,
        release
    }), [isSupported, isActive, error, request, release]);
};
