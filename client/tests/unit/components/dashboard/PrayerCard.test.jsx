import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrayerCard from '../../../../src/components/dashboard/PrayerCard';
import { DateTime } from 'luxon';

describe('PrayerCard', () => {
  const mockPrayers = {
    fajr: { start: '2026-01-30T05:00:00', iqamah: '2026-01-30T05:30:00' },
    sunrise: { start: '2026-01-30T07:00:00' },
    dhuhr: { start: '2026-01-30T12:00:00', iqamah: '2026-01-30T12:30:00' },
    asr: { start: '2026-01-30T15:00:00', iqamah: '2026-01-30T15:30:00' },
    maghrib: { start: '2026-01-30T17:00:00', iqamah: '2026-01-30T17:15:00' },
    isha: { start: '2026-01-30T19:00:00', iqamah: '2026-01-30T19:30:00' }
  };

  it('should render all prayers', () => {
    render(<PrayerCard prayers={mockPrayers} nextPrayer={null} />);
    expect(screen.getByText('Fajr')).toBeDefined();
    expect(screen.getByText('Sunrise')).toBeDefined();
    expect(screen.getByText('Dhuhr')).toBeDefined();
    expect(screen.getByText('Asr')).toBeDefined();
    expect(screen.getByText('Maghrib')).toBeDefined();
    expect(screen.getByText('Isha')).toBeDefined();
  });

  it('should mark today\'s next prayer correctly', () => {
    const nextPrayer = { name: 'asr', isTomorrow: false };
    render(<PrayerCard prayers={mockPrayers} nextPrayer={nextPrayer} />);
    
    const asrRow = screen.getByText('Asr').parentElement;
    expect(asrRow.className).toContain('text-app-accent');
    expect(asrRow.className).toContain('bg-app-accent/10');

    const fajrRow = screen.getByText('Fajr').parentElement;
    expect(fajrRow.className).toContain('text-app-dim');
  });

  it('should mark all prayers as passed if next prayer is tomorrow', () => {
    const nextPrayer = { name: 'fajr', isTomorrow: true };
    render(<PrayerCard prayers={mockPrayers} nextPrayer={nextPrayer} />);
    
    const ishaRow = screen.getByText('Isha').parentElement;
    expect(ishaRow.className).toContain('text-app-dim');
  });

  it('should show --- for sunrise iqamah', () => {
    render(<PrayerCard prayers={mockPrayers} nextPrayer={null} />);
    expect(screen.getByText('---')).toBeDefined();
  });

  it('should handle missing times', () => {
    const incompletePrayers = {
        fajr: { start: null, iqamah: null }
    };
    render(<PrayerCard prayers={incompletePrayers} nextPrayer={null} />);
    // All prayers will have '-' for start time if not provided in mock
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('should format times correctly', () => {
    render(<PrayerCard prayers={mockPrayers} nextPrayer={null} />);
    // 05:00 should be formatted as 5:00
    expect(screen.getAllByText('5:00').length).toBeGreaterThan(0);
  });
});
