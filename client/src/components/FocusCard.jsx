import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';

const FocusCard = ({ nextPrayer }) => {
    const [now, setNow] = useState(DateTime.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(DateTime.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getCountdown = () => {
        if (!nextPrayer) return null;
        const target = DateTime.fromISO(nextPrayer.time);

        // Calculate precise remaining seconds using millis to avoid formatting edge-cases
        const secondsLeft = Math.max(0, Math.floor((target.toMillis() - now.toMillis()) / 1000));

        if (secondsLeft <= 0) return '0sec';

        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;

        if (hours > 0) {
            return `${hours}hr ${minutes}min ${seconds}sec`;
        }

        if (minutes > 0) {
            return `${minutes}min ${seconds}sec`;
        }

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
            <div className="font-bold text-white tracking-widest leading-none z-10 select-none pb-8 text-6xl lg:text-9xl">
                <span>{now.toFormat('HH:mm')}</span>
                <span className="text-2xl lg:text-4xl text-app-dim font-medium opacity-40 ml-4">
                    {now.toFormat('ss')}
                </span>
            </div>

            {/* Countdown Section */}
            {nextPrayer && (
                <div className="flex flex-col items-center space-y-4 z-10 mt-4">
                    <div className="text-lg lg:text-2xl text-app-accent font-semibold uppercase tracking-[0.3em] opacity-90 drop-shadow-md">
                        Upcoming: {nextName}
                    </div>
                    <div className="text-3xl lg:text-6xl min-w-[250px] lg:min-w-[500px] text-center font-mono text-white bg-black/40 px-6 lg:px-10 py-2 lg:py-4 rounded-2xl backdrop-blur-lg border border-white/5 shadow-inner">
                        {getCountdown()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocusCard;
