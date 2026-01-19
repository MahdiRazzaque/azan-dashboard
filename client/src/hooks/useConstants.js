import { useState, useEffect } from 'react';

/**
 * A custom hook that fetches and manages system-wide constants, such as 
 * prayer calculation methods, madhabs, and adjustment modes.
 *
 * @returns {object} An object containing the constants, loading state, and any error encountered.
 */
export function useConstants() {
    const [constants, setConstants] = useState({
        calculationMethods: [],
        madhabs: [],
        latitudeAdjustments: [],
        midnightModes: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchConstants = async () => {
            try {
                // Assuming auth token is handled by a global interceptor or proxy
                // If not, we might need to use a dedicated fetch client
                const res = await fetch('/api/system/constants'); 
                if (!res.ok) throw new Error('Failed to fetch constants');
                const data = await res.json();
                setConstants(data);
            } catch (err) {
                console.error("Error loading constants:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchConstants();
    }, []);

    return { constants, loading, error };
}
