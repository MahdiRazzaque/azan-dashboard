import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutomationSettingsView from '../../../../src/views/settings/AutomationSettingsView';
import { useSettings } from '../../../../src/hooks/useSettings';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/components/settings/automation/AutomationGeneralTab', () => ({ default: () => <div data-testid="general-tab">General Tab</div> }));
vi.mock('../../../../src/components/settings/automation/AutomationOutputsTab', () => ({ default: () => <div data-testid="outputs-tab">Outputs Tab</div> }));
vi.mock('../../../../src/components/settings/automation/AutomationVoiceTab', () => ({ default: () => <div data-testid="voice-tab">Voice Tab</div> }));

describe('AutomationSettingsView Extended Coverage', () => {
  const mockSettings = {
    config: {},
    draftConfig: { automation: { outputs: { alexa: { enabled: true } } } },
    updateSetting: vi.fn(),
    loading: false,
    systemHealth: { alexa: { healthy: true } },
    bulkUpdateOffsets: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue(mockSettings);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
        if (url === '/api/system/outputs/registry') return { ok: true, json: () => Promise.resolve([]) };
        return { ok: true, json: () => Promise.resolve({}) };
    }));
  });

  it('should handle fetch failure in useEffect', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => ({ ok: false }));
    
    render(<MemoryRouter><AutomationSettingsView /></MemoryRouter>);
    
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it('should handle fetch error in useEffect', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => { throw new Error('Fetch Error'); });
    
    render(<MemoryRouter><AutomationSettingsView /></MemoryRouter>);
    
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it('should return true in getTabHealth if systemHealth or draftConfig is missing', () => {
    mockSettings.systemHealth = null;
    render(<MemoryRouter><AutomationSettingsView /></MemoryRouter>);
    expect(screen.queryByTitle(/AlertTriangle/)).toBeNull();
  });

  it('should show unhealthy indicator for outputs tab when an enabled output is offline', () => {
    mockSettings.systemHealth = { alexa: { healthy: false } };
    mockSettings.draftConfig.automation.outputs.alexa.enabled = true;
    
    render(<MemoryRouter><AutomationSettingsView /></MemoryRouter>);
    
    const outputsTab = screen.getByText('Outputs').closest('button');
    expect(outputsTab.querySelector('.lucide-alert-triangle')).toBeDefined();
  });
});
