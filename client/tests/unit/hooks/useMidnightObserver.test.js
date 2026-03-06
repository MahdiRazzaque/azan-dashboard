import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Settings } from 'luxon';
import { useMidnightObserver } from '../../../src/hooks/useMidnightObserver';

describe('useMidnightObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Settings.now = () => Date.now();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Settings.now = () => Date.now();
  });

  it('advances the reference date at midnight and calls onMidnight', () => {
    vi.setSystemTime(new Date('2026-03-06T23:59:59.000Z'));
    const onMidnight = vi.fn();

    const { result } = renderHook(() => useMidnightObserver({
      timezone: 'UTC',
      initialReferenceDate: '2026-03-06',
      onMidnight
    }));

    expect(result.current.referenceDate).toBe('2026-03-06');

    act(() => {
      vi.advanceTimersByTime(1001);
    });

    expect(result.current.referenceDate).toBe('2026-03-07');
    expect(onMidnight).toHaveBeenCalledWith('2026-03-07');
  });

  it('derives the initial reference date from the supplied timezone when none is provided', () => {
    vi.setSystemTime(new Date('2026-03-07T00:30:00.000Z'));

    const { result } = renderHook(() => useMidnightObserver({ timezone: 'America/New_York' }));

    expect(result.current.referenceDate).toBe('2026-03-06');
  });
});
