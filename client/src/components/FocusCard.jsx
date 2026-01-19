import React, { useState, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
import { useClientPreferences } from '../hooks/useClientPreferences';
import { useMemo } from 'react';

const FocusCard = ({ nextPrayer, prayers, onCountdownComplete }) => {
    const [now, setNow] = useState(DateTime.now());
    const { preferences } = useClientPreferences();
    const { clockFormat, showSeconds, countdownMode, skipSunriseCountdown } = preferences.appearance;
    const lastTriggeredRef = useRef(null);

    // Calculate effective next prayer (skip sunrise if preference is set)
    const effectiveNextPrayer = useMemo(() => {
        if (!nextPrayer) return null;
        if (nextPrayer.name === 'sunrise' && skipSunriseCountdown && prayers?.dhuhr?.start) {
            return {
                name: 'dhuhr',
                time: prayers.dhuhr.start,
                isTomorrow: false
            };
        }
        return nextPrayer;
    }, [nextPrayer, skipSunriseCountdown, prayers]);

    useEffect(() => {
        const timer = setInterval(() => setNow(DateTime.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Trigger refetch when countdown completes
    useEffect(() => {
        if (!effectiveNextPrayer || !onCountdownComplete) return;

        const target = DateTime.fromISO(effectiveNextPrayer.time);
        const secondsLeft = Math.floor((target.toMillis() - now.toMillis()) / 1000);

        // Only trigger if we haven't already triggered for this specific prayer time
        if (secondsLeft <= 0 && lastTriggeredRef.current !== effectiveNextPrayer.time) {
            lastTriggeredRef.current = effectiveNextPrayer.time;
            
            console.log(`[FocusCard] Countdown finished for ${effectiveNextPrayer.name}. Triggering refetch in 2s...`);
            
            const timer = setTimeout(() => {
                onCountdownComplete();
            }, 2000);
            
            return () => clearTimeout(timer);
        }
    }, [effectiveNextPrayer, now, onCountdownComplete]);

    const getCountdown = () => {
        if (!effectiveNextPrayer) return null;
        const target = DateTime.fromISO(effectiveNextPrayer.time);
        const secondsLeft = Math.max(0, Math.floor((target.toMillis() - now.toMillis()) / 1000));

        if (secondsLeft <= 0) return '0sec';

        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;

        if (countdownMode === 'digital') {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        if (countdownMode === 'minimal') {
            if (hours > 0) return `${hours}h ${minutes}m`;
            if (minutes > 0) return `${minutes}m ${seconds}s`;
            return `${seconds}s`;
        }

        // Normal/Natural mode
        if (hours > 0) return `${hours}hr ${minutes}min ${seconds}sec`;
        if (minutes > 0) return `${minutes}min ${seconds}sec`;
        return `${seconds}sec`;
    };

    const nextName = nextPrayer ? nextPrayer.name.charAt(0).toUpperCase() + nextPrayer.name.slice(1) : '';

    return (
        <div className="bg-app-card rounded-3xl h-auto lg:h-full flex flex-col items-center justify-center text-center p-8 shadow-2xl relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30 pointer-events-none" />

            {/* Date Display */}
            <div className="text-xl lg:text-3xl text-app-dim font-light tracking-wide mb-6 z-10">
                {now.toFormat('cccc, d MMMM')}
            </div>

            {/* Main Clock */}
            <div className="font-bold text-app-text tracking-widest leading-none z-10 select-none pb-8 text-6xl lg:text-9xl flex items-baseline">
                <span>{now.toFormat(clockFormat === '12h' ? 'hh:mm' : 'HH:mm')}</span>
                {showSeconds && (
                    <span className="text-2xl lg:text-4xl text-app-dim font-medium opacity-40 ml-4">
                        {now.toFormat('ss')}
                    </span>
                )}
                {clockFormat === '12h' && (
                    <span className="text-xl lg:text-3xl text-app-dim font-medium ml-4 uppercase">
                        {now.toFormat('a')}
                    </span>
                )}
            </div>

            {/* Countdown Section */}
            {effectiveNextPrayer && (
                <div className="flex flex-col items-center space-y-4 z-10 mt-4">
                    <div className="text-lg lg:text-2xl text-app-accent font-semibold uppercase tracking-[0.3em] opacity-90 drop-shadow-md">
                        Upcoming: {effectiveNextPrayer.name.charAt(0).toUpperCase() + effectiveNextPrayer.name.slice(1)}
                    </div>
                    <div className="text-3xl lg:text-6xl min-w-[250px] lg:min-w-[500px] text-center font-mono text-app-text bg-app-bg/40 px-6 lg:px-10 py-2 lg:py-4 rounded-2xl backdrop-blur-lg border border-app-border/10 shadow-inner">
                        {getCountdown()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocusCard;
