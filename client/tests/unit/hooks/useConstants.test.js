import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConstants } from '../../../src/hooks/useConstants';

describe('useConstants', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should fetch and return constants', async () => {
    const mockData = {
      calculationMethods: [{ id: 1, name: 'Method 1' }],
      madhabs: [],
      latitudeAdjustments: [],
      midnightModes: []
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    const { result } = renderHook(() => useConstants());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.constants).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch failure (not ok)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false
    });

    const { result } = renderHook(() => useConstants());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeDefined();
    expect(result.current.error.message).toBe('Failed to fetch constants');
  });

  it('should handle fetch network error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useConstants());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeDefined();
    expect(result.current.error.message).toBe('Network error');
    
    consoleSpy.mockRestore();
  });
});
