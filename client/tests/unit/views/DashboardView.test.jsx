import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardView from '../../../src/views/DashboardView';

vi.mock('../../../src/components/layout/DashboardLayout', () => ({ default: ({ children }) => <div data-testid="dashboard-layout">{children}</div> }));
vi.mock('../../../src/components/layout/TopControls', () => ({ default: () => <div data-testid="top-controls">Top Controls</div> }));
vi.mock('../../../src/components/dashboard/PrayerCard', () => ({ default: () => <div data-testid="prayer-card">Prayer Card</div> }));
vi.mock('../../../src/components/dashboard/FocusCard', () => ({ default: () => <div data-testid="focus-card">Focus Card</div> }));
vi.mock('../../../src/components/common/WelcomeModal', () => ({ default: ({ onStartTour, onSkip }) => <div data-testid="welcome-modal"><button onClick={onStartTour}>Start</button><button onClick={onSkip}>Skip</button></div> }));
vi.mock('../../../src/hooks/useSettings', () => ({ useSettings: vi.fn() }));
vi.mock('../../../src/hooks/useTour', () => ({ useTour: vi.fn() }));
vi.mock('react-dom', () => ({ flushSync: (cb) => cb() }));

import { useSettings } from '../../../src/hooks/useSettings';
import { useTour } from '../../../src/hooks/useTour';
describe('DashboardView', () => {
  const defaultProps = {
    prayers: {},
    nextPrayer: null,
    lastUpdated: Date.now(),
    isMuted: false,
    toggleMute: vi.fn(),
    blocked: false,
    onCountdownComplete: vi.fn()
  };

  const mockFetchSettings = vi.fn();
  const mockStartTour = vi.fn();
  const mockStopTour = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: true } } },
      fetchSettings: mockFetchSettings
    });
    useTour.mockReturnValue({
      startTour: mockStartTour,
      stopTour: mockStopTour
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => cb());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('should render all dashboard components', () => {
    render(<DashboardView {...defaultProps} />);
    expect(screen.getByTestId('top-controls')).toBeDefined();
    expect(screen.getByTestId('dashboard-layout')).toBeDefined();
    expect(screen.getByTestId('prayer-card')).toBeDefined();
    expect(screen.getByTestId('focus-card')).toBeDefined();
  });

  it('shows WelcomeModal when dashboardSeen is false', () => {
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: false } } },
      fetchSettings: mockFetchSettings
    });
    render(<DashboardView {...defaultProps} />);
    expect(screen.getByTestId('welcome-modal')).toBeDefined();
  });

  it('hides WelcomeModal when dashboardSeen is true', () => {
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: true } } },
      fetchSettings: mockFetchSettings
    });
    render(<DashboardView {...defaultProps} />);
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
  });

  it('clicking Start in WelcomeModal calls startTour and hides modal', async () => {
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: false } } },
      refresh: vi.fn()
    });
    render(<DashboardView {...defaultProps} />);
    expect(screen.getByTestId('welcome-modal')).toBeDefined();
    fireEvent.click(screen.getByText('Start'));
    expect(mockStartTour).toHaveBeenCalledWith('dashboard', expect.any(Array), expect.any(Function));
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
  });

  it('handleTourComplete PATCHes tour state and calls refresh', async () => {
    const refresh = vi.fn().mockResolvedValue();
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: false } } },
      refresh
    });
    render(<DashboardView {...defaultProps} />);
    fireEvent.click(screen.getByText('Start'));
    const onComplete = mockStartTour.mock.calls[0][2];
    await onComplete();
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/tour-state', expect.objectContaining({ method: 'PATCH' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('handleSkipTour PATCHes tour state, hides modal, and calls refresh on success', async () => {
    const refresh = vi.fn().mockResolvedValue();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: false } } },
      refresh
    });
    render(<DashboardView {...defaultProps} />);
    await fireEvent.click(screen.getByText('Skip'));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
  });

  it('handleSkipTour hides modal even when fetch rejects', async () => {
    const refresh = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: false } } },
      refresh
    });
    render(<DashboardView {...defaultProps} />);
    fireEvent.click(screen.getByText('Skip'));
    await vi.waitFor(() => expect(screen.queryByTestId('welcome-modal')).toBeNull());
  });

  it('calls startTour directly (no modal) when dashboardSeen turns false after initial load', () => {
    const refresh = vi.fn();
    const { rerender } = render(<DashboardView {...defaultProps} />);
    useSettings.mockReturnValue({
      config: { system: { tours: { dashboardSeen: false } } },
      refresh
    });
    rerender(<DashboardView {...defaultProps} />);
    expect(mockStartTour).toHaveBeenCalledWith('dashboard', expect.any(Array), expect.any(Function));
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
  });
});
