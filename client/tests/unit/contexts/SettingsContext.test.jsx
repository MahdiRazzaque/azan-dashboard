import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { useSettings } from '../../../src/hooks/useSettings';
import { useAuth } from '../../../src/hooks/useAuth';
import { validateTrigger, validateSourceSettings } from '../../../src/utils/validation';

vi.mock('../../../src/hooks/useAuth');
vi.mock('../../../src/utils/validation');

const TestComponent = () => {
  const s = useSettings();
  if (s.loading && !s.config) return <div data-testid="loading">Loading...</div>;
  return (
    <div>
      <div data-testid="config">{s.config?.id}</div>
      <div data-testid="dirty">{s.hasUnsavedChanges() ? 'Yes' : 'No'}</div>
      <button onClick={() => s.updateSetting('test', 'val')}>Update</button>
      <button onClick={() => s.saveSettings()}>Save</button>
      <button onClick={() => s.bulkUpdateOffsets('preAdhan', 20)}>Bulk</button>
      <button onClick={() => s.resetDraft()}>Reset</button>
      <button onClick={() => s.resetToDefaults()}>Reset Defaults</button>
      <button onClick={() => s.refreshHealth('all')}>Refresh Health</button>
      <button onClick={() => s.updateEnvSetting('BASE_URL', 'https://test.com')}>Update Env</button>
    </div>
  );
};

describe('SettingsContext', () => {
  const mockResponse = (data, ok = true, status = 200) => ({
    ok,
    status,
    json: () => Promise.resolve(data),
    headers: { get: () => '60' }
  });

  const baseConfig = { 
    id: 'orig', 
    sources: { primary: { type: 'aladhan', enabled: true } },
    prayers: { fajr: {} },
    automation: { 
        outputs: { local: { enabled: true } },
        triggers: { 
            fajr: { adhan: { enabled: true, offsetMinutes: 15, type: 'tts', targets: ['local'] } }
        } 
    } 
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        if (url.includes('/api/settings')) return Promise.resolve(mockResponse(baseConfig));
        if (url.includes('/api/system/health')) return Promise.resolve(mockResponse({ tts: { healthy: true }, local: { healthy: true } }));
        if (url.includes('/api/system/voices')) return Promise.resolve(mockResponse([]));
        if (url.includes('/api/system/providers')) return Promise.resolve(mockResponse([{ id: 'aladhan' }]));
        return Promise.resolve(mockResponse({}));
    }));
    useAuth.mockReturnValue({ isAuthenticated: true });
    validateSourceSettings.mockReturnValue(null);
    validateTrigger.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch all settings on mount when authenticated', async () => {
    render(<SettingsProvider><TestComponent /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId('config').textContent).toBe('orig'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/settings'), expect.any(Object));
  });

  it('should handle successful save', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/api/settings/update')) return Promise.resolve(mockResponse({ success: true }));
        if (url.includes('/api/system/providers')) return Promise.resolve(mockResponse([{ id: 'aladhan' }]));
        return Promise.resolve(mockResponse(baseConfig));
    });

    render(<SettingsProvider><TestComponent /></SettingsProvider>);
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/settings/update', expect.any(Object)));
  });

  it('should handle all section health branches', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/api/settings')) return Promise.resolve(mockResponse(baseConfig));
        if (url.includes('/api/system/health')) return Promise.resolve(mockResponse({ tts: { healthy: true }, local: { healthy: false } }));
        return Promise.resolve(mockResponse({}));
    });

    let context;
    const TestHealth = () => {
        context = useSettings();
        if (!context.config) return <div data-testid="loading-health">Loading...</div>;
        return null;
    };
    render(<SettingsProvider><TestHealth /></SettingsProvider>);
    await waitFor(() => expect(screen.queryByTestId('loading-health')).toBeNull());

    // 1. automation.outputs - This path doesn't exist in getSectionHealth logic specifically, 
    // it goes to the default checkTrigger via getVal which returns undefined for outputs if not matched.
    // Wait, getSectionHealth('automation.outputs') -> getVal returns the outputs object.
    // But checkTrigger is only called for path.startsWith('prayers.'), path === 'automation', etc.
    // Let's test 'automation' instead which covers the outputs.
    const h1 = context.getSectionHealth('automation');
    expect(h1.healthy).toBe(false);
    expect(h1.issues.some(i => i.type === 'local Output Offline')).toBe(true);

    const h2 = context.getSectionHealth('prayers.fajr');
    expect(h2.healthy).toBe(false); 
  });

  it('should handle refreshHealth exceptions', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockImplementation((url) => {
        if (url.includes('/api/system/health/refresh')) return Promise.reject(new Error('Fail'));
        return Promise.resolve(mockResponse(baseConfig));
    });
    
    let capturedResult = null;
    const TestHealthAction = () => {
        const { refreshHealth, config } = useSettings();
        if (!config) return <div>Loading...</div>;
        return <button onClick={async () => { capturedResult = await refreshHealth(); }}>Refresh</button>;
    };
    render(<SettingsProvider><TestHealthAction /></SettingsProvider>);
    await waitFor(() => screen.getByText('Refresh'));
    
    await act(async () => {
        fireEvent.click(screen.getByText('Refresh'));
    });
    
    // In catch block, nothing is returned, so result is undefined.
    // But we verified it doesn't crash and logs error.
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
