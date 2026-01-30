import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardView from '../../../src/views/DashboardView';

vi.mock('../../../src/components/layout/DashboardLayout', () => ({ default: ({ children }) => <div data-testid="dashboard-layout">{children}</div> }));
vi.mock('../../../src/components/layout/TopControls', () => ({ default: () => <div data-testid="top-controls">Top Controls</div> }));
vi.mock('../../../src/components/dashboard/PrayerCard', () => ({ default: () => <div data-testid="prayer-card">Prayer Card</div> }));
vi.mock('../../../src/components/dashboard/FocusCard', () => ({ default: () => <div data-testid="focus-card">Focus Card</div> }));

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

  it('should render all dashboard components', () => {
    render(<DashboardView {...defaultProps} />);
    expect(screen.getByTestId('top-controls')).toBeDefined();
    expect(screen.getByTestId('dashboard-layout')).toBeDefined();
    expect(screen.getByTestId('prayer-card')).toBeDefined();
    expect(screen.getByTestId('focus-card')).toBeDefined();
  });
});
