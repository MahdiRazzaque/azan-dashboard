import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutomationGeneralTab from '../../../../../src/components/settings/automation/AutomationGeneralTab';

describe('AutomationGeneralTab', () => {
  const onChange = vi.fn();
  const bulkUpdateOffsets = vi.fn();
  const config = { automation: { global: { enabled: true } } };
  const formData = { automation: { global: { enabled: true } } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render correctly', () => {
    render(<AutomationGeneralTab config={config} formData={formData} onChange={onChange} bulkUpdateOffsets={bulkUpdateOffsets} />);
    expect(screen.getByText('Master Controls')).toBeDefined();
    expect(screen.getByText('Global Automation Enabled')).toBeDefined();
  });

  it('should toggle master switch', () => {
    render(<AutomationGeneralTab config={config} formData={formData} onChange={onChange} bulkUpdateOffsets={bulkUpdateOffsets} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(onChange).toHaveBeenCalledWith('automation.global.enabled', false);
  });

  it('should toggle all sub-system switches', () => {
    render(<AutomationGeneralTab config={config} formData={formData} onChange={onChange} bulkUpdateOffsets={bulkUpdateOffsets} />);
    const switches = screen.getAllByRole('switch');
    
    // Global, Pre-Adhan, Adhan, Pre-Iqamah, Iqamah
    fireEvent.click(switches[1]);
    expect(onChange).toHaveBeenCalledWith('automation.global.preAdhanEnabled', false);
    
    fireEvent.click(switches[2]);
    expect(onChange).toHaveBeenCalledWith('automation.global.adhanEnabled', false);

    fireEvent.click(switches[3]);
    expect(onChange).toHaveBeenCalledWith('automation.global.preIqamahEnabled', false);

    fireEvent.click(switches[4]);
    expect(onChange).toHaveBeenCalledWith('automation.global.iqamahEnabled', false);
  });

  it('should show orange indicator when modified', () => {
    const modifiedFormData = { automation: { global: { enabled: false } } };
    const { container } = render(<AutomationGeneralTab config={config} formData={modifiedFormData} onChange={onChange} bulkUpdateOffsets={bulkUpdateOffsets} />);
    const orangeIndicator = container.querySelector('.bg-orange-500');
    expect(orangeIndicator).toBeDefined();
  });

  it('should handle batch adjustment changes and bulk update', () => {
    bulkUpdateOffsets.mockReturnValue(5);
    render(<AutomationGeneralTab config={config} formData={formData} onChange={onChange} bulkUpdateOffsets={bulkUpdateOffsets} />);
    
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '20' } });
    
    const applyButtons = screen.getAllByText('Apply to All');
    fireEvent.click(applyButtons[0]);
    
    expect(bulkUpdateOffsets).toHaveBeenCalledWith('preAdhan', '20');
    expect(screen.getByText(/Successfully updated 5 pre adhan triggers/)).toBeDefined();

    // Test toast timeout
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText(/Successfully updated/)).toBeNull();
  });

  it('should handle pre-iqamah bulk update', () => {
    bulkUpdateOffsets.mockReturnValue(6);
    render(<AutomationGeneralTab config={config} formData={formData} onChange={onChange} bulkUpdateOffsets={bulkUpdateOffsets} />);
    
    const applyButtons = screen.getAllByText('Apply to All');
    fireEvent.click(applyButtons[1]);
    
    expect(bulkUpdateOffsets).toHaveBeenCalledWith('preIqamah', 10); // default value
    expect(screen.getByText(/Successfully updated 6 pre iqamah triggers/)).toBeDefined();
  });
});
