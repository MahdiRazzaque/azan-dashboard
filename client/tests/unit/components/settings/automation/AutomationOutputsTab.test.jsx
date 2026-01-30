import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AutomationOutputsTab from '../../../../../src/components/settings/automation/AutomationOutputsTab';

vi.mock('../../../../../src/components/settings/OutputStrategyCard', () => ({ default: ({ strategy, onChange }) => <div data-testid="output-card">{strategy.label}<button onClick={() => onChange('enabled', true)}>Toggle</button></div> }));

describe('AutomationOutputsTab', () => {
  const defaultProps = {
    strategies: [
      { id: 'local', label: 'Local' },
      { id: 'voicemonkey', label: 'Alexa' }
    ],
    formData: { automation: { outputs: {} } },
    systemHealth: {},
    updateSetting: vi.fn()
  };

  it('should render correct number of strategy cards', () => {
    render(<AutomationOutputsTab {...defaultProps} />);
    expect(screen.getByText('Output Strategies')).toBeDefined();
    const cards = screen.getAllByTestId('output-card');
    expect(cards.length).toBe(2);
    expect(screen.getByText('Local')).toBeDefined();
    expect(screen.getByText('Alexa')).toBeDefined();
  });

  it('should call updateSetting when strategy card triggers onChange', () => {
    const updateSetting = vi.fn();
    render(<AutomationOutputsTab {...defaultProps} updateSetting={updateSetting} />);
    const toggleButton = screen.getAllByText('Toggle')[0];
    fireEvent.click(toggleButton);
    expect(updateSetting).toHaveBeenCalledWith('automation.outputs.local.enabled', true);
  });
});
