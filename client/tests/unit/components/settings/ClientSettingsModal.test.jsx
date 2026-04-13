import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClientSettingsModal from '../../../../src/components/settings/ClientSettingsModal';
import { useClientPreferences } from '../../../../src/hooks/useClientPreferences';
import { useSettings } from '../../../../src/hooks/useSettings';
import { useWakeLock } from '../../../../src/hooks/useWakeLock';

vi.mock('../../../../src/hooks/useClientPreferences');
vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/hooks/useWakeLock');

describe('ClientSettingsModal', () => {
  const onClose = vi.fn();
  const updateAppearance = vi.fn();
  const toggleAudioExclusion = vi.fn();
  const muteAll = vi.fn();
  const unmuteAll = vi.fn();
  const isAudioExcluded = vi.fn().mockReturnValue(false);

  const mockPreferences = {
    appearance: {
      clockFormat: '24h',
      showSeconds: true,
      countdownMode: 'normal',
      theme: 'dark',
      enableDateNavigation: true,
      prayerNameLanguage: 'english',
      skipSunriseCountdown: false,
      wakeLockAutoStart: false,
      autoUnmute: false
    },
    audioExclusions: []
  };

  const baseConfig = { automation: { global: { enabled: true } } };

  beforeEach(() => {
    vi.clearAllMocks();
    useClientPreferences.mockReturnValue({
      preferences: mockPreferences,
      updateAppearance,
      toggleAudioExclusion,
      isAudioExcluded,
      muteAll,
      unmuteAll
    });
    useSettings.mockReturnValue({ config: baseConfig });
    useWakeLock.mockReturnValue({ isSupported: true });
  });

  it('should render correctly and default to Appearance tab', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    expect(screen.getByText(/appearance settings/i)).toBeDefined();
  });

  it('should handle clock format change', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByText('12H'));
    expect(updateAppearance).toHaveBeenCalledWith('clockFormat', '12h');
  });

  it('should handle switch components in Appearance', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    const switches = screen.getAllByRole('button').filter(b => b.className.includes('inline-flex'));
    fireEvent.click(switches[0]);
    expect(updateAppearance).toHaveBeenCalledWith('showSeconds', false);
  });

  it('should handle the date navigation toggle in Appearance', () => {
    const { container } = render(<ClientSettingsModal onClose={onClose} />);
    const row = screen.getByText('Date Navigation').closest('div')?.parentElement;
    const toggle = row?.querySelector('button.inline-flex') ?? container.querySelector('button.inline-flex');

    fireEvent.click(toggle);

    expect(updateAppearance).toHaveBeenCalledWith('enableDateNavigation', false);
  });

  it('should handle the prayer name language selector in Appearance', () => {
    render(<ClientSettingsModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Arabic'));

    expect(updateAppearance).toHaveBeenCalledWith('prayerNameLanguage', 'arabic');
  });

  it('should switch tabs', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    
    fireEvent.click(screen.getByText('Prayer Audio'));
    expect(screen.getByText(/prayer audio settings/i)).toBeDefined();

    fireEvent.click(screen.getByText('System'));
    expect(screen.getByText(/system settings/i)).toBeDefined();
  });

  it('should handle mute/unmute all', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Prayer Audio'));
    
    fireEvent.click(screen.getByText('Mute All'));
    expect(muteAll).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Unmute All'));
    expect(unmuteAll).toHaveBeenCalled();
  });

  it('should handle individual audio exclusions and disabled reasons', () => {
    isAudioExcluded.mockReturnValue(true);
    useSettings.mockReturnValue({
        config: { 
            automation: { 
                global: { enabled: false }, 
                triggers: { fajr: { adhan: { enabled: true } } } 
            } 
        }
    });
    const { rerender } = render(<ClientSettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Prayer Audio'));
    expect(screen.getAllByTitle('Automation is globally disabled').length).toBeGreaterThan(0);

    // 2. Event type disabled
    useSettings.mockReturnValue({
        config: { automation: { global: { enabled: true, adhanEnabled: false }, triggers: { fajr: { adhan: { enabled: true } } } } }
    });
    rerender(<ClientSettingsModal onClose={onClose} />);
    expect(screen.getAllByTitle(/adhan events are disabled globally/i).length).toBeGreaterThan(0);

    // 3. Trigger disabled
    useSettings.mockReturnValue({
        config: { 
            automation: { 
                global: { enabled: true, adhanEnabled: true }, 
                triggers: { fajr: { adhan: { enabled: false } } } 
            } 
        }
    });
    rerender(<ClientSettingsModal onClose={onClose} />);
    expect(screen.getAllByTitle(/this automation is disabled system-wide/i).length).toBeGreaterThan(0);

    const muteButtons = screen.getAllByRole('button').filter(b => b.className.includes('w-10 h-10'));
    fireEvent.click(muteButtons[0]);
    expect(toggleAudioExclusion).toHaveBeenCalled();
  });

  it('should handle system toggles', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByText('System'));
    const switches = screen.getAllByRole('button').filter(b => b.className.includes('inline-flex'));
    
    fireEvent.click(switches[0]); // Skip Sunrise
    expect(updateAppearance).toHaveBeenCalledWith('skipSunriseCountdown', true);
  });

  it('should call onClose when backdrop or X clicked', () => {
    const { container } = render(<ClientSettingsModal onClose={onClose} />);
    const backdrop = container.firstChild.firstChild;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();

    const xButton = screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-x'));
    fireEvent.click(xButton);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should show Restart Tour button in system tab', () => {
    render(<ClientSettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByText('System'));
    expect(screen.getByText('Restart Tour')).toBeDefined();
  });

  it('should call fetch on Restart Tour click', async () => {
    render(<ClientSettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByText('System'));
    fireEvent.click(screen.getByText('Restart Tour'));
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/tour-state', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ dashboardSeen: false })
    }));
  });
});
