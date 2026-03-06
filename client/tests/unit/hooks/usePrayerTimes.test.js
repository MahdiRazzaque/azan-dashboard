import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime, Settings } from 'luxon';
import { usePrayerTimes } from '../../../src/hooks/usePrayerTimes';

const createPrayerDay = (dateKey) => ({
  fajr: { start: `${dateKey}T05:00:00.000Z`, iqamah: `${dateKey}T05:15:00.000Z` },
  sunrise: { start: `${dateKey}T06:30:00.000Z` },
  dhuhr: { start: `${dateKey}T12:00:00.000Z`, iqamah: `${dateKey}T12:15:00.000Z` },
  asr: { start: `${dateKey}T15:30:00.000Z`, iqamah: `${dateKey}T15:45:00.000Z` },
  maghrib: { start: `${dateKey}T18:00:00.000Z`, iqamah: `${dateKey}T18:10:00.000Z` },
  isha: { start: `${dateKey}T19:30:00.000Z`, iqamah: `${dateKey}T19:45:00.000Z` }
});

const createCalendar = (startDate, count) => {
  const calendar = {};

  for (let offset = 0; offset < count; offset += 1) {
    const dateKey = DateTime.fromISO(startDate).plus({ days: offset }).toISODate();
    calendar[dateKey] = createPrayerDay(dateKey);
  }

  return calendar;
};

const createResponse = ({
  referenceDate = '2026-01-30',
  startDate = '2026-01-29',
  count = 3,
  timezone = 'UTC',
  calendar = createCalendar(startDate, count)
} = {}) => ({
  prayers: createPrayerDay(referenceDate),
  nextPrayer: { name: 'dhuhr', time: `${referenceDate}T12:00:00.000Z`, isTomorrow: false },
  meta: { date: referenceDate, location: timezone },
  calendar
});

const okResponse = (data) => ({
  ok: true,
  json: () => Promise.resolve(data)
});

const getRequestMeta = (url) => {
  const parsedUrl = new URL(url, 'http://localhost');

  return {
    cursorDate: parsedUrl.searchParams.get('cursorDate'),
    direction: parsedUrl.searchParams.get('direction')
  };
};

