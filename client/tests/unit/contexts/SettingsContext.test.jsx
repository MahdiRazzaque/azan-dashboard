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
});