import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import TopControls from '../../../../src/components/layout/TopControls';
import { useWakeLock } from '../../../../src/hooks/useWakeLock';
import { useClientPreferences } from '../../../../src/hooks/useClientPreferences';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useWakeLock');
vi.mock('../../../../src/hooks/useClientPreferences');
vi.mock('../../../../src/hooks/useSettings');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});
vi.mock('../../../../src/components/settings/ClientSettingsModal', () => ({ default: ({ onClose }) => <div data-testid="client-settings-modal"><button onClick={onClose}>Close</button></div> }));

describe('TopControls', () => {
  const mockNavigate = vi.fn();
  const mockWakeLock = {
    isSupported: true,
    isActive: false,
    error: null,
    request: vi.fn(),
    release: vi.fn()
  };
  const mockPreferences = {
    appearance: {
      wakeLockAutoStart: false
    }
  };
  const mockSettings = {
    systemHealth: { primarySource: { healthy: true } },
    config: { automation: { triggers: {} } }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useNavigate.mockReturnValue(mockNavigate);
    useWakeLock.mockReturnValue(mockWakeLock);
    useClientPreferences.mockReturnValue({ preferences: mockPreferences });
    useSettings.mockReturnValue(mockSettings);
  });

  it('should toggle mute', () => {
    const toggleMute = vi.fn();
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={toggleMute} blocked={false} /></MemoryRouter>);
    const muteButton = screen.getAllByRole('button')[1];
    fireEvent.click(muteButton);
    expect(toggleMute).toHaveBeenCalled();
  });

  it('should not show warning for unhealthy TTS service if TTS is not used', () => {
    useSettings.mockReturnValue({
      systemHealth: { 
          primarySource: { healthy: true },
          tts: { healthy: false, message: 'Service Down' }
      },
      config: { 
          automation: { 
              triggers: { 
                  fajr: { azan: { enabled: true, type: 'file' } } 
              } 
          } 
      }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    expect(screen.queryByTitle(/TTS Service/)).toBeNull();
  });

  it('should handle wake lock toggle', () => {
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const wakeLockButton = screen.getAllByRole('button')[0];
    fireEvent.click(wakeLockButton);
    expect(mockWakeLock.request).toHaveBeenCalled();

    mockWakeLock.isActive = true;
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    fireEvent.click(wakeLockButton);
    expect(mockWakeLock.release).toHaveBeenCalled();
  });

  it('should show system warning for TTS service if enabled and unhealthy', () => {
    useSettings.mockReturnValue({
      systemHealth: { 
          primarySource: { healthy: true },
          tts: { healthy: false, message: 'Service Down' }
      },
      config: { 
          automation: { 
              triggers: { 
                  fajr: { azan: { enabled: true, type: 'tts' } } 
              } 
          } 
      }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const warnings = screen.getAllByTitle(/System Warning/);
    expect(warnings[0].getAttribute('title')).toContain('TTS Service: Service Down');
  });

  it('should use fallback label for outputs without one', () => {
    useSettings.mockReturnValue({
      systemHealth: { 
          primarySource: { healthy: true },
          browser: { healthy: true },
          voicemonkey: { healthy: false } // No label
      },
      config: { 
          automation: { 
              outputs: { 
                  voicemonkey: { enabled: true } 
              },
              triggers: { 
                  fajr: { azan: { enabled: true, type: 'file', targets: ['voicemonkey'] } } 
              } 
          } 
      }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const warnings = screen.getAllByTitle(/System Warning/);
    expect(warnings[0].getAttribute('title')).toContain('Voicemonkey is used by fajr azan but is OFFLINE');
  });

  it('should use fallback message for primarySource if message is missing', () => {
    useSettings.mockReturnValue({
      systemHealth: { 
          primarySource: { healthy: false } // No message
      },
      config: { automation: { triggers: {} } }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const warnings = screen.getAllByTitle(/System Warning/);
    expect(warnings[0].getAttribute('title')).toContain('Primary Source: Offline');
  });

  it('should handle targetId missing from outputs config', () => {
    useSettings.mockReturnValue({
      systemHealth: { 
          primarySource: { healthy: true },
          browser: { healthy: true },
          voicemonkey: { healthy: false, label: 'VoiceMonkey' }
      },
      config: { 
          automation: { 
              outputs: {}, // voicemonkey missing
              triggers: { 
                  fajr: { azan: { enabled: true, type: 'file', targets: ['voicemonkey'] } } 
              } 
          } 
      }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const warnings = screen.getAllByTitle(/System Warning/);
    expect(warnings[0].getAttribute('title')).toContain('VoiceMonkey is used by fajr azan but is OFFLINE');
  });

  it('should skip browser target in health check', () => {
    useSettings.mockReturnValue({
      systemHealth: { primarySource: { healthy: true } },
      config: { 
          automation: { 
              triggers: { 
                  fajr: { azan: { enabled: true, type: 'file', targets: ['browser'] } } 
              } 
          } 
      }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    expect(screen.queryByTitle(/System Warning/)).toBeNull();
  });

  it('should not show warning if primarySource health is missing', () => {
    useSettings.mockReturnValue({
      systemHealth: {},
      config: { automation: { triggers: {} } }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    expect(screen.queryByTitle(/System Warning/)).toBeNull();
  });

  it('should not show system warning if everything is healthy', () => {
    useSettings.mockReturnValue({
      systemHealth: { primarySource: { healthy: true } },
      config: { automation: { triggers: {} } }
    });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    expect(screen.queryByTitle(/System Warning/)).toBeNull();
  });

  it('should navigate to settings when settings button is clicked', () => {
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const settingsButton = screen.getAllByRole('button')[3];
    fireEvent.click(settingsButton);
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('should reset manual pause if wakeLockAutoStart preference changes', () => {
    const { rerender } = render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    
    // Change preference
    mockPreferences.appearance.wakeLockAutoStart = true;
    rerender(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
  });

  it('should open and close ClientSettingsModal', () => {
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    const displaySettingsButton = screen.getAllByRole('button')[2];
    fireEvent.click(displaySettingsButton);
    expect(screen.getByTestId('client-settings-modal')).toBeDefined();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('client-settings-modal')).toBeNull();
  });

  it('should show correct title for unsupported wake lock', () => {
    useWakeLock.mockReturnValue({ ...mockWakeLock, isSupported: false });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    expect(screen.getByTitle('Not supported (Requires HTTPS)')).toBeDefined();
  });

  it('should show correct title for wake lock error', () => {
    useWakeLock.mockReturnValue({ ...mockWakeLock, error: { message: 'Failed' } });
    render(<MemoryRouter><TopControls isMuted={false} toggleMute={vi.fn()} blocked={false} /></MemoryRouter>);
    expect(screen.getByTitle(/Error: Failed/)).toBeDefined();
  });
});
