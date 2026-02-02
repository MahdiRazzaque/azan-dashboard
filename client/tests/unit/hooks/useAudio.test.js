import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudio } from '../../../src/hooks/useAudio';

describe('useAudio', () => {
  let mockAudioContext;
  let stateChangeCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    stateChangeCallback = null;
    mockAudioContext = {
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(),
      suspend: vi.fn().mockResolvedValue(),
      decodeAudioData: vi.fn().mockResolvedValue({}),
      createBufferSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
        buffer: null
      }),
      destination: {},
      addEventListener: vi.fn((event, cb) => {
        if (event === 'statechange') stateChangeCallback = cb;
      }),
      removeEventListener: vi.fn()
    };

    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function() {
      return mockAudioContext;
    }));
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAudio());
    expect(result.current.isMuted).toBe(true);
    expect(result.current.blocked).toBe(false);
  });

  it('should use webkitAudioContext if AudioContext is missing', () => {
    const originalAudioContext = globalThis.AudioContext;
    delete globalThis.AudioContext;
    const mockWebkit = vi.fn().mockImplementation(function() {
      return mockAudioContext;
    });
    vi.stubGlobal('webkitAudioContext', mockWebkit);

    renderHook(() => useAudio());
    expect(mockWebkit).toHaveBeenCalled();

    globalThis.AudioContext = originalAudioContext;
  });

  it('should toggle mute from suspended to running', async () => {
    const { result } = renderHook(() => useAudio());
    
    await act(async () => {
      await result.current.toggleMute();
    });

    expect(mockAudioContext.resume).toHaveBeenCalled();
    mockAudioContext.state = 'running';
    act(() => {
        if (stateChangeCallback) stateChangeCallback();
    });
    expect(result.current.isMuted).toBe(false);
  });

  it('should toggle mute from running to suspended', async () => {
    mockAudioContext.state = 'running';
    const { result } = renderHook(() => useAudio());

    await act(async () => {
      await result.current.toggleMute();
    });

    expect(mockAudioContext.suspend).toHaveBeenCalled();
    mockAudioContext.state = 'suspended';
    act(() => {
        if (stateChangeCallback) stateChangeCallback();
    });
    expect(result.current.isMuted).toBe(true);
  });

  it('should handle toggleMute error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAudioContext.state = 'suspended';
    mockAudioContext.resume.mockRejectedValueOnce(new Error('Resume failed'));
    
    const { result } = renderHook(() => useAudio());
    
    await act(async () => {
      await result.current.toggleMute();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Audio Resume Error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should attempt autoUnmute if enabled', async () => {
    const { result } = renderHook(() => useAudio({ autoUnmute: true }));
    
    expect(mockAudioContext.resume).toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isMuted).toBe(true);
    expect(result.current.blocked).toBe(true);
  });

  it('should handle playUrl when suspended (blocked)', async () => {
    const { result } = renderHook(() => useAudio());
    
    await act(async () => {
      await result.current.playUrl('test.mp3');
    });

    expect(result.current.blocked).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should handle playUrl when running', async () => {
    mockAudioContext.state = 'running';
    const { result } = renderHook(() => useAudio());
    
    fetch.mockResolvedValueOnce({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    });

    await act(async () => {
      await result.current.playUrl('test.mp3');
    });

    expect(fetch).toHaveBeenCalledWith('test.mp3');
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
  });

  it('should handle playUrl errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAudioContext.state = 'running';
    const { result } = renderHook(() => useAudio());
    
    fetch.mockRejectedValueOnce(new Error('Fetch failed'));

    await act(async () => {
      await result.current.playUrl('test.mp3');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Audio Playback Error:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
