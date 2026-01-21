import { useState, useRef, useEffect, useCallback } from 'react';

export const useAudio = ({ autoUnmute = false } = {}) => {
    const audioContextRef = useRef(null);
    const [isMuted, setIsMuted] = useState(true);
    const [blocked, setBlocked] = useState(false);

    const initContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();
        }
        return audioContextRef.current;
    }, []);

    const toggleMute = useCallback(async () => {
        const ctx = initContext();
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch (err) {
                console.error('Audio Resume Error:', err);
            }
        } else if (ctx.state === 'running') {
            await ctx.suspend();
        }
        
        const isRunning = ctx.state === 'running';
        setIsMuted(!isRunning);
        if (isRunning) setBlocked(false);
        else if (ctx.state === 'suspended' && blocked) {
            // If we were blocked and we're still suspended after a click, 
            // the click might not have been registered as a gesture by the browser
            // or there's another policy issue. 
        }

    }, [initContext, blocked]);
    
    // Auto-unmute on mount
    useEffect(() => {
        if (!autoUnmute) return;

        const attemptAutoUnmute = async () => {
            const ctx = initContext();
            if (ctx.state === 'running') return;

            // We don't await here because resume() can hang in some browsers
            // until a user interaction happens, which is exactly what we're testing.
            ctx.resume().catch(() => {});

            // Brief delay to see if the browser allowed it
            setTimeout(() => {
                const isStillBlocked = ctx.state !== 'running';
                setIsMuted(isStillBlocked);
                setBlocked(isStillBlocked);
            }, 500);
        };

        attemptAutoUnmute();
    }, [autoUnmute, initContext]);

    // Synchronize state with context
    useEffect(() => {
        const ctx = initContext();
        setIsMuted(ctx.state !== 'running');
        
        const stateHandler = () => {
             const isRunning = ctx.state === 'running';
             setIsMuted(!isRunning);
             if (isRunning) setBlocked(false);
        };
        
        ctx.addEventListener('statechange', stateHandler);
        return () => { ctx.removeEventListener('statechange', stateHandler); }
    }, [initContext]);

    const playUrl = useCallback(async (url) => {
        const ctx = initContext();
        
        if (ctx.state === 'suspended') {
            console.warn('Audio blocked: Context suspended');
            setBlocked(true);
            return;
        }

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start(0);
        } catch (error) {
            console.error('Audio Playback Error:', error);
        }
    }, [initContext]);

    return { isMuted, toggleMute, playUrl, blocked };
};
