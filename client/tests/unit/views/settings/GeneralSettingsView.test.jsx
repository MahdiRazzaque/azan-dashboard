import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GeneralSettingsView from '../../../../src/views/settings/GeneralSettingsView';
import { useSettings } from '../../../../src/hooks/useSettings';
import { useProviders } from '../../../../src/hooks/useProviders';

vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/hooks/useProviders');
vi.mock('../../../../src/components/settings/SourceConfigurator', () => ({ 
    default: ({ source, onChange }) => (
        <div data-testid={`source-${source?.type || 'none'}`}>
            {source?.type}
            <button onClick={() => onChange({ type: 'mymasjid' })}>Switch to MyMasjid</button>
            <button onClick={() => onChange({ type: 'aladhan' })}>Switch to Aladhan</button>
        </div>
    ) 
}));

describe('GeneralSettingsView', () => {
  const updateSetting = vi.fn();
  const isSectionDirty = vi.fn().mockReturnValue(false);
  const mockProviders = [
    { id: 'aladhan', label: 'Aladhan', requiresCoordinates: true },
    { id: 'mymasjid', label: 'MyMasjid', requiresCoordinates: false, parameters: [{ key: 'p1', default: 'd1' }] }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      draftConfig: { sources: { primary: { type: 'aladhan' } }, location: { timezone: 'UTC' } },
      updateSetting,
      loading: false,
      isSectionDirty,
      systemHealth: {}
    });
    useProviders.mockReturnValue({ providers: mockProviders, loading: false });
  });

  it('should render loading state', () => {
    useSettings.mockReturnValue({ loading: true });
    render(<GeneralSettingsView />);
    expect(screen.getByText('Loading settings...')).toBeDefined();
  });

  it('should render correctly', () => {
    render(<GeneralSettingsView />);
    expect(screen.getByText('General Settings')).toBeDefined();
    expect(screen.getByText('Primary Data Source')).toBeDefined();
    expect(screen.getByText('Localisation')).toBeDefined();
  });

  it('should handle primary source change', () => {
    render(<GeneralSettingsView />);
    const switchButton = screen.getAllByText('Switch to MyMasjid')[0];
    fireEvent.click(switchButton);
    expect(updateSetting).toHaveBeenCalledWith('sources.primary', { type: 'mymasjid' });
  });

  it('should handle primary source change with mutual exclusion', () => {
    useSettings.mockReturnValue({
        draftConfig: { 
            sources: { 
                primary: { type: 'aladhan' },
                backup: { type: 'mymasjid' } 
            }, 
            location: {} 
        },
        updateSetting,
        loading: false,
        isSectionDirty,
        systemHealth: {}
    });
    render(<GeneralSettingsView />);
    
    const switchButton = screen.getAllByText('Switch to MyMasjid')[0];
    fireEvent.click(switchButton);

    expect(updateSetting).toHaveBeenCalledWith('sources.primary', { type: 'mymasjid' });
    expect(updateSetting).toHaveBeenCalledWith('sources.backup', expect.objectContaining({ type: 'aladhan' }));
  });

  it('should handle primary source change when no alternative provider available', () => {
    useProviders.mockReturnValue({ providers: [{ id: 'aladhan', label: 'Aladhan' }], loading: false });
    useSettings.mockReturnValue({
        draftConfig: { sources: { primary: { type: 'aladhan' }, backup: { type: 'aladhan' } }, location: {} },
        updateSetting,
        loading: false,
        isSectionDirty,
        systemHealth: {}
    });
    render(<GeneralSettingsView />);
    
    const switchButton = screen.getAllByText('Switch to Aladhan')[0];
    fireEvent.click(switchButton);

    expect(updateSetting).toHaveBeenCalledWith('sources.backup', null);
  });

  it('should handle toggle backup when no alternative provider available', () => {
    useProviders.mockReturnValue({ providers: [{ id: 'aladhan', label: 'Aladhan' }], loading: false });
    render(<GeneralSettingsView />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    
    fireEvent.click(checkbox);
    // Should NOT call updateSetting for backup because no alternative exists
    expect(updateSetting).not.toHaveBeenCalledWith('sources.backup', expect.anything());
  });

  it('should handle timezone change', () => {
    render(<GeneralSettingsView />);
    const input = screen.getByPlaceholderText('e.g. Europe/London');
    fireEvent.change(input, { target: { value: 'Europe/Paris' } });
    expect(updateSetting).toHaveBeenCalledWith('location.timezone', 'Europe/Paris');
  });

  it('should enable backup source', () => {
    render(<GeneralSettingsView />);
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    fireEvent.click(checkbox);
    expect(updateSetting).toHaveBeenCalledWith('sources.backup', expect.objectContaining({ type: 'mymasjid', enabled: true, p1: 'd1' }));
  });

  it('should disable backup source', () => {
    useSettings.mockReturnValue({
        draftConfig: { sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid' } }, location: {} },
        updateSetting,
        loading: false,
        isSectionDirty,
        systemHealth: {}
    });
    render(<GeneralSettingsView />);
    const activeCheckbox = screen.getByRole('checkbox', { hidden: true });
    fireEvent.click(activeCheckbox);
    expect(updateSetting).toHaveBeenCalledWith('sources.backup', null);
  });

  it('should show health warnings and dirty indicators', () => {
    isSectionDirty.mockImplementation(path => path === 'sources.primary');
    useSettings.mockReturnValue({
        draftConfig: { sources: { primary: { type: 'aladhan' } }, location: {} },
        updateSetting,
        loading: false,
        isSectionDirty,
        systemHealth: { primarySource: { healthy: false, message: 'Dead' } }
    });
    const { container } = render(<GeneralSettingsView />);
    expect(container.querySelector('.lucide-triangle-alert')).toBeDefined();
    expect(container.querySelector('.bg-orange-500')).toBeDefined();
  });
});
