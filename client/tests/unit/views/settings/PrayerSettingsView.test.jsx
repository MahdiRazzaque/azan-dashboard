import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PrayerSettingsView from '../../../../src/views/settings/PrayerSettingsView';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useSettings');

const mockTriggerCard = vi.fn(({ label, onChange, trigger, extraContent, error, isDirty }) => (
  <div data-testid={`trigger-card-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <span data-testid="card-label">{label}</span>
      {isDirty && <span data-testid="dirty-indicator">Dirty</span>}
      {error && <span data-testid="error-message">{error}</span>}
      <button onClick={() => onChange({ ...trigger, enabled: !trigger.enabled })}>Toggle</button>
      <div data-testid="extra-content">{extraContent}</div>
  </div>
));
vi.mock('../../../../src/components/settings/TriggerCard', () => ({
  default: (props) => mockTriggerCard(props)
}));

const mockIqamahTimingCard = vi.fn(() => <div data-testid="iqamah-timing-card" />);
vi.mock('../../../../src/components/settings/IqamahTimingCard', () => ({
  default: (props) => mockIqamahTimingCard(props)
}));
describe('PrayerSettingsView', () => {
  const updateSetting = vi.fn();
  const getSectionHealth = vi.fn();
  const config = {
    sources: { primary: { type: 'aladhan' } },
    prayers: { 
        fajr: { iqamahOffset: 15, fixedTime: null, iqamahOverride: false, roundTo: 0 }, 
        sunrise: {}, 
        dhuhr: { iqamahOffset: 15, fixedTime: null, iqamahOverride: false, roundTo: 0 }, 
        asr: { iqamahOffset: 15, fixedTime: null, iqamahOverride: false, roundTo: 0 }, 
        maghrib: { iqamahOffset: 15, fixedTime: null, iqamahOverride: false, roundTo: 0 }, 
        isha: { iqamahOffset: 15, fixedTime: null, iqamahOverride: false, roundTo: 0 } 
    },
    automation: { triggers: { 
        fajr: { preAdhan: { enabled: true, targets: [] }, adhan: { enabled: true, targets: [] }, preIqamah: { enabled: true, targets: [] }, iqamah: { enabled: true, targets: [] } },
        sunrise: { preAdhan: { enabled: true, targets: [] }, adhan: { enabled: true, targets: [] } },
        dhuhr: { preAdhan: { enabled: true, targets: [] }, adhan: { enabled: true, targets: [] }, preIqamah: { enabled: true, targets: [] }, iqamah: { enabled: true, targets: [] } },
        asr: { preAdhan: { enabled: true, targets: [] }, adhan: { enabled: true, targets: [] }, preIqamah: { enabled: true, targets: [] }, iqamah: { enabled: true, targets: [] } },
        maghrib: { preAdhan: { enabled: true, targets: [] }, adhan: { enabled: true, targets: [] }, preIqamah: { enabled: true, targets: [] }, iqamah: { enabled: true, targets: [] } },
        isha: { preAdhan: { enabled: true, targets: [] }, adhan: { enabled: true, targets: [] }, preIqamah: { enabled: true, targets: [] }, iqamah: { enabled: true, targets: [] } }
    } }
  };

  const mockAudioFiles = [
    { name: 'adhan.mp3', type: 'custom' },
    { name: 'cached.mp3', type: 'cache' }
  ];

  const mockStrategies = [
    { id: 'browser', label: 'Browser' },
    { id: 'voicemonkey', label: 'VoiceMonkey' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      draftConfig: JSON.parse(JSON.stringify(config)),
      config,
      updateSetting,
      loading: false,
      isSectionDirty: vi.fn().mockReturnValue(false),
      getSectionHealth: getSectionHealth.mockReturnValue({ healthy: true, issues: [] }),
      providers: [{ id: 'aladhan', capabilities: { providesIqamah: true } }]
    });
    
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('audio-files')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ files: mockAudioFiles, total: mockAudioFiles.length }) });
        if (url.includes('outputs/registry')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStrategies) });
        return Promise.reject(new Error('Unknown API'));
    }));

  });

  it('should render correctly and fetch initial data', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });
    expect(screen.getByText('Prayer Configuration')).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith('/api/system/audio-files');
    expect(global.fetch).toHaveBeenCalledWith('/api/system/outputs/registry');
  });

  it('should switch tabs and show sunrise specific triggers', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    await act(async () => {
        fireEvent.click(screen.getByText(/sunrise/i));
    });
    
    // Sunrise only has 2 triggers
    expect(screen.getAllByTestId(/trigger-card-/).length).toBe(2);
  });

  it('should handle trigger updates', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    const toggleButton = screen.getAllByText('Toggle')[0];
    await act(async () => {
        fireEvent.click(toggleButton);
    });
    
    expect(updateSetting).toHaveBeenCalled();
  });

  it('should render IqamahTimingCard for non-sunrise prayers', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    expect(screen.getByTestId('iqamah-timing-card')).toBeDefined();
    expect(mockIqamahTimingCard).toHaveBeenCalledWith(
        expect.objectContaining({
            activeTab: 'fajr',
            currentPrayerSettings: config.prayers.fajr,
            providers: [{ id: 'aladhan', capabilities: { providesIqamah: true } }],
            sources: config.sources
        })
    );
  });

  it('should not render IqamahTimingCard for sunrise', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    await act(async () => {
        fireEvent.click(screen.getByText(/sunrise/i));
    });
    
    // IqamahTimingCard should not be rendered for sunrise
    // Reset mock calls and check the last render had no IqamahTimingCard
    expect(screen.queryAllByTestId('iqamah-timing-card').length).toBe(0);
  });

  it('should pass isDirty to IqamahTimingCard when prayer settings change', async () => {
    useSettings.mockReturnValue({
        ...useSettings(),
        draftConfig: {
            ...config,
            prayers: { ...config.prayers, fajr: { ...config.prayers.fajr, iqamahOffset: 99 } }
        }
    });

    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    expect(mockIqamahTimingCard).toHaveBeenCalledWith(
        expect.objectContaining({
            isDirty: true
        })
    );
  });

  it('should not render extraContent on iqamah TriggerCard', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    const iqamahCard = screen.getByTestId('trigger-card-4.-iqamah');
    expect(iqamahCard).toBeDefined();

    // Verify the iqamah TriggerCard was not called with an extraContent prop
    const iqamahCall = mockTriggerCard.mock.calls.find(
        ([props]) => props.label === '4. Iqamah'
    );
    expect(iqamahCall).toBeDefined();
    expect(iqamahCall[0]).not.toHaveProperty('extraContent');
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch failed')));

    await act(async () => {
        render(<PrayerSettingsView />);
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to load audio files", expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch output strategies", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should show health issues in tooltip', async () => {
    const getSectionHealth = vi.fn().mockImplementation((path) => 
        path === 'prayers.fajr' ? { healthy: false, issues: [{type: 'Connection Error'}] } : { healthy: true, issues: [] }
    );
    useSettings.mockReturnValue({
        ...useSettings(),
        getSectionHealth
    });

    await act(async () => {
        render(<PrayerSettingsView />);
    });
    
    expect(screen.getByText('Connection Error')).toBeDefined();
  });

  it('should NOT render a local Save Changes button (save is handled globally)', async () => {
    useSettings.mockReturnValue({
        ...useSettings(),
        isSectionDirty: () => true
    });

    await act(async () => {
        render(<PrayerSettingsView />);
    });

    expect(screen.queryByText('Save Changes')).toBeNull();
    expect(screen.queryByText('Saving...')).toBeNull();
  });

  it('should NOT render notification toasts (no local save/validation)', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });

    // No notification elements should be present at all
    expect(screen.queryByText('Configuration saved successfully.')).toBeNull();
    expect(screen.queryByText('Some automations were invalid and have been disabled.')).toBeNull();
  });

  it('should NOT pass error props to TriggerCards', async () => {
    await act(async () => {
        render(<PrayerSettingsView />);
    });

    // No error-message test IDs should be rendered in any TriggerCard
    expect(screen.queryAllByTestId('error-message')).toHaveLength(0);
  });

  });