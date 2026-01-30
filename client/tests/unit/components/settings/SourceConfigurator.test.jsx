import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SourceConfigurator from '../../../../src/components/settings/SourceConfigurator';
import { useProviders } from '../../../../src/hooks/useProviders';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useProviders');
vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/components/settings/DynamicField', () => ({ default: ({ param, onChange }) => <div data-testid="dynamic-field">{param.label}<button onClick={() => onChange('new-val')}>Change</button></div> }));

describe('SourceConfigurator', () => {
  const onChange = vi.fn();
  const onLocationChange = vi.fn();
  const mockProviders = [
    { id: 'aladhan', label: 'Aladhan', parameters: [{ key: 'method', label: 'Method', default: 2 }], branding: { accentColor: 'blue' } },
    { id: 'mymasjid', label: 'MyMasjid', parameters: [], branding: { accentColor: 'emerald' } }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useProviders.mockReturnValue({ providers: mockProviders, loading: false });
    useSettings.mockReturnValue({ systemHealth: {} });
  });

  it('should render loading state', () => {
    useProviders.mockReturnValue({ providers: [], loading: true });
    render(<SourceConfigurator source={{}} onChange={onChange} />);
    expect(screen.getByText(/Loading provider information/)).toBeDefined();
  });

  it('should render provider buttons', () => {
    render(<SourceConfigurator source={{ type: 'aladhan' }} onChange={onChange} />);
    expect(screen.getByText('Aladhan')).toBeDefined();
    expect(screen.getByText('MyMasjid')).toBeDefined();
  });

  it('should change provider type and apply defaults', () => {
    render(<SourceConfigurator source={{ type: 'aladhan' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('MyMasjid'));
    expect(onChange).toHaveBeenCalledWith({ type: 'mymasjid' });

    fireEvent.click(screen.getByText('Aladhan'));
    expect(onChange).toHaveBeenCalledWith({ type: 'aladhan', method: 2 });
  });

  it('should filter primary source when isBackup is true', () => {
    render(<SourceConfigurator source={{}} onChange={onChange} isBackup={true} primarySourceType="aladhan" />);
    expect(screen.queryByText('Aladhan')).toBeNull();
    expect(screen.getByText('MyMasjid')).toBeDefined();
  });

  it('should show offline warning for active provider', () => {
    useSettings.mockReturnValue({ 
        systemHealth: { primarySource: { healthy: false, message: 'Offline Error' } } 
    });
    const { container } = render(<SourceConfigurator source={{ type: 'aladhan' }} onChange={onChange} />);
    const warning = container.querySelector('.lucide-triangle-alert');
    expect(warning).toBeDefined();
    expect(warning.getAttribute('title')).toBe('Offline Error');
  });

  it('should handle parameter changes', () => {
    render(<SourceConfigurator source={{ type: 'aladhan', method: 2 }} onChange={onChange} />);
    const changeButton = screen.getByText('Change');
    fireEvent.click(changeButton);
    expect(onChange).toHaveBeenCalledWith({ type: 'aladhan', method: 'new-val' });
  });

  it('should handle location changes', () => {
    const locationData = { coordinates: { lat: 0, long: 0 } };
    render(<SourceConfigurator source={{}} onChange={onChange} showCoordinates={true} locationData={locationData} onLocationChange={onLocationChange} />);
    
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10.5' } });
    expect(onLocationChange).toHaveBeenCalledWith('lat', 10.5);

    fireEvent.change(inputs[1], { target: { value: '20.5' } });
    expect(onLocationChange).toHaveBeenCalledWith('long', 20.5);
  });
});
