import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
