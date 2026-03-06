import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { useClientPreferences } from '@/hooks/useClientPreferences';
import { formatPrayerLabel, formatPrayerTime } from '@/utils/prayerNames';

const PRAYER_LIST = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const SWIPE_THRESHOLD = 50;
const TRACK_TRANSITION_STYLE = 'transform 300ms cubic-bezier(0.22,1,0.36,1)';

const getTrackStartTransform = (direction) => (
    direction === 'past' ? 'translate3d(-100%, 0, 0)' : 'translate3d(0, 0, 0)'
);

const getTrackEndTransform = (direction) => (
    direction === 'past' ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)'
);

const getPrayerStatus = (key, activeNextPrayer) => {
    if (!activeNextPrayer) {
        return 'future';
    }

    const idx = PRAYER_LIST.indexOf(key);
    const nextIdx = PRAYER_LIST.indexOf(activeNextPrayer.name);

    if (activeNextPrayer.isTomorrow) {
        return 'passed';
    }

    if (idx < nextIdx) {
        return 'passed';
    }

    if (idx === nextIdx) {
        return 'next';
    }

    return 'future';
};

const PrayerTimeValue = ({ time, clockFormat, className = '' }) => {
    const formattedTime = formatPrayerTime(time, clockFormat);

    if (clockFormat !== '12h') {
        return <span className={className}>{formattedTime}</span>;
    }

    const match = formattedTime.match(/^(.*)\s(AM|PM)$/);

    if (!match) {
        return <span className={className}>{formattedTime}</span>;
    }

    const [, timeValue, meridiem] = match;

    return (
        <span className={`${className} inline-flex items-baseline justify-center gap-1`}>
            <span>{timeValue}</span>
            <span className="text-[0.45em] font-semibold uppercase tracking-[0.2em] opacity-70">{meridiem}</span>
        </span>
    );
};

const PrayerRow = ({ name, time, iqamah, status, clockFormat, prayerNameLanguage }) => {
    const baseClass = "flex items-center justify-between py-3 px-4 lg:py-6 lg:px-10 text-2xl lg:text-5xl font-medium border-b border-white/5 last:border-0 transition-all duration-500";

    let colorClass = "text-app-text";
    let bgClass = "";

    if (status === 'passed') {
        colorClass = "text-app-dim";
    }
    if (status === 'next') {
        colorClass = "text-app-accent font-bold";
        bgClass = "bg-app-accent/10";
    }

    const label = formatPrayerLabel(name, prayerNameLanguage);

    return (
        <div className={`${baseClass} ${colorClass} ${bgClass} border-app-border/10`}>
            <span className="w-1/3 text-left">{label}</span>
            <PrayerTimeValue time={time} clockFormat={clockFormat} className="w-1/3 text-center" />
            <span className="w-1/3 text-right text-xl lg:text-4xl opacity-60">
                {name === 'sunrise' ? (
                    <span className="text-app-dim opacity-30 tracking-widest text-2xl lg:text-3xl">---</span>
                ) : (
                    iqamah ? <PrayerTimeValue time={iqamah} clockFormat={clockFormat} className="justify-end" /> : ''
                )}
            </span>
        </div>
    );
};

const PrayerTablePanel = ({ prayers, activeNextPrayer, clockFormat, prayerNameLanguage }) => (
    <div className="min-w-full">
        {PRAYER_LIST.map((key) => (
            <PrayerRow
                key={key}
                name={key}
                time={prayers[key]?.start}
                iqamah={prayers[key]?.iqamah}
                status={getPrayerStatus(key, activeNextPrayer)}
                clockFormat={clockFormat}
                prayerNameLanguage={prayerNameLanguage}
            />
        ))}
    </div>
);

const isInputFocused = () => {
    const activeElement = document.activeElement;
    if (!activeElement) {
        return false;
    }

    const tagName = activeElement.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || activeElement.isContentEditable;
};

