import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePrayerTimes } from '../../../src/hooks/usePrayerTimes';

describe('usePrayerTimes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should fetch prayers on mount', async () => {
    const mockData = {
      prayers: { Fajr: '05:00' },
      nextPrayer: { name: 'Fajr', time: '05:00' },
      meta: { timezone: 'UTC' }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    const { result } = renderHook(() => usePrayerTimes());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 1000 });

    expect(result.current.prayers).toEqual(mockData.prayers);
    expect(result.current.nextPrayer).toEqual(mockData.nextPrayer);
    expect(result.current.meta).toEqual(mockData.meta);
  });

  it('should handle fetch error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const { result } = renderHook(() => usePrayerTimes());

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 1000 });

    expect(result.current.error).toBe('API Error: 500');
    consoleSpy.mockRestore();
  });

  it('should refresh prayers periodically', async () => {
    vi.useFakeTimers();
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ prayers: {} })
    });

    const { result } = renderHook(() => usePrayerTimes());

    // Initial fetch
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    // Advance time
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.loading).toBe(false);
  });

  it('should allow manual refetch and not set loading to true', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ prayers: {} })
    });

    const { result } = renderHook(() => usePrayerTimes());

    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    // Loading should remain false because refetch calls fetchPrayers(false)
    expect(result.current.loading).toBe(false);
  });
});
