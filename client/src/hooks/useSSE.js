import { useState, useEffect } from 'react';

/**
 * Custom hook for managing Server-Sent Events (SSE) connections.
 * It listens for log updates, audio playback triggers, and process status changes.
 * 
 * @param {Function} [onAudioPlay] - Optional callback function triggered when an audio play event is received.
 * @returns {Object} An object containing connection status, logs, and current process status.
 */
export const useSSE = (onAudioPlay) => {
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [processStatus, setProcessStatus] = useState(null);

    useEffect(() => {
        const eventSource = new EventSource('/api/logs');

        eventSource.onopen = () => {
            console.log('SSE Connected');
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'LOG') {
                     setLogs(prev => [data.payload, ...prev].slice(0, 50));
                }

                if (data.type === 'AUDIO_PLAY') {
                    setLogs(prev => [{
                        message: `Playing Audio: ${data.payload.prayer} ${data.payload.event}`, 
                        timestamp: new Date().toISOString(),
                        type: 'audio'
                    }, ...prev].slice(0, 50));

                    if (onAudioPlay) {
                        onAudioPlay(data.payload.prayer, data.payload.event, data.payload.url);
                    }
                }
                if (data.type === 'PROCESS_UPDATE') {
                    setProcessStatus(data.payload.label);
                }
            } catch (e) {
                console.error('SSE Parse Error', e);
            }
        };

        eventSource.onerror = () => {
            // Browser will handle reconnection automatically
            setIsConnected(false);
        };

        return () => {
            eventSource.close();
        };
    }, [onAudioPlay]);

    return { logs, isConnected, processStatus };
};
