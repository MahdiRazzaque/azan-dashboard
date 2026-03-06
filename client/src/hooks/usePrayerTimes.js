import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { useMidnightObserver } from '@/hooks/useMidnightObserver';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 120 * 1000;
const TRANSITION_DURATION_MS = 280;
const PRAYER_SEQUENCE = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

const buildPrayerUrl = (params = {}) => {
  const searchParams = new URLSearchParams({
    t: Date.now().toString()
  });

  if (params.cursorDate) {
    searchParams.set('cursorDate', params.cursorDate);
  }

  if (params.direction) {
    searchParams.set('direction', params.direction);
  }

  return `/api/prayers?${searchParams.toString()}`;
};

const sortDateKeys = (calendar) => Object.keys(calendar || {}).sort((left, right) => left.localeCompare(right));

const pruneCalendar = (calendar, referenceDate) => {
  if (!referenceDate) {
    return calendar;
  }

  const reference = DateTime.fromISO(referenceDate);

  return Object.fromEntries(
    Object.entries(calendar || {}).filter(([date]) => {
      const difference = Math.abs(Math.round(DateTime.fromISO(date).diff(reference, 'days').days));
      return difference <= 30;
    })
  );
};

const getLaterDate = (leftDate, rightDate) => {
  if (!leftDate) {
    return rightDate || null;
  }

  if (!rightDate) {
    return leftDate;
  }

  return leftDate > rightDate ? leftDate : rightDate;
};

const getNextPrayerFromDay = (prayerDay) => {
  for (const prayerName of PRAYER_SEQUENCE) {
    const prayerTime = prayerDay?.[prayerName]?.start;

    if (prayerTime) {
      return {
        name: prayerName,
        time: prayerTime,
        isTomorrow: false
      };
    }
  }

  return null;
};