const flushHook = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('usePrayerTimes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    Settings.now = () => Date.now();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
    Settings.now = () => Date.now();
  });

  it('hydrates the current and viewed prayer data from the initial calendar response', async () => {
    vi.setSystemTime(new Date('2026-01-30T10:00:00.000Z'));
    const response = createResponse();

    fetch.mockImplementation(() => Promise.resolve(okResponse(response)));

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    expect(result.current.loading).toBe(false);
    expect(result.current.referenceDate).toBe('2026-01-30');
    expect(result.current.viewedDate).toBe('2026-01-30');
    expect(result.current.viewedPrayers).toEqual(response.calendar['2026-01-30']);
    expect(result.current.prayers).toEqual(response.prayers);
    expect(result.current.timezone).toBe('UTC');
  });

  it('navigates within the cached calendar without triggering another fetch', async () => {
    const response = createResponse({ startDate: '2026-01-30', count: 2 });
    fetch.mockImplementation(() => Promise.resolve(okResponse(response)));

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.navigateDay(1);
    });

    expect(result.current.viewedDate).toBe('2026-01-31');
    expect(result.current.viewedPrayers).toEqual(response.calendar['2026-01-31']);
    const directionalCalls = fetch.mock.calls.filter(([url]) => String(url).includes('cursorDate='));
    expect(directionalCalls).toHaveLength(0);
  });

  it('fetches and merges a future chunk when navigating beyond the cached window', async () => {
    const initialResponse = createResponse({ startDate: '2026-01-30', count: 2 });
    const futureCalendar = createCalendar('2026-02-01', 7);
    const futureResponse = createResponse({
      referenceDate: '2026-01-30',
      startDate: '2026-02-01',
      count: 7,
      calendar: futureCalendar
    });

    fetch.mockImplementation((url) => {
      const { cursorDate, direction } = getRequestMeta(url);
      if (cursorDate === '2026-01-31' && direction === 'future') {
        return Promise.resolve(okResponse(futureResponse));
      }

      return Promise.resolve(okResponse(initialResponse));
    });

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.navigateDay(1);
    });

    expect(result.current.viewedDate).toBe('2026-01-31');

    await act(async () => {
      vi.advanceTimersByTime(201);
    });

    act(() => {
      result.current.navigateDay(1);
    });

    await flushHook();

    const directionalCalls = fetch.mock.calls.filter(([url]) => String(url).includes('cursorDate=2026-01-31'));
    expect(directionalCalls.length).toBeGreaterThan(0);

    expect(result.current.viewedDate).toBe('2026-02-01');
    expect(result.current.viewedPrayers).toEqual(futureCalendar['2026-02-01']);
  });

  it('aborts stale directional fetches when navigation is triggered rapidly', async () => {
    const initialResponse = createResponse({ startDate: '2026-01-30', count: 2 });
    const futureResponse = createResponse({
      referenceDate: '2026-01-30',
      startDate: '2026-02-01',
      count: 7
    });
    let firstSignal;
    let futureFetchCount = 0;

    fetch.mockImplementation((url, options = {}) => {
      const { cursorDate, direction } = getRequestMeta(url);

      if (cursorDate === '2026-01-31' && direction === 'future') {
        futureFetchCount += 1;
        if (futureFetchCount === 1) {
          firstSignal = options.signal;
          return new Promise(() => {});
        }

        return Promise.resolve(okResponse(futureResponse));
      }

      return Promise.resolve(okResponse(initialResponse));
    });

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.navigateDay(1);
    });

    expect(result.current.viewedDate).toBe('2026-01-31');

    await act(async () => {
      vi.advanceTimersByTime(201);
    });

    act(() => {
      result.current.navigateDay(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(201);
    });

    act(() => {
      result.current.navigateDay(1);
    });

    await flushHook();

    expect(futureFetchCount).toBeGreaterThan(1);
    expect(firstSignal.aborted).toBe(true);
  });

  it('disables forward navigation when a directional fetch returns an empty calendar', async () => {
    const initialResponse = createResponse({ startDate: '2026-01-30', count: 2 });
    const emptyChunkResponse = createResponse({
      referenceDate: '2026-01-30',
      startDate: '2026-02-01',
      count: 0,
      calendar: {}
    });

    fetch.mockImplementation((url) => {
      const { cursorDate, direction } = getRequestMeta(url);
      if (cursorDate === '2026-01-31' && direction === 'future') {
        return Promise.resolve(okResponse(emptyChunkResponse));
      }

      return Promise.resolve(okResponse(initialResponse));
    });

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.navigateDay(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(201);
    });

    act(() => {
      result.current.navigateDay(1);
    });

    await flushHook();

    expect(result.current.viewedDate).toBe('2026-01-31');
    expect(result.current.canNavigateForward).toBe(false);
  });

  it('resets back to the reference date after 120 seconds of inactivity on another day', async () => {
    const response = createResponse({ startDate: '2026-01-30', count: 2 });
    fetch.mockImplementation(() => Promise.resolve(okResponse(response)));

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.navigateDay(1);
    });

    expect(result.current.viewedDate).toBe('2026-01-31');

    act(() => {
      vi.advanceTimersByTime(120000);
    });

    expect(result.current.viewedDate).toBe('2026-01-30');
  });

  it('moves the viewed date forward at midnight when the user is currently viewing today', async () => {
    vi.setSystemTime(new Date('2026-01-30T23:59:59.000Z'));
    const response = createResponse({ startDate: '2026-01-30', count: 5 });
    fetch.mockImplementation(() => Promise.resolve(okResponse(response)));

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    await act(async () => {
      vi.advanceTimersByTime(1001);
      await Promise.resolve();
    });

    await flushHook();

    expect(result.current.referenceDate).toBe('2026-01-31');
    expect(result.current.viewedDate).toBe('2026-01-31');
  });

  it('lets tomorrow become the new today at midnight without shifting the viewed date', async () => {
    vi.setSystemTime(new Date('2026-01-30T23:59:59.000Z'));
    const response = createResponse({ startDate: '2026-01-30', count: 5 });
    fetch.mockImplementation(() => Promise.resolve(okResponse(response)));

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.navigateDay(1);
    });

    expect(result.current.viewedDate).toBe('2026-01-31');

    await act(async () => {
      vi.advanceTimersByTime(201);
    });

    await act(async () => {
      vi.advanceTimersByTime(1001);
      await Promise.resolve();
    });

    await flushHook();

    expect(result.current.referenceDate).toBe('2026-01-31');
    expect(result.current.viewedDate).toBe('2026-01-31');
  });

  it('keeps the viewed date pinned when midnight passes and the user is viewing another day', async () => {
    vi.setSystemTime(new Date('2026-01-30T23:59:59.000Z'));
    const response = createResponse({ startDate: '2026-01-30', count: 5 });
    fetch.mockImplementation(() => Promise.resolve(okResponse(response)));

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.setViewedDate('2026-02-03');
    });

    expect(result.current.viewedDate).toBe('2026-02-03');

    await act(async () => {
      vi.advanceTimersByTime(1001);
      await Promise.resolve();
    });

    await flushHook();

    expect(result.current.referenceDate).toBe('2026-01-31');
    expect(result.current.viewedDate).toBe('2026-02-03');
  });

  it('does not roll the reference date backward when an older base payload resolves after midnight', async () => {
    vi.setSystemTime(new Date('2026-01-30T23:59:59.000Z'));
    const response = createResponse({ startDate: '2026-01-30', count: 5 });
    let requestCount = 0;
    let resolveStaleFetch;

    fetch.mockImplementation(() => {
      requestCount += 1;

      if (requestCount === 2) {
        return new Promise((resolve) => {
          resolveStaleFetch = () => resolve(okResponse(response));
        });
      }

      return Promise.resolve(okResponse(response));
    });

    const { result } = renderHook(() => usePrayerTimes());

    await flushHook();

    act(() => {
      result.current.refetch();
    });

    await act(async () => {
      vi.advanceTimersByTime(1001);
      await Promise.resolve();
    });

    await flushHook();

    expect(result.current.referenceDate).toBe('2026-01-31');
    expect(result.current.viewedDate).toBe('2026-01-31');

    await act(async () => {
      resolveStaleFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.referenceDate).toBe('2026-01-31');
    expect(result.current.viewedDate).toBe('2026-01-31');
  });
});
