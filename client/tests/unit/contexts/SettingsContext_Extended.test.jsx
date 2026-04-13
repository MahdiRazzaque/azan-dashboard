import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  return <div data-testid="done">Done</div>;
};

describe('SettingsContext Extended Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ isAuthenticated: true });
    validateSourceSettings.mockReturnValue(null);
    validateTrigger.mockResolvedValue(null);
    global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/api/settings')) return mockResponse(baseConfig);
        if (url.includes('/api/system/health')) return mockResponse({});
        if (url.includes('/api/system/voices')) return mockResponse([]);
        if (url.includes('/api/system/providers')) return mockResponse([]);
        return mockResponse({});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle rate limit in fetchSettings', async () => {
    fetch.mockImplementationOnce(async () => mockResponse({}, false, 429));
    render(<SettingsProvider><TestComponent /></SettingsProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('should handle rate limit in refreshHealth (via manual call)', async () => {
    // Note: fetchHealth is no longer called on page load, so we test refreshHealth instead
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    fetch.mockImplementationOnce(async () => mockResponse({ message: 'Rate limited' }, false, 429));
    const result = await context.refreshHealth();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited');
  });

  it('should handle fetchVoices failure', async () => {
    fetch.mockImplementation(async (url) => {
        if (url.includes('/api/system/voices')) return mockResponse({}, false, 500);
        return mockResponse(baseConfig);
    });
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(context.voicesError).toBe('Failed to fetch voices'));
  });

  it('should handle rate limit in refreshHealth', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    fetch.mockImplementationOnce(async () => mockResponse({ message: 'Rate limited' }, false, 429));
    const result = await context.refreshHealth();
    expect(result.error).toBe('Rate limited');
  });

  it('should handle rate limit in saveSettings', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    // Must modify config first, otherwise saveSettings returns early with "No configuration to save"
    act(() => {
      context.updateSetting('id', 'modified');
    });
    fetch.mockImplementationOnce(async () => mockResponse({ message: 'Rate limited' }, false, 429, { 'Retry-After': '30' }));
    const result = await context.saveSettings();
    expect(result.error).toBe('Rate limited');
  });

  it('should handle saveSettings failure', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    // Must modify config first, otherwise saveSettings returns early with "No configuration to save"
    act(() => {
      context.updateSetting('id', 'modified');
    });
    fetch.mockImplementationOnce(async () => mockResponse({ error: 'Save failed' }, false, 400));
    const result = await context.saveSettings();
    expect(result.error).toBe('Save failed');
  });

  it('should handle resetToDefaults failure', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    fetch.mockImplementationOnce(async () => mockResponse({ error: 'Reset failed' }, false, 400));
    const result = await context.resetToDefaults();
    expect(result.error).toBe('Reset failed');
  });

  it('should handle updateEnvSetting failure', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    fetch.mockImplementationOnce(async () => mockResponse({ message: 'Env update failed' }, false, 400));
    const result = await context.updateEnvSetting('KEY', 'VAL');
    expect(result.error).toBe('Env update failed');
  });

  it('should cover getSectionHealth issues', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    await act(async () => {
        fetch.mockImplementation(async (url) => {
            if (url.includes('/api/system/health')) return mockResponse({ tts: { healthy: false }, local: { healthy: false } });
            return mockResponse(baseConfig);
        });
        await context.refreshHealth(); 
    });
    await waitFor(() => {
        const health = context.getSectionHealth('automation.triggers.fajr.adhan');
        return health.healthy === false;
    });
    const health = context.getSectionHealth('automation.triggers.fajr.adhan');
    expect(health.healthy).toBe(false);
    expect(health.issues.length).toBeGreaterThan(0);
  });

  it('should cover getSectionHealth with disabled output', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    await act(async () => {
        context.updateSetting('automation.outputs.local.enabled', false);
    });
    const health = context.getSectionHealth('automation.triggers.fajr.adhan');
    expect(health.healthy).toBe(false);
    expect(health.issues.some(i => i.type === 'local Output Disabled')).toBe(true);
  });

  it('should cover bulkUpdateOffsets edge case', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    act(() => {
        context.bulkUpdateOffsets('preIqamah', 10);
    });
  });

  it('should cover hasUnsavedChanges', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    expect(context.hasUnsavedChanges()).toBe(false);
    act(() => {
        context.updateSetting('id', 'changed');
    });
    expect(context.hasUnsavedChanges()).toBe(true);
  });

  it('should cover hasUnsavedChanges with null config', async () => {
    fetch.mockImplementationOnce(async () => mockResponse(null));
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    expect(context.hasUnsavedChanges()).toBe(false);
  });

  it('should cover validateBeforeSave', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    expect(context.validateBeforeSave().success).toBe(true);
  });

  it('should cover resetDraft', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    act(() => {
        context.updateSetting('id', 'changed');
    });
    expect(context.draftConfig.id).toBe('changed');
    act(() => {
        context.resetDraft();
    });
    expect(context.draftConfig.id).toBe('orig');
  });

  it('should cover getSectionHealth for automation section', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    await act(async () => {
        fetch.mockImplementation(async (url) => {
            if (url.includes('/api/system/health')) return mockResponse({ tts: { healthy: false } });
            return mockResponse(baseConfig);
        });
        await context.refreshHealth();
    });
    const health = context.getSectionHealth('automation');
    expect(health.healthy).toBe(false);
  });

  it('should cover saveSettings success with warnings', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    expect(await screen.findByTestId('done')).toBeDefined();
    
    // Replace the entire mock implementation with URL-specific routing
    fetch.mockImplementation(async (url) => {
      if (url.includes('/api/settings/update')) {
        return mockResponse({ success: true, message: 'Saved', warnings: ['W1'] });
      }
      // Fallback for other endpoints
      if (url.includes('/api/settings')) return mockResponse(baseConfig);
      if (url.includes('/api/system/health')) return mockResponse({});
      if (url.includes('/api/system/voices')) return mockResponse([]);
      if (url.includes('/api/system/providers')) return mockResponse([]);
      return mockResponse({});
    });
    
    const result = await context.saveSettings();
    expect(result.success).toBe(true);
    expect(result.warning).toBe(true);
    expect(result.warningsList).toContain('W1');
  });

  it('should cover saveSettings with disabled backup source', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());
    act(() => {
        context.updateSetting('sources.backup.enabled', false);
    });
    fetch.mockImplementationOnce(async () => mockResponse({ success: true }));
    const result = await context.saveSettings();
    expect(result.success).toBe(true);
  });

  it('should handle fetchVoices error', async () => {
    fetch.mockImplementation(async (url) => {
        if (url.includes('/api/system/voices')) throw new Error('Voice Error');
        return mockResponse(baseConfig);
    });
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(context.voicesError).toBe('Voice Error'));
  });

  it('should handle fetchProviders error', async () => {
    fetch.mockImplementation(async (url) => {
        if (url.includes('/api/system/providers')) throw new Error('Provider Error');
        return mockResponse(baseConfig);
    });
    render(<SettingsProvider><TestComponent /></SettingsProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/system/providers'), expect.anything()));
  });

  it('should handle fetchSettings error', async () => {
    fetch.mockImplementation(async (url) => {
        if (url.includes('/api/settings')) throw new Error('Settings Error');
        return mockResponse({});
    });
    render(<SettingsProvider><TestComponent /></SettingsProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/settings'), expect.anything()));
  });

  it('should handle refreshHealth error (via manual call)', async () => {
    // Note: fetchHealth is no longer called on page load, so we test refreshHealth instead
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());
    
    // Mock the next fetch to throw an error
    fetch.mockImplementationOnce(async () => { throw new Error('Health Error'); });
    
    // This should gracefully handle the error and not throw
    const result = await context.refreshHealth();
    expect(result).toBeUndefined(); // Error is caught and logged, returns undefined
  });

  it('should cover getSectionHealth with offline output (final attempt v4)', async () => {
    let context;
    render(<SettingsProvider><TestComponent callback={(s) => context = s} /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('done')).toBeDefined());
    await act(async () => {
        fetch.mockImplementation(async (url) => {
            if (url.includes('/api/system/health')) return mockResponse({ 
                local: { healthy: false },
                tts: { healthy: true }
            });
            return mockResponse(baseConfig);
        });
        await context.refreshHealth(); 
    });
    const health = context.getSectionHealth('automation.triggers.fajr.adhan');
    expect(health.healthy).toBe(false);
    expect(health.issues.some(i => i.type === 'local Output Offline')).toBe(true);
  });
});