export const usePrayerTimes = () => {
  const [prayers, setPrayers] = useState({});
  const [nextPrayer, setNextPrayer] = useState(null);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [calendar, setCalendar] = useState({});
  const [initialReferenceDate, setInitialReferenceDate] = useState(null);
  const [viewedDate, setViewedDateState] = useState(null);
  const [timezone, setTimezone] = useState(null);
  const [navigationBoundaries, setNavigationBoundaries] = useState({ past: false, future: false });
  const [transitionDirection, setTransitionDirection] = useState('future');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const abortControllerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const referenceDateRef = useRef(null);
  const viewedDateRef = useRef(null);
  const calendarRef = useRef({});
  const pendingRequestCountRef = useRef(0);

  const startFetching = useCallback(() => {
    pendingRequestCountRef.current += 1;
    setIsFetching(true);
  }, []);

  const finishFetching = useCallback(() => {
    pendingRequestCountRef.current = Math.max(0, pendingRequestCountRef.current - 1);

    if (pendingRequestCountRef.current === 0) {
      setIsFetching(false);
    }
  }, []);

  const handleMidnight = useCallback((nextReferenceDate) => {
    const currentReferenceDate = referenceDateRef.current || initialReferenceDate || nextReferenceDate;
    const currentViewedDate = viewedDateRef.current;
    const nextViewedDate = !currentViewedDate || currentViewedDate === currentReferenceDate
      ? nextReferenceDate
      : currentViewedDate;
    const nextPrayers = calendarRef.current[nextReferenceDate] || null;

    setCalendar((currentCalendar) => {
      const nextCalendar = pruneCalendar(currentCalendar, nextReferenceDate);
      calendarRef.current = nextCalendar;
      return nextCalendar;
    });
    setInitialReferenceDate((currentInitialReferenceDate) => getLaterDate(currentInitialReferenceDate, nextReferenceDate));
    setMeta((currentMeta) => ({
      ...currentMeta,
      date: nextReferenceDate
    }));

    if (nextPrayers) {
      setPrayers(nextPrayers);
      setNextPrayer(getNextPrayerFromDay(nextPrayers));
    }

    setViewedDateState(nextViewedDate);
    referenceDateRef.current = nextReferenceDate;
    viewedDateRef.current = nextViewedDate;
  }, [initialReferenceDate]);

  const { referenceDate } = useMidnightObserver({
    timezone,
    initialReferenceDate,
    onMidnight: handleMidnight
  });
  const activeReferenceDate = initialReferenceDate || referenceDate;

  const applyTransition = useCallback((direction) => {
    setTransitionDirection(direction);
    setIsTransitioning(true);
    clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, TRANSITION_DURATION_MS);
  }, []);

  const applyPayload = useCallback((payload, options = {}) => {
    const { preserveViewedDate = false } = options;
    const payloadReferenceDate = payload.meta?.date || null;
    const currentReferenceDate = referenceDateRef.current || initialReferenceDate || null;
    const nextReference = getLaterDate(payloadReferenceDate, currentReferenceDate);
    const mergedCalendar = {
      ...calendarRef.current,
      ...(payload.calendar || {})
    };
    const isStalePayload = Boolean(payloadReferenceDate && currentReferenceDate && payloadReferenceDate < currentReferenceDate);

    setPrayers((currentPrayers) => {
      if (isStalePayload) {
        return mergedCalendar[nextReference] || currentPrayers;
      }

      return payload.prayers || mergedCalendar[nextReference] || {};
    });
    setNextPrayer((currentNextPrayer) => {
      if (isStalePayload) {
        return getNextPrayerFromDay(mergedCalendar[nextReference]) || currentNextPrayer;
      }

      return payload.nextPrayer || getNextPrayerFromDay(mergedCalendar[nextReference]) || null;
    });
    setMeta(payload.meta ? {
      ...payload.meta,
      date: nextReference || payload.meta.date
    } : {});
    setCalendar(() => {
      calendarRef.current = mergedCalendar;
      return mergedCalendar;
    });
    setTimezone(payload.meta?.location || null);
    setInitialReferenceDate((currentInitialReferenceDate) => getLaterDate(currentInitialReferenceDate, nextReference));
    referenceDateRef.current = nextReference || null;
    setError(null);
    setLastUpdated(Date.now());

    setViewedDateState((currentViewedDate) => {
      const nextViewedDate = (preserveViewedDate || isStalePayload)
        ? (currentViewedDate || nextReference || null)
        : (currentViewedDate || nextReference || null);
      viewedDateRef.current = nextViewedDate;
      return nextViewedDate;
    });
  }, [initialReferenceDate]);

  const fetchPrayers = useCallback(async ({ isInitial = false, preserveViewedDate = false } = {}) => {
    if (isInitial) {
      setLoading(true);
    }

    startFetching();

    try {
      const response = await fetch(buildPrayerUrl());
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      applyPayload(data, { preserveViewedDate });
    } catch (fetchError) {
      console.error('Prayer Times Fetch Error:', fetchError);
      setError(fetchError.message);
    } finally {
      finishFetching();

      if (isInitial) {
        setLoading(false);
      }
    }
  }, [applyPayload, finishFetching, startFetching]);

  const fetchCalendarChunk = useCallback(async (cursorDate, direction) => {
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    startFetching();

    try {
      const response = await fetch(buildPrayerUrl({ cursorDate, direction }), {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const chunk = data.calendar || {};
      const reachedBoundary = Object.keys(chunk).length < 7;

      if (Object.keys(chunk).length === 0) {
        setNavigationBoundaries((current) => ({
          ...current,
          [direction]: true
        }));
        return false;
      }

      setCalendar((currentCalendar) => {
        const nextCalendar = {
          ...currentCalendar,
          ...chunk
        };
        calendarRef.current = nextCalendar;
        return nextCalendar;
      });
      setNavigationBoundaries((current) => ({
        ...current,
        [direction]: reachedBoundary
      }));
      setError(null);
      return true;
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        return false;
      }

      console.error('Prayer Calendar Chunk Fetch Error:', fetchError);
      setError(fetchError.message);
      return false;
    } finally {
      finishFetching();

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [finishFetching, startFetching]);

  const setViewedDate = useCallback((nextViewedDate) => {
    setViewedDateState((currentViewedDate) => {
      const resolvedViewedDate = typeof nextViewedDate === 'function'
        ? nextViewedDate(currentViewedDate)
        : nextViewedDate;

      viewedDateRef.current = resolvedViewedDate;
      return resolvedViewedDate;
    });
  }, []);

  const orderedDates = useMemo(() => sortDateKeys(calendar), [calendar]);
  const minCachedDate = orderedDates[0] || null;
  const maxCachedDate = orderedDates[orderedDates.length - 1] || null;

  const navigateDay = useCallback(async (delta) => {
    if (!viewedDate || delta === 0 || isTransitioning) {
      return;
    }

    const direction = delta > 0 ? 'future' : 'past';
    const targetDate = DateTime.fromISO(viewedDate).plus({ days: delta }).toISODate();

    applyTransition(direction);

    if (calendar[targetDate]) {
      viewedDateRef.current = targetDate;
      setViewedDateState(targetDate);
      return;
    }

    if (navigationBoundaries[direction]) {
      return;
    }

    const cursorDate = direction === 'future' ? maxCachedDate : minCachedDate;
    if (!cursorDate) {
      return;
    }

    const loaded = await fetchCalendarChunk(cursorDate, direction);
    if (loaded) {
      viewedDateRef.current = targetDate;
      setViewedDateState(targetDate);
    }
  }, [applyTransition, calendar, fetchCalendarChunk, isTransitioning, maxCachedDate, minCachedDate, navigationBoundaries, viewedDate]);

  const resetViewedDate = useCallback(() => {
    if (!activeReferenceDate) {
      return;
    }

    const nextDirection = viewedDate && viewedDate < activeReferenceDate ? 'future' : 'past';

    applyTransition(nextDirection);
    viewedDateRef.current = activeReferenceDate;
    setViewedDateState(activeReferenceDate);
  }, [activeReferenceDate, applyTransition, viewedDate]);

  const viewedPrayers = viewedDate ? (calendar[viewedDate] || prayers) : prayers;

  const canNavigateBackward = useMemo(() => {
    if (!viewedDate) {
      return false;
    }

    return (minCachedDate && viewedDate > minCachedDate) || !navigationBoundaries.past;
  }, [minCachedDate, navigationBoundaries.past, viewedDate]);

  const canNavigateForward = useMemo(() => {
    if (!viewedDate) {
      return false;
    }

    return (maxCachedDate && viewedDate < maxCachedDate) || !navigationBoundaries.future;
  }, [maxCachedDate, navigationBoundaries.future, viewedDate]);

  useEffect(() => {
    fetchPrayers({ isInitial: true, preserveViewedDate: false });
    const intervalId = setInterval(() => {
      fetchPrayers({ preserveViewedDate: true });
    }, FIVE_MINUTES_MS);

    return () => {
      clearInterval(intervalId);
      clearTimeout(inactivityTimerRef.current);
      clearTimeout(transitionTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [fetchPrayers]);

  useEffect(() => {
    viewedDateRef.current = viewedDate;
  }, [viewedDate]);

  useEffect(() => {
    calendarRef.current = calendar;
  }, [calendar]);

  useEffect(() => {
    clearTimeout(inactivityTimerRef.current);

    if (!viewedDate || !activeReferenceDate || viewedDate === activeReferenceDate) {
      return undefined;
    }

    inactivityTimerRef.current = setTimeout(() => {
      viewedDateRef.current = activeReferenceDate;
      setViewedDateState(activeReferenceDate);
    }, INACTIVITY_TIMEOUT_MS);

    return () => {
      clearTimeout(inactivityTimerRef.current);
    };
  }, [activeReferenceDate, viewedDate]);

  return {
    prayers,
    nextPrayer,
    meta,
    loading,
    isFetching,
    error,
    lastUpdated,
    timezone,
    referenceDate: activeReferenceDate,
    viewedDate,
    viewedPrayers,
    canNavigateBackward,
    canNavigateForward,
    transitionDirection,
    isTransitioning,
    setViewedDate,
    navigateDay,
    resetViewedDate,
    refetch: () => fetchPrayers({ preserveViewedDate: true })
  };
};
