import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

const getNow = (timezone) => (timezone ? DateTime.now().setZone(timezone) : DateTime.now());

const getReferenceDate = (timezone) => getNow(timezone).toISODate();

const getDelayUntilMidnight = (timezone) => {
  const now = getNow(timezone);
  const nextMidnight = now.plus({ days: 1 }).startOf('day');
  return Math.max(1, Math.ceil(nextMidnight.diff(now).toMillis()));
};

export const useMidnightObserver = ({ timezone, initialReferenceDate, onMidnight } = {}) => {
  const [observedReferenceDate, setObservedReferenceDate] = useState(null);

  useEffect(() => {
    let timeoutId;

    const scheduleNextTick = () => {
      timeoutId = setTimeout(() => {
        const nextReferenceDate = getReferenceDate(timezone);
        setObservedReferenceDate(nextReferenceDate);
        onMidnight?.(nextReferenceDate);
        scheduleNextTick();
      }, getDelayUntilMidnight(timezone));
    };

    scheduleNextTick();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [timezone, onMidnight]);

  const referenceDate = (() => {
    if (observedReferenceDate) {
      if (!initialReferenceDate) {
        return observedReferenceDate;
      }

      return observedReferenceDate > initialReferenceDate ? observedReferenceDate : initialReferenceDate;
    }

    return initialReferenceDate || getReferenceDate(timezone);
  })();

  return { referenceDate };
};
