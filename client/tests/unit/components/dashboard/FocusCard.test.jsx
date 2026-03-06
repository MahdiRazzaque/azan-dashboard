import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FocusCard from '../../../../src/components/dashboard/FocusCard';
import { useClientPreferences } from '../../../../src/hooks/useClientPreferences';
import { DateTime, Settings } from 'luxon';

vi.mock('../../../../src/hooks/useClientPreferences');

describe('FocusCard', () => {
  const mockPreferences = {
    appearance: {
      clockFormat: '24h',
      showSeconds: true,
      countdownMode: 'normal',
      skipSunriseCountdown: false,
      prayerNameLanguage: 'english'
    }
  };

  const fixedTime = '2026-01-30T12:00:00Z';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedTime));
    Settings.now = () => Date.now();
    useClientPreferences.mockReturnValue({ preferences: mockPreferences });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps = {
    nextPrayer: { name: 'dhuhr', time: '2026-01-30T12:05:00Z', isTomorrow: false },
    prayers: {},
    lastUpdated: Date.now(),
    onCountdownComplete: vi.fn(),
    timezone: 'UTC'
  };

  it('should render clock and date', () => {
    render(<FocusCard {...defaultProps} />);
    expect(screen.getByText(/Friday, 30 January/)).toBeDefined();
    expect(screen.getByText('12:00')).toBeDefined();
  });

  it('should format countdown in digital mode', () => {
    useClientPreferences.mockReturnValue({
      preferences: { ...mockPreferences, appearance: { ...mockPreferences.appearance, countdownMode: 'digital' } }
    });
    render(<FocusCard {...defaultProps} />);
    expect(screen.getByText('00:05:00')).toBeDefined();
  });

  it('should format countdown in minimal mode', () => {
    useClientPreferences.mockReturnValue({
      preferences: { ...mockPreferences, appearance: { ...mockPreferences.appearance, countdownMode: 'minimal' } }
    });
    render(<FocusCard {...defaultProps} />);
    expect(screen.getByText('5m 0s')).toBeDefined();
  });

  it('should format countdown in normal mode with hours', () => {
    const props = {
        ...defaultProps,
        nextPrayer: { name: 'dhuhr', time: '2026-01-30T14:05:00Z', isTomorrow: false }
    };
    render(<FocusCard {...props} />);
    expect(screen.getByText('2hr 5min 0sec')).toBeDefined();
  });

  it('should format countdown in normal mode with only minutes', () => {
    const props = {
        ...defaultProps,
        nextPrayer: { name: 'dhuhr', time: '2026-01-30T12:05:00Z', isTomorrow: false }
    };
    render(<FocusCard {...props} />);
    expect(screen.getByText('5min 0sec')).toBeDefined();
  });

  it('should format countdown in normal mode with only seconds', () => {
    const props = {
        ...defaultProps,
        nextPrayer: { name: 'dhuhr', time: '2026-01-30T12:00:30Z', isTomorrow: false }
    };
    render(<FocusCard {...props} />);
    expect(screen.getByText('30sec')).toBeDefined();
  });

  it('should trigger onCountdownComplete after 5s when countdown finished', () => {
    const onCountdownComplete = vi.fn();
    const props = {
      ...defaultProps,
      nextPrayer: { name: 'dhuhr', time: fixedTime, isTomorrow: false },
      onCountdownComplete
    };
    render(<FocusCard {...props} />);
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onCountdownComplete).toHaveBeenCalled();
  });

  it('should retry refetch if server still returns old prayer', () => {
    const onCountdownComplete = vi.fn();
    const props = {
      ...defaultProps,
      nextPrayer: { name: 'dhuhr', time: fixedTime, isTomorrow: false },
      onCountdownComplete
    };
    const { rerender } = render(<FocusCard {...props} />);
    
    // Finish countdown
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onCountdownComplete).toHaveBeenCalled();
    const initialCalls = onCountdownComplete.mock.calls.length;

    // Simulate update with SAME nextPrayer (stale)
    rerender(<FocusCard {...props} lastUpdated={Date.now() + 1000} />);
    
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    expect(onCountdownComplete.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('should NOT skip sunrise if dhuhr time is missing', () => {
    useClientPreferences.mockReturnValue({
      preferences: { ...mockPreferences, appearance: { ...mockPreferences.appearance, skipSunriseCountdown: true } }
    });
    const props = {
      ...defaultProps,
      nextPrayer: { name: 'sunrise', time: '2026-01-30T07:00:00Z', isTomorrow: false },
      prayers: { dhuhr: { start: null } }
    };
    render(<FocusCard {...props} />);
    expect(screen.getByText(/Upcoming: Sunrise/)).toBeDefined();
  });

  it('should return null next name if nextPrayer is null', () => {
    render(<FocusCard {...defaultProps} nextPrayer={null} />);
    expect(screen.queryByText(/Upcoming:/)).toBeNull();
  });

  it('should render Arabic prayer names when that preference is enabled', () => {
    useClientPreferences.mockReturnValue({
      preferences: {
        ...mockPreferences,
        appearance: {
          ...mockPreferences.appearance,
          prayerNameLanguage: 'arabic'
        }
      }
    });

    render(<FocusCard {...defaultProps} />);

    expect(screen.getByText(/ظُهْر/)).toBeDefined();
  });

  it('should use the supplied timezone for the date and clock display', () => {
    vi.setSystemTime(new Date('2026-01-30T00:30:00Z'));

    render(<FocusCard {...defaultProps} timezone="America/New_York" />);

    expect(screen.getByText(/Thursday, 29 January/)).toBeDefined();
    expect(screen.getByText('19:30')).toBeDefined();
  });
});
