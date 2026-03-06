import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DateTime } from 'luxon';
import { useClientPreferences } from '@/hooks/useClientPreferences';
import { formatPrayerLabel } from '@/utils/prayerNames';

const FocusCard = ({ nextPrayer, prayers, lastUpdated, onCountdownComplete, timezone }) => {
    const getCurrentTime = useCallback(() => timezone ? DateTime.now().setZone(timezone) : DateTime.now(), [timezone]);
    const [, setClockTick] = useState(0);
    const { preferences } = useClientPreferences();
    const { clockFormat, showSeconds, countdownMode, skipSunriseCountdown, prayerNameLanguage } = preferences.appearance;
    const lastTriggeredRef = useRef(null);
    const isFetchingRef = useRef(false);
    const now = getCurrentTime();

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
        const timer = setInterval(() => setClockTick((currentTick) => currentTick + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // Trigger refetch when countdown completes
    useEffect(() => {
        if (!effectiveNextPrayer || !onCountdownComplete) return;

        const target = DateTime.fromISO(effectiveNextPrayer.time).setZone(timezone || DateTime.local().zoneName);
        const secondsLeft = Math.floor((target.toMillis() - now.toMillis()) / 1000);

        // Only trigger if we haven't already triggered for this specific prayer time
        // and we're not currently in a fetching state
        if (secondsLeft <= 0 && lastTriggeredRef.current !== effectiveNextPrayer.time && !isFetchingRef.current) {
            lastTriggeredRef.current = effectiveNextPrayer.time;
            isFetchingRef.current = true;
            
            console.log(`[FocusCard] Countdown finished for ${effectiveNextPrayer.name}. Triggering refetch in 5s...`);
            
            const timer = setTimeout(() => {
                onCountdownComplete();
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [effectiveNextPrayer, now, onCountdownComplete, timezone]);

    // Retry loop: monitor lastUpdated to detect if server returned stale data
    useEffect(() => {
        if (!isFetchingRef.current || !effectiveNextPrayer || !onCountdownComplete) return;

        const target = DateTime.fromISO(effectiveNextPrayer.time).setZone(timezone || DateTime.local().zoneName);
        const currentNow = getCurrentTime();
        const secondsLeft = Math.floor((target.toMillis() - currentNow.toMillis()) / 1000);

        if (secondsLeft > 0) {
            // Success: server returned new prayer, unlock UI
            console.log(`[FocusCard] Transition successful. Next prayer: ${effectiveNextPrayer.name} in ${secondsLeft}s`);
            isFetchingRef.current = false;
        } else {
            // Server still returning old prayer, retry after 5s
            console.log(`[FocusCard] Server still returning old prayer (${effectiveNextPrayer.name}). Retrying in 5s...`);
            
            const timer = setTimeout(() => {
                onCountdownComplete();
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [effectiveNextPrayer, getCurrentTime, lastUpdated, onCountdownComplete, timezone]);

    const getCountdown = () => {
        if (!effectiveNextPrayer) return null;
        const target = DateTime.fromISO(effectiveNextPrayer.time).setZone(timezone || DateTime.local().zoneName);
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

    const nextName = effectiveNextPrayer ? formatPrayerLabel(effectiveNextPrayer.name, prayerNameLanguage) : '';

    return (
        <div id="tour-focus-card" className="bg-app-card rounded-3xl h-auto lg:h-full flex flex-col items-center justify-center text-center p-8 shadow-2xl relative overflow-hidden">
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
                        Upcoming: {nextName}
                    </div>
                    <div className="text-3xl lg:text-6xl min-w-[250px] lg:min-w-[500px] text-center font-mono text-app-text bg-app-bg/40 px-6 lg:px-10 py-2 lg:py-4 rounded-2xl backdrop-blur-lg border border-app-border shadow-inner">
                        {getCountdown()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocusCard;
