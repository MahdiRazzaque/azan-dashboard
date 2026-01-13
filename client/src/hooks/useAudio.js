import { useState, useRef, useEffect, useCallback } from 'react';

export const useAudio = () => {
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
            await ctx.resume();
        } else if (ctx.state === 'running') {
            await ctx.suspend();
        }
        
        setIsMuted(ctx.state !== 'running');
        if (ctx.state === 'running') setBlocked(false);

    }, [initContext]);
    
    useEffect(() => {
        const ctx = initContext();
        setIsMuted(ctx.state !== 'running');
        
        const stateHandler = () => {
             setIsMuted(ctx.state !== 'running');
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
            // Check if URL is relative or absolute
            const fullUrl = url.startsWith('http') ? url : url; 
            // Note: fetch works with relative paths comfortably if on same origin
            
            const response = await fetch(fullUrl);
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
