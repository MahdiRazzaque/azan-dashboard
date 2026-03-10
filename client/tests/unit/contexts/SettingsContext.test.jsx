import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { useSettings } from '../../../src/hooks/useSettings';
import { useAuth } from '../../../src/hooks/useAuth';
import { validateTrigger, validateSourceSettings } from '../../../src/utils/validation';

vi.mock('../../../src/hooks/useAuth');
vi.mock('../../../src/utils/validation');

const mockResponse = (data, ok = true, status = 200, headers = {}) => ({
  ok,
  status,
  json: () => Promise.resolve(data),
  headers: { get: (name) => headers[name] || null }
});

const baseConfig = { 
  id: 'orig', 
  location: { coordinates: { lat: '51.5', long: '-0.1' }, timezone: 'Europe/London' },
  sources: { primary: { type: 'aladhan', enabled: true }, backup: { type: 'mymasjid', enabled: true } },
  prayers: { fajr: {} },
  automation: { 
      outputs: { local: { enabled: true }, voicemonkey: { enabled: true } },
      triggers: { 
          fajr: { adhan: { enabled: true, offsetMinutes: 15, type: 'tts', targets: ['local', 'voicemonkey', 'browser'] } }
      } 
  } 
};

const TestComponent = ({ callback }) => {
  const s = useSettings();
  React.useEffect(() => {
    if (callback) callback(s);
  }, [s, callback]);
  if (s.loading && !s.config) return <div data-testid="loading">Loading...</div>;
  return <div data-testid="done">Done</div>;
};

