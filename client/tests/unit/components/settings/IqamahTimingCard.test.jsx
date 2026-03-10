import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IqamahTimingCard from '../../../../src/components/settings/IqamahTimingCard';

const aladhanProvider = { id: 'aladhan', label: 'Aladhan', capabilities: { providesIqamah: false } };
const mymasjidProvider = { id: 'mymasjid', label: 'MyMasjid', capabilities: { providesIqamah: true } };

describe('IqamahTimingCard', () => {
    const expandCard = () => fireEvent.click(screen.getByRole('button', { name: /iqamah timing/i }));

    const defaultProps = {
        activeTab: 'fajr',
        currentPrayerSettings: {
            iqamahOffset: 15,
            fixedTime: null,
            iqamahOverride: false,
            roundTo: 0
        },
        updatePrayerConfig: vi.fn(),
        providers: [aladhanProvider, mymasjidProvider],
        sources: {
            primary: { type: 'aladhan' },
            backup: { type: 'mymasjid', enabled: true }
        },
        isDirty: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Group A (pri=No, bak=No)', () => {
        const props = {
            ...defaultProps,
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'aladhan', enabled: true }
            }
        };

        it('renders blue banner with "Calculating Iqamah times locally" text', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Calculating Iqamah times locally/i);
            expect(banner).toHaveTextContent(/These settings apply to all sources/i);
            expect(banner.className).toMatch(/bg-blue-900\/20/);
        });

        it('does NOT render override switch', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            expect(screen.queryByRole('switch')).toBeNull();
        });

        it('always shows local calc inputs (offset/fixed mode selector visible)', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            expect(screen.getByText('Offset')).toBeInTheDocument();
            expect(screen.getByText('Fixed')).toBeInTheDocument();
        });

        it('mode selector works — clicking "Fixed" calls updatePrayerConfig', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            fireEvent.click(screen.getByText('Fixed'));
            expect(props.updatePrayerConfig).toHaveBeenCalledWith('fixedTime', '12:00');
        });

        it('offset input changes call updatePrayerConfig', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const offsetInput = screen.getByLabelText(/Offset \(minutes\)/i);
            fireEvent.change(offsetInput, { target: { value: '20' } });
            expect(props.updatePrayerConfig).toHaveBeenCalledWith('iqamahOffset', 20);
        });
    });

    describe('Group B (pri=Yes, bak=Yes)', () => {
        const props = {
            ...defaultProps,
            sources: {
                primary: { type: 'mymasjid' },
                backup: { type: 'mymasjid', enabled: true }
            }
        };

        it('Override OFF: Green banner with "Following source Iqamah schedule" and "Both sources provide"', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Following source Iqamah schedule/i);
            expect(banner).toHaveTextContent(/Both sources provide Iqamah times/i);
            expect(banner.className).toMatch(/bg-emerald-900\/20/);
        });

        it('Override OFF: Override switch present with aria-checked="false"', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const switchEl = screen.getByRole('switch');
            expect(switchEl).toBeInTheDocument();
            expect(switchEl).toHaveAttribute('aria-checked', 'false');
        });

        it('Override OFF: Local calc inputs NOT shown', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            expect(screen.queryByText('Offset')).toBeNull();
            expect(screen.queryByText('Fixed')).toBeNull();
        });

        it('Override ON: Amber banner with "apply to both sources"', () => {
            render(<IqamahTimingCard {...props} currentPrayerSettings={{ ...props.currentPrayerSettings, iqamahOverride: true }} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Override active/i);
            expect(banner).toHaveTextContent(/Local calculation settings apply to both sources/i);
            expect(banner.className).toMatch(/bg-amber-900\/20/);
        });

        it('Override ON: Local calc inputs shown', () => {
            render(<IqamahTimingCard {...props} currentPrayerSettings={{ ...props.currentPrayerSettings, iqamahOverride: true }} />);
            expandCard();
            expect(screen.getByText('Offset')).toBeInTheDocument();
            expect(screen.getByText('Fixed')).toBeInTheDocument();
        });
    });

    describe('Group C — pri=Yes, backup enabled but does not provide Iqamah', () => {
        const props = {
            ...defaultProps,
            sources: {
                primary: { type: 'mymasjid' },
                backup: { type: 'aladhan', enabled: true }
            }
        };

        it('Override OFF: Green banner with "apply to backup source only" text', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Following primary source Iqamah schedule/i);
            expect(banner).toHaveTextContent(/Local calculation settings below apply to backup source only/i);
            expect(banner.className).toMatch(/bg-emerald-900\/20/);
        });

        it('Override OFF: Local calc inputs shown', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            expect(screen.getByText('Offset')).toBeInTheDocument();
            expect(screen.getByText('Fixed')).toBeInTheDocument();
        });

        it('Override ON: Amber banner with "apply to both sources", local calc inputs shown', () => {
            render(<IqamahTimingCard {...props} currentPrayerSettings={{ ...props.currentPrayerSettings, iqamahOverride: true }} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Override active/i);
            expect(banner).toHaveTextContent(/Local calculation settings apply to both sources/i);
            expect(banner.className).toMatch(/bg-amber-900\/20/);
            expect(screen.getByText('Offset')).toBeInTheDocument();
        });
    });

    describe('Group C2 — pri=Yes, backup disabled', () => {
        const props = {
            ...defaultProps,
            sources: {
                primary: { type: 'mymasjid' },
                backup: { type: 'aladhan', enabled: false }
            }
        };

        it('Override OFF: Green banner, no mention of backup, inputs hidden', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Following source Iqamah schedule/i);
            expect(banner.textContent).not.toMatch(/backup/i);
            expect(banner.className).toMatch(/bg-emerald-900\/20/);
            expect(screen.queryByText('Offset')).toBeNull();
            expect(screen.queryByText('Fixed')).toBeNull();
        });

        it('Override ON: Amber banner, local calc inputs shown', () => {
            render(<IqamahTimingCard {...props} currentPrayerSettings={{ ...props.currentPrayerSettings, iqamahOverride: true }} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Override active/i);
            expect(banner.className).toMatch(/bg-amber-900\/20/);
            expect(screen.getByText('Offset')).toBeInTheDocument();
        });
    });

    describe('Group D — pri=No, backup enabled and provides Iqamah', () => {
        const props = {
            ...defaultProps,
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'mymasjid', enabled: true }
            }
        };

        it('Override OFF: Blue banner with "apply to primary source only" text', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Primary source does not provide Iqamah/i);
            expect(banner).toHaveTextContent(/Local calculation settings below apply to primary source only/i);
            expect(banner.className).toMatch(/bg-blue-900\/20/);
        });

        it('Override OFF: Local calc inputs shown', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            expect(screen.getByText('Offset')).toBeInTheDocument();
            expect(screen.getByText('Fixed')).toBeInTheDocument();
        });

        it('Override ON: Amber banner with "apply to both sources"', () => {
            render(<IqamahTimingCard {...props} currentPrayerSettings={{ ...props.currentPrayerSettings, iqamahOverride: true }} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Override active/i);
            expect(banner).toHaveTextContent(/Local calculation settings apply to both sources/i);
            expect(banner.className).toMatch(/bg-amber-900\/20/);
        });
    });

    describe('Group D2 — pri=No, backup disabled', () => {
        const props = {
            ...defaultProps,
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'mymasjid', enabled: false }
            }
        };

        it('Override OFF: Blue banner, no mention of backup, inputs shown', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            const banner = screen.getByTestId('iqamah-banner');
            expect(banner).toHaveTextContent(/Calculating Iqamah times locally/i);
            expect(banner.textContent).not.toMatch(/backup/i);
            expect(banner.className).toMatch(/bg-blue-900\/20/);
            expect(screen.getByText('Offset')).toBeInTheDocument();
        });

        it('No override switch rendered', () => {
            render(<IqamahTimingCard {...props} />);
            expandCard();
            expect(screen.queryByRole('switch')).toBeNull();
        });
    });

    describe('Dirty indicator', () => {
        it('Shows dirty dot when isDirty=true', () => {
            render(<IqamahTimingCard {...defaultProps} isDirty={true} />);
            const dot = screen.getByTestId('dirty-dot');
            expect(dot).toBeInTheDocument();
        });

        it('No dirty dot when isDirty=false', () => {
            render(<IqamahTimingCard {...defaultProps} isDirty={false} />);
            expect(screen.queryByTestId('dirty-dot')).toBeNull();
        });
    });

    describe('Fixed time mode', () => {
        it('When fixedTime is set, shows time input with correct value', () => {
            render(<IqamahTimingCard {...defaultProps} currentPrayerSettings={{ ...defaultProps.currentPrayerSettings, fixedTime: '13:30', iqamahOverride: true }} />);
            expandCard();
            const timeInput = screen.getByLabelText(/Fixed Time/i);
            expect(timeInput).toHaveValue('13:30');
        });

        it('Changing time input calls updatePrayerConfig', () => {
            render(<IqamahTimingCard {...defaultProps} currentPrayerSettings={{ ...defaultProps.currentPrayerSettings, fixedTime: '13:30', iqamahOverride: true }} />);
            expandCard();
            const timeInput = screen.getByLabelText(/Fixed Time/i);
            fireEvent.change(timeInput, { target: { value: '14:00' } });
            expect(defaultProps.updatePrayerConfig).toHaveBeenCalledWith('fixedTime', '14:00');
        });
    });

    describe('Rounding input', () => {
        it('Rounding input calls updatePrayerConfig', () => {
            render(<IqamahTimingCard {...defaultProps} currentPrayerSettings={{ ...defaultProps.currentPrayerSettings, iqamahOverride: true }} />);
            expandCard();
            const roundInput = screen.getByLabelText(/Round to nearest/i);
            fireEvent.change(roundInput, { target: { value: '5' } });
            expect(defaultProps.updatePrayerConfig).toHaveBeenCalledWith('roundTo', 5);
        });
    });
});
