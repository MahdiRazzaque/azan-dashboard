import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AutomationVoiceTab from '../../../../../src/components/settings/automation/AutomationVoiceTab';

vi.mock('../../../../../src/components/settings/VoiceLibrary', () => ({ default: () => <div data-testid="voice-library">Mocked Voice Library</div> }));

describe('AutomationVoiceTab', () => {
  const defaultProps = {
    voiceSearch: '',
    onVoiceSearchChange: vi.fn(),
    voiceLocale: 'en-GB',
    onVoiceLocaleChange: vi.fn(),
    voiceGender: 'female',
    onVoiceGenderChange: vi.fn()
  };

  it('should render correctly', () => {
    render(<AutomationVoiceTab {...defaultProps} />);
    expect(screen.getByText('Voice Library')).toBeDefined();
    expect(screen.getByTestId('voice-library')).toBeDefined();
  });
});
