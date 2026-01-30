import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NetworkConfigCard from '../../../../../src/components/settings/developer/NetworkConfigCard';
import { useSettings } from '../../../../../src/hooks/useSettings';

vi.mock('../../../../../src/hooks/useSettings');

describe('NetworkConfigCard', () => {
  const updateEnvSetting = vi.fn();
  const refreshHealth = vi.fn();
  const config = { automation: { baseUrl: 'https://initial.com' } };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({ config, updateEnvSetting, refreshHealth });
  });

  it('should render initial value from config', () => {
    render(<NetworkConfigCard />);
    const input = screen.getByPlaceholderText('https://your-domain.com');
    expect(input.value).toBe('https://initial.com');
    expect(screen.getByText('Valid HTTPS')).toBeDefined();
  });

  it('should show error for invalid URL', () => {
    render(<NetworkConfigCard />);
    const input = screen.getByPlaceholderText('https://your-domain.com');
    
    fireEvent.change(input, { target: { value: 'http://insecure.com' } });
    expect(screen.getByText('HTTPS Required')).toBeDefined();
    
    const saveButton = screen.getByText('Save');
    expect(saveButton.disabled).toBe(true);
  });

  it('should handle successful save', async () => {
    updateEnvSetting.mockResolvedValue({ success: true });
    render(<NetworkConfigCard />);
    const input = screen.getByPlaceholderText('https://your-domain.com');
    const saveButton = screen.getByText('Save');

    fireEvent.change(input, { target: { value: 'https://new-url.com' } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateEnvSetting).toHaveBeenCalledWith('BASE_URL', 'https://new-url.com'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeDefined());
    expect(refreshHealth).toHaveBeenCalledWith('voiceMonkey');
  });

  it('should handle save failure', async () => {
    updateEnvSetting.mockResolvedValue({ success: false, error: 'Invalid URL according to server' });
    render(<NetworkConfigCard />);
    const input = screen.getByPlaceholderText('https://your-domain.com');
    const saveButton = screen.getByText('Save');

    fireEvent.change(input, { target: { value: 'https://new-url.com' } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(screen.getByText('Invalid URL according to server')).toBeDefined());
  });

  it('should handle save error (exception)', async () => {
    updateEnvSetting.mockRejectedValue(new Error('Network error'));
    render(<NetworkConfigCard />);
    const input = screen.getByPlaceholderText('https://your-domain.com');
    const saveButton = screen.getByText('Save');

    fireEvent.change(input, { target: { value: 'https://new-url.com' } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(screen.getByText('Save failed')).toBeDefined());
  });

  it('should update value when config changes', () => {
    const { rerender } = render(<NetworkConfigCard />);
    
    useSettings.mockReturnValue({ 
        config: { automation: { baseUrl: 'https://updated.com' } }, 
        updateEnvSetting, 
        refreshHealth 
    });
    rerender(<NetworkConfigCard />);
    
    const input = screen.getByPlaceholderText('https://your-domain.com');
    expect(input.value).toBe('https://updated.com');
  });
});