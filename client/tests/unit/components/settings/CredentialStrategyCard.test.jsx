import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CredentialStrategyCard from '@/components/settings/CredentialStrategyCard';

const mockStrategy = {
  id: 'voicemonkey',
  label: 'VoiceMonkey',
  params: [
    { key: 'token', label: 'API Token', sensitive: true }
  ]
};

describe('CredentialStrategyCard', () => {
  it('should pre-fill values when initialValues are provided after initial render', async () => {
    const { rerender } = render(
      <CredentialStrategyCard 
        strategy={mockStrategy} 
        initialValues={undefined} 
        verified={false} 
        onSave={vi.fn()} 
      />
    );

    // Initially empty
    const input = screen.getByPlaceholderText('Enter API Token');
    expect(input.value).toBe('');

    // Update with initialValues
    rerender(
      <CredentialStrategyCard 
        strategy={mockStrategy} 
        initialValues={{ token: 'secret-token' }} 
        verified={false} 
        onSave={vi.fn()} 
      />
    );

    // Bug: It might still be empty if the useEffect doesn't handle the update correctly
    expect(input.value).toBe('secret-token');
  });

  it('should disable the Reset button when initialValues are already empty', () => {
    render(
      <CredentialStrategyCard 
        strategy={mockStrategy} 
        initialValues={{}} 
        verified={false} 
        onSave={vi.fn()} 
      />
    );

    const resetButton = screen.getByTitle('Reset / Clear Credentials');
    expect(resetButton).toBeDisabled();
  });

  it('should enable the Reset button when initialValues has data', () => {
    render(
      <CredentialStrategyCard 
        strategy={mockStrategy} 
        initialValues={{ token: 'exists' }} 
        verified={false} 
        onSave={vi.fn()} 
      />
    );

    const resetButton = screen.getByTitle('Reset / Clear Credentials');
    expect(resetButton).not.toBeDisabled();
  });

  it('should show safety modal before triggering verification', async () => {
    global.fetch = vi.fn();
    render(
      <CredentialStrategyCard 
        strategy={mockStrategy} 
        initialValues={{ token: 'exists' }} 
        verified={false} 
        onSave={vi.fn()} 
      />
    );

    const testButton = screen.getByText('Test & Verify');
    await act(async () => {
        testButton.click();
    });

    // Modal should be open
    expect(screen.getByText('Audio Warning')).toBeInTheDocument();
    expect(screen.getByText(/This will play audio/)).toBeInTheDocument();

    // Clicking Cancel should close it without fetch
    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
        cancelButton.click();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