describe('SettingsContext Ultimate Coverage', () => {
  const defaultFetchMock = async (url) => {
    if (url.includes('/api/settings')) return mockResponse(baseConfig);
    if (url.includes('/api/system/health/refresh')) return mockResponse({ tts: { healthy: true } });
    if (url.includes('/api/system/health')) return mockResponse({ tts: { healthy: true }, local: { healthy: true } });
    if (url.includes('/api/system/voices')) return mockResponse([{ id: 'v1' }]);
    if (url.includes('/api/system/providers')) return mockResponse([{ id: 'aladhan' }]);
    if (url.includes('/api/settings/update')) return mockResponse({ success: true });
    if (url.includes('/api/settings/env')) return mockResponse({ success: true });
    if (url.includes('/api/settings/reset')) return mockResponse({ success: true });
    return mockResponse({});
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(defaultFetchMock);
    useAuth.mockReturnValue({ isAuthenticated: true });
    validateSourceSettings.mockReturnValue(null);
    validateTrigger.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle all initialization and state', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());
    
    // Auth change
    useAuth.mockReturnValue({ isAuthenticated: false });
    render(<SettingsProvider><TestComponent /></SettingsProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/settings/public'), expect.any(Object)));
  });

  it('should cover all validation branches', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

    // Validation failures
    await act(async () => { context.updateSetting('location.coordinates.lat', '100'); });
    await context.saveSettings();
    await act(async () => { context.updateSetting('location.coordinates.lat', '50'); context.updateSetting('location.coordinates.long', '200'); });
    await context.saveSettings();
    await act(async () => { context.updateSetting('location.coordinates.long', '0'); context.updateSetting('location.timezone', 'Invalid'); });
    await context.saveSettings();
    
    await act(async () => { context.updateSetting('location.timezone', 'Europe/London'); });
    validateSourceSettings.mockReturnValueOnce('Err');
    await context.saveSettings();

    validateTrigger.mockResolvedValueOnce('Err');
    await context.saveSettings();
  });

  it('should cover health and dirty branches', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

    // Section health
    context.getSectionHealth('prayers.fajr');
    context.getSectionHealth('automation.triggers');
    context.getSectionHealth('automation.triggers.fajr.adhan');

    // Section dirty
    act(() => { context.updateSetting('id', 'new'); });
    expect(context.isSectionDirty('id')).toBe(true);
    
    // refreshHealth
    await act(async () => { await context.refreshHealth(); });
  });

  it('should cover utility methods and errors', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

    await context.resetToDefaults();
    await context.updateEnvSetting('BASE_URL', 'v');
    act(() => { context.bulkUpdateOffsets('adhan', 10); });
    act(() => { context.bulkUpdateOffsets('preIqamah', 10); });

    // Catch blocks
    fetch.mockImplementation(async () => { throw new Error('E'); });
    await context.refreshHealth();
    await context.saveSettings();
    await context.resetToDefaults();
    await context.updateEnvSetting('K', 'v');
  });

  it('should cover rate limit status branches', async () => {
      fetch.mockImplementation(async (url) => mockResponse({}, false, 429));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<SettingsProvider><TestComponent /></SettingsProvider>);
      await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
      consoleSpy.mockRestore();
  });

  describe('bulkUpdateIqamahOffsets (FEAT-005)', () => {
    const configWithIqamah = {
      ...baseConfig,
      prayers: {
        fajr: { iqamahOffset: 20, roundTo: 15, fixedTime: null, iqamahOverride: false },
        sunrise: { iqamahOffset: 0, roundTo: 0, fixedTime: null, iqamahOverride: false },
        dhuhr: { iqamahOffset: 15, roundTo: 15, fixedTime: null, iqamahOverride: false },
        asr: { iqamahOffset: 15, roundTo: 15, fixedTime: null, iqamahOverride: false },
        maghrib: { iqamahOffset: 10, roundTo: 5, fixedTime: null, iqamahOverride: false },
        isha: { iqamahOffset: 15, roundTo: 15, fixedTime: null, iqamahOverride: true }
      }
    };

    const iqamahFetchMock = async (url) => {
      if (url.includes('/api/settings')) return mockResponse(configWithIqamah);
      if (url.includes('/api/system/voices')) return mockResponse([]);
      if (url.includes('/api/system/providers')) return mockResponse([]);
      return mockResponse({});
    };

    const IqamahTestComponent = ({ callback }) => {
      const s = useSettings();
      React.useEffect(() => { if (callback) callback(s); }, [s, callback]);
      if (s.loading && !s.config) return <div data-testid="loading">Loading...</div>;
      return (
        <div data-testid="done">
          <span data-testid="fajr-offset">{s.draftConfig?.prayers?.fajr?.iqamahOffset}</span>
          <span data-testid="sunrise-offset">{s.draftConfig?.prayers?.sunrise?.iqamahOffset}</span>
          <span data-testid="dhuhr-offset">{s.draftConfig?.prayers?.dhuhr?.iqamahOffset}</span>
          <span data-testid="asr-offset">{s.draftConfig?.prayers?.asr?.iqamahOffset}</span>
          <span data-testid="maghrib-offset">{s.draftConfig?.prayers?.maghrib?.iqamahOffset}</span>
          <span data-testid="isha-offset">{s.draftConfig?.prayers?.isha?.iqamahOffset}</span>
          <span data-testid="isha-override">{String(s.draftConfig?.prayers?.isha?.iqamahOverride)}</span>
        </div>
      );
    };

    it('should update iqamahOffset for all prayers except sunrise', async () => {
      fetch.mockImplementation(iqamahFetchMock);
      let context;
      render(<SettingsProvider><IqamahTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      act(() => { context.bulkUpdateIqamahOffsets(25); });

      await waitFor(() => {
        expect(screen.getByTestId('fajr-offset').textContent).toBe('25');
        expect(screen.getByTestId('sunrise-offset').textContent).toBe('0');
        expect(screen.getByTestId('dhuhr-offset').textContent).toBe('25');
        expect(screen.getByTestId('asr-offset').textContent).toBe('25');
        expect(screen.getByTestId('maghrib-offset').textContent).toBe('25');
        expect(screen.getByTestId('isha-offset').textContent).toBe('25');
      });
    });

    it('should preserve iqamahOverride boolean (Safe Mode)', async () => {
      fetch.mockImplementation(iqamahFetchMock);
      let context;
      render(<SettingsProvider><IqamahTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      act(() => { context.bulkUpdateIqamahOffsets(30); });

      await waitFor(() => {
        expect(screen.getByTestId('isha-override').textContent).toBe('true');
      });
    });

    it('should clamp values to 0-60 range', async () => {
      fetch.mockImplementation(iqamahFetchMock);
      let context;
      render(<SettingsProvider><IqamahTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      act(() => { context.bulkUpdateIqamahOffsets(100); });
      await waitFor(() => {
        expect(screen.getByTestId('fajr-offset').textContent).toBe('60');
      });

      act(() => { context.bulkUpdateIqamahOffsets(-5); });
      await waitFor(() => {
        expect(screen.getByTestId('fajr-offset').textContent).toBe('0');
      });
    });

    it('should handle NaN input gracefully', async () => {
      fetch.mockImplementation(iqamahFetchMock);
      let context;
      render(<SettingsProvider><IqamahTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      act(() => { context.bulkUpdateIqamahOffsets('abc'); });
      await waitFor(() => {
        expect(screen.getByTestId('fajr-offset').textContent).toBe('0');
      });
    });

    it('should return 0 count when draftConfig is null', async () => {
      fetch.mockImplementation(async () => mockResponse(null));
      let context;
      render(<SettingsProvider><IqamahTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('loading')).toBeDefined());

      const count = context.bulkUpdateIqamahOffsets(10);
      expect(count).toBe(0);
    });
  });

  describe('Health check fetch on mount (Issue #37)', () => {
    const HealthTestComponent = ({ callback }) => {
      const s = useSettings();
      React.useEffect(() => { if (callback) callback(s); }, [s, callback]);
      if (s.loading && !s.config) return <div data-testid="loading">Loading...</div>;
      return (
        <div data-testid="done">
          <span data-testid="health-tts">{String(s.systemHealth?.tts?.healthy)}</span>
          <span data-testid="health-local">{String(s.systemHealth?.local?.healthy)}</span>
          <span data-testid="health-voicemonkey">{String(s.systemHealth?.voicemonkey?.healthy ?? 'undefined')}</span>
        </div>
      );
    };

    it('should fetch health state from backend on mount', async () => {
      const healthData = {
        local: { healthy: true },
        tts: { healthy: false, message: 'TTS service unavailable' },
        voicemonkey: { healthy: false, message: 'Not configured' }
      };
      fetch.mockImplementation(async (url) => {
        if (url.includes('/api/system/health')) return mockResponse(healthData);
        if (url.includes('/api/settings')) return mockResponse(baseConfig);
        if (url.includes('/api/system/voices')) return mockResponse([]);
        if (url.includes('/api/system/providers')) return mockResponse([]);
        return mockResponse({});
      });

      render(<SettingsProvider><HealthTestComponent /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      // Verify health endpoint was called on mount
      const healthCalls = fetch.mock.calls.filter(([url]) => 
        url.includes('/api/system/health') && !url.includes('/refresh')
      );
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should populate systemHealth from API response, not optimistic defaults', async () => {
      const healthData = {
        local: { healthy: true },
        tts: { healthy: false, message: 'TTS service unavailable' },
        voicemonkey: { healthy: false, message: 'Not configured' }
      };
      fetch.mockImplementation(async (url) => {
        if (url.includes('/api/system/health')) return mockResponse(healthData);
        if (url.includes('/api/settings')) return mockResponse(baseConfig);
        if (url.includes('/api/system/voices')) return mockResponse([]);
        if (url.includes('/api/system/providers')) return mockResponse([]);
        return mockResponse({});
      });

      let context;
      render(<SettingsProvider><HealthTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      // After mount, systemHealth should reflect the API response (unhealthy services)
      // NOT the optimistic defaults (all healthy)
      await waitFor(() => {
        expect(context.systemHealth.tts.healthy).toBe(false);
        expect(context.systemHealth.voicemonkey.healthy).toBe(false);
        expect(context.systemHealth.tts.message).toBe('TTS service unavailable');
      });
    });

    it('should fetch health even when not authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false });
      const healthData = {
        local: { healthy: true },
        tts: { healthy: false, message: 'TTS offline' }
      };
      fetch.mockImplementation(async (url) => {
        if (url.includes('/api/system/health')) return mockResponse(healthData);
        if (url.includes('/api/settings')) return mockResponse(baseConfig);
        return mockResponse({});
      });

      render(<SettingsProvider><HealthTestComponent /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      // Health endpoint requires no auth, should be called regardless
      const healthCalls = fetch.mock.calls.filter(([url]) => 
        url.includes('/api/system/health') && !url.includes('/refresh')
      );
      expect(healthCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse health data from 503 responses (degraded system)', async () => {
      const healthData = {
        local: { healthy: true, lastChecked: '2026-03-10T17:22:57.506Z' },
        tts: { healthy: false, message: 'Service Unreachable', lastChecked: '2026-03-10T17:26:25.620Z' },
        voicemonkey: { healthy: false, message: 'Token Missing', lastChecked: '2026-03-10T17:22:57.506Z' }
      };
      fetch.mockImplementation(async (url) => {
        // Backend returns 503 when critical services are unhealthy
        if (url.includes('/api/system/health')) return mockResponse(healthData, false, 503);
        if (url.includes('/api/settings')) return mockResponse(baseConfig);
        if (url.includes('/api/system/voices')) return mockResponse([]);
        if (url.includes('/api/system/providers')) return mockResponse([]);
        return mockResponse({});
      });

      let context;
      render(<SettingsProvider><HealthTestComponent callback={(s) => context = s} /></SettingsProvider>);
      await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());

      // Even though the response is 503, the health data should be parsed and used
      await waitFor(() => {
        expect(context.systemHealth.tts.healthy).toBe(false);
        expect(context.systemHealth.tts.message).toBe('Service Unreachable');
        expect(context.systemHealth.voicemonkey.healthy).toBe(false);
        expect(context.systemHealth.voicemonkey.message).toBe('Token Missing');
        expect(context.systemHealth.local.healthy).toBe(true);
      });
    });
  });
});