const PrayerCard = ({
    prayers,
    nextPrayer,
    isFetching = false,
    transitionDate,
    transitionNonce,
    transitionPrayers,
    viewedDate,
    referenceDate,
    onNavigate,
    onResetToday,
    canNavigateBackward,
    canNavigateForward,
    transitionDirection,
    isTransitioning
}) => {
    const touchStartRef = useRef(null);
    const trackRef = useRef(null);
    const firstAnimationFrameRef = useRef(null);
    const secondAnimationFrameRef = useRef(null);
    const { preferences } = useClientPreferences();
    const { clockFormat, prayerNameLanguage, enableDateNavigation } = preferences.appearance;

    const activeNextPrayer = viewedDate === referenceDate ? nextPrayer : null;
    const incomingNextPrayer = transitionDate === referenceDate ? nextPrayer : null;

    const formattedDate = useMemo(() => {
        if (!viewedDate) {
            return '';
        }

        return DateTime.fromISO(viewedDate).toFormat('cccc, d MMMM');
    }, [viewedDate]);

    const shouldRenderTransitionPanels = Boolean(isTransitioning && viewedDate && transitionDate && transitionPrayers);

    const panels = useMemo(() => {
        const currentPanel = {
            key: viewedDate || 'current-day',
            prayers,
            activeNextPrayer
        };

        if (!shouldRenderTransitionPanels) {
            return [currentPanel];
        }

        const incomingPanel = {
            key: transitionDate,
            prayers: transitionPrayers,
            activeNextPrayer: incomingNextPrayer
        };

        return transitionDirection === 'past'
            ? [incomingPanel, currentPanel]
            : [currentPanel, incomingPanel];
    }, [activeNextPrayer, incomingNextPrayer, prayers, shouldRenderTransitionPanels, transitionDate, transitionDirection, transitionPrayers, viewedDate]);

    useLayoutEffect(() => {
        const trackElement = trackRef.current;
        if (!trackElement) {
            return undefined;
        }

        if (!shouldRenderTransitionPanels) {
            trackElement.style.transition = 'none';
            trackElement.style.transform = 'translate3d(0, 0, 0)';
            return undefined;
        }

        trackElement.style.transition = 'none';
        trackElement.style.transform = getTrackStartTransform(transitionDirection);
        return undefined;
    }, [shouldRenderTransitionPanels, transitionDirection, transitionNonce]);

    useEffect(() => {
        if (!enableDateNavigation) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (isInputFocused()) {
                return;
            }

            if (event.key === 'ArrowLeft' && canNavigateBackward && !isTransitioning) {
                onNavigate?.(-1);
            }

            if (event.key === 'ArrowRight' && canNavigateForward && !isTransitioning) {
                onNavigate?.(1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canNavigateBackward, canNavigateForward, enableDateNavigation, isTransitioning, onNavigate]);

    useEffect(() => {
        cancelAnimationFrame(firstAnimationFrameRef.current);
        cancelAnimationFrame(secondAnimationFrameRef.current);

        if (!shouldRenderTransitionPanels) {
            return undefined;
        }

        const trackElement = trackRef.current;
        if (!trackElement) {
            return undefined;
        }

        const endTransform = getTrackEndTransform(transitionDirection);

        firstAnimationFrameRef.current = requestAnimationFrame(() => {
            secondAnimationFrameRef.current = requestAnimationFrame(() => {
                trackElement.style.transition = TRACK_TRANSITION_STYLE;
                trackElement.style.transform = endTransform;
            });
        });

        return () => {
            cancelAnimationFrame(firstAnimationFrameRef.current);
            cancelAnimationFrame(secondAnimationFrameRef.current);
        };
    }, [shouldRenderTransitionPanels, transitionDate, transitionDirection, transitionNonce]);

    const handleTouchStart = (event) => {
        if (!enableDateNavigation) {
            return;
        }

        const [touch] = event.touches;
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY
        };
    };

    const handleTouchEnd = (event) => {
        if (!enableDateNavigation || !touchStartRef.current || isTransitioning) {
            return;
        }

        const [touch] = event.changedTouches;
        const deltaX = touchStartRef.current.x - touch.clientX;
        const deltaY = touchStartRef.current.y - touch.clientY;
        touchStartRef.current = null;

        if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
            return;
        }

        if (deltaX > 0 && canNavigateForward) {
            onNavigate?.(1);
        }

        if (deltaX < 0 && canNavigateBackward) {
            onNavigate?.(-1);
        }
    };

    return (
        <div
            id="tour-prayer-card"
            className="bg-app-card rounded-3xl h-auto lg:h-full flex flex-col overflow-hidden shadow-2xl p-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="flex-1 flex flex-col justify-center space-y-2">
                {enableDateNavigation ? (
                    <div className="px-4 lg:px-10 pb-4 border-b border-app-border/20">
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-app-text mb-4">
                            <button
                                type="button"
                                aria-label="Previous Day"
                                disabled={!canNavigateBackward || isTransitioning}
                                onClick={() => onNavigate?.(-1)}
                                className="h-10 w-10 rounded-full border border-app-border bg-app-bg/60 text-app-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:border-app-accent"
                            >
                                {'<'}
                            </button>
                            <div className="flex items-center justify-center gap-3 text-center">
                                {isFetching ? (
                                    <span aria-label="Loading prayer data" className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-app-border/40 border-t-app-accent lg:h-8 lg:w-8" />
                                ) : (
                                    <div className="text-base lg:text-2xl font-semibold tracking-wide">{formattedDate}</div>
                                )}
                                {viewedDate && referenceDate && viewedDate !== referenceDate && (
                                    <button
                                        type="button"
                                        onClick={onResetToday}
                                        disabled={isTransitioning}
                                        className="shrink-0 rounded-full border border-app-accent/40 bg-app-accent/10 px-3 py-1 text-xs lg:text-sm font-semibold text-app-accent transition-colors hover:bg-app-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        ↺ Today
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                aria-label="Next Day"
                                disabled={!canNavigateForward || isTransitioning}
                                onClick={() => onNavigate?.(1)}
                                className="h-10 w-10 rounded-full border border-app-border bg-app-bg/60 text-app-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:border-app-accent"
                            >
                                {'>'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 text-app-dim text-sm lg:text-xl uppercase tracking-widest font-semibold opacity-50 flex justify-between">
                                <span className="w-1/3 text-left">Prayer</span>
                                <span className="w-1/3 text-center">Start Time</span>
                                <span className="w-1/3 text-right">Iqamah</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between px-4 lg:px-10 pb-4 text-app-dim text-sm lg:text-xl uppercase tracking-widest font-semibold opacity-50 border-b border-app-border/20">
                        <span className="w-1/3 text-left">Prayer</span>
                        <span className="w-1/3 text-center">Start Time</span>
                        <span className="w-1/3 text-right">Iqamah</span>
                    </div>
                )}

                <div className="relative overflow-hidden" data-testid="prayer-table-viewport">
                    <div
                        ref={trackRef}
                        className="flex transform-gpu will-change-transform"
                        data-testid="prayer-table-track"
                    >
                        {panels.map((panel) => (
                            <PrayerTablePanel
                                key={panel.key}
                                prayers={panel.prayers}
                                activeNextPrayer={panel.activeNextPrayer}
                                clockFormat={clockFormat}
                                prayerNameLanguage={prayerNameLanguage}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrayerCard;
