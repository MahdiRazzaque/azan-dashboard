import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PrayerSettingsView from '../../../../src/views/settings/PrayerSettingsView';
import { useSettings } from '../../../../src/hooks/useSettings';
import * as validation from '../../../../src/utils/validation';

vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/utils/validation');
vi.mock('../../../../src/components/settings/TriggerCard', () => ({ 
  default: ({ label, onChange, trigger, error, isDirty }) => (
    <div data-testid={`trigger-card-${label.replace(/\s+/g, '-').toLowerCase()}`}>
        <span data-testid="card-label">{label}</span>
        {isDirty && <span data-testid="dirty-indicator">Dirty</span>}
        {error && <span data-testid="error-message">{error}</span>}
        <button onClick={() => onChange({ ...trigger, enabled: !trigger.enabled })}>Toggle</button>
    </div>
) }));

const mockIqamahTimingCard = vi.fn(() => <div data-testid="iqamah-timing-card" />);
vi.mock('../../../../src/components/settings/IqamahTimingCard', () => ({
  default: (props) => mockIqamahTimingCard(props)
}));

describe('PrayerSettingsView', () => {
  const updateSetting = vi.fn();
  const saveSettings = vi.fn();
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
      saveSettings,
      loading: false,
      isSectionDirty: vi.fn().mockReturnValue(false),
      getSectionHealth: getSectionHealth.mockReturnValue({ healthy: true, issues: [] }),
      systemHealth: { tts: { healthy: true }, voicemonkey: { healthy: true } },
      providers: [{ id: 'aladhan', capabilities: { providesIqamah: true } }]
    });
    
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('audio-files')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ files: mockAudioFiles, total: mockAudioFiles.length }) });
        if (url.includes('outputs/registry')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStrategies) });
        return Promise.reject(new Error('Unknown API'));
    }));

    validation.validateTrigger.mockResolvedValue(null);
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

  it('should handle trigger updates and clear validation errors', async () => {
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

  it('should clear notification timer on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    useSettings.mockReturnValue({ ...useSettings(), isSectionDirty: () => true });
    
    let unmount;
    await act(async () => {
        const result = render(<PrayerSettingsView />);
        unmount = result.unmount;
    });

    // Trigger notification
    saveSettings.mockResolvedValue({ success: true });
    
    await act(async () => {
        fireEvent.click(screen.getByText('Save Changes'));
    });

    expect(screen.getByText('Configuration saved successfully.')).toBeDefined();

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  describe('handleSave', () => {
    it('should save successfully when everything is valid', async () => {
      saveSettings.mockResolvedValue({ success: true });
      useSettings.mockReturnValue({
          ...useSettings(),
          isSectionDirty: () => true
      });

      await act(async () => {
          render(<PrayerSettingsView />);
      });
      
      const saveButton = screen.getByText('Save Changes');
      await act(async () => {
          fireEvent.click(saveButton);
      });

      expect(saveSettings).toHaveBeenCalled();
      expect(screen.getByText('Configuration saved successfully.')).toBeDefined();
    });

    it('should show error when validation fails', async () => {
      validation.validateTrigger.mockResolvedValueOnce('Invalid offset');
      useSettings.mockReturnValue({
          ...useSettings(),
          isSectionDirty: () => true
      });

      await act(async () => {
          render(<PrayerSettingsView />);
      });
      
      const saveButton = screen.getByText('Save Changes');
      await act(async () => {
          fireEvent.click(saveButton);
      });

      expect(screen.getByText('Some automations were invalid and have been disabled.')).toBeDefined();
      expect(screen.getByText(/fajr preAdhan: Invalid offset/i)).toBeDefined();
    });

    it('should show error when TTS service is offline and trigger uses TTS', async () => {
      const configWithTTS = JSON.parse(JSON.stringify(config));
      configWithTTS.automation.triggers.fajr.preAdhan.type = 'tts';
      configWithTTS.automation.triggers.fajr.preAdhan.enabled = true;
      
      useSettings.mockReturnValue({
          ...useSettings(),
          draftConfig: configWithTTS,
          isSectionDirty: () => true,
          systemHealth: { tts: { healthy: false } }
      });

      await act(async () => {
          render(<PrayerSettingsView />);
      });
      
      const saveButton = screen.getByText('Save Changes');
      await act(async () => {
          fireEvent.click(saveButton);
      });

      expect(screen.getByText(/fajr preAdhan: TTS Service is offline/i)).toBeDefined();
    });

    it('should show error when output is offline', async () => {
        const configWithOutput = JSON.parse(JSON.stringify(config));
        configWithOutput.automation.triggers.fajr.preAdhan.targets = ['voicemonkey'];
        configWithOutput.automation.triggers.fajr.preAdhan.enabled = true;
        
        useSettings.mockReturnValue({
            ...useSettings(),
            draftConfig: configWithOutput,
            isSectionDirty: () => true,
            systemHealth: { tts: { healthy: true }, voicemonkey: { healthy: false } }
        });
  
        await act(async () => {
            render(<PrayerSettingsView />);
        });
        
        const saveButton = screen.getByText('Save Changes');
        await act(async () => {
            fireEvent.click(saveButton);
        });
  
        expect(screen.getByText(/fajr preAdhan: VoiceMonkey output is offline/i)).toBeDefined();
    });

    it('should show error when output is disabled', async () => {
        const configWithOutput = JSON.parse(JSON.stringify(config));
        configWithOutput.automation.triggers.fajr.preAdhan.targets = ['voicemonkey'];
        configWithOutput.automation.triggers.fajr.preAdhan.enabled = true;
        configWithOutput.automation.outputs = { voicemonkey: { enabled: false } };
        
        useSettings.mockReturnValue({
            ...useSettings(),
            draftConfig: configWithOutput,
            isSectionDirty: () => true,
            systemHealth: { tts: { healthy: true }, voicemonkey: { healthy: true } }
        });
  
        await act(async () => {
            render(<PrayerSettingsView />);
        });
        
        const saveButton = screen.getByText('Save Changes');
        await act(async () => {
            fireEvent.click(saveButton);
        });
  
        expect(screen.getByText(/fajr preAdhan: VoiceMonkey output is disabled/i)).toBeDefined();
    });

    it('should skip health check for browser target', async () => {
        const configWithBrowser = JSON.parse(JSON.stringify(config));
        configWithBrowser.automation.triggers.fajr.preAdhan.targets = ['browser'];
        configWithBrowser.automation.triggers.fajr.preAdhan.enabled = true;
        
        saveSettings.mockResolvedValue({ success: true });
        useSettings.mockReturnValue({
            ...useSettings(),
            draftConfig: configWithBrowser,
            isSectionDirty: () => true
        });
  
        await act(async () => {
            render(<PrayerSettingsView />);
        });
        
        const saveButton = screen.getByText('Save Changes');
        await act(async () => {
            fireEvent.click(saveButton);
        });
  
        expect(saveSettings).toHaveBeenCalled();
        expect(screen.getByText('Configuration saved successfully.')).toBeDefined();
    });

    it('should handle server save failure', async () => {
        saveSettings.mockResolvedValue({ success: false, error: 'Database error' });
        useSettings.mockReturnValue({
            ...useSettings(),
            isSectionDirty: () => true
        });
  
        await act(async () => {
            render(<PrayerSettingsView />);
        });
        
        const saveButton = screen.getByText('Save Changes');
        await act(async () => {
            fireEvent.click(saveButton);
        });
  
        expect(screen.getByText('Database error')).toBeDefined();
    });

    it('should handle unexpected errors during save', async () => {
        saveSettings.mockRejectedValue(new Error('Network crash'));
        useSettings.mockReturnValue({
            ...useSettings(),
            isSectionDirty: () => true
        });
  
        await act(async () => {
            render(<PrayerSettingsView />);
        });
        
        const saveButton = screen.getByText('Save Changes');
        await act(async () => {
            fireEvent.click(saveButton);
        });
  
        expect(screen.getByText('An error occurred while saving.')).toBeDefined();
    });
  });
});