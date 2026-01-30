import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CredentialStrategyCard from '../../../../src/components/settings/CredentialStrategyCard';

vi.mock('../../../../src/components/common/PasswordInput', () => ({ default: ({ value, onChange, placeholder }) => <input data-testid="pass-input" type="password" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /> }));
vi.mock('../../../../src/components/common/ConfirmModal', () => ({ default: ({ isOpen, onConfirm, title }) => isOpen ? <div data-testid="modal">{title}<button onClick={onConfirm}>Confirm</button></div> : null }));

describe('CredentialStrategyCard', () => {
  const onSave = vi.fn();
  const strategy = {
    id: 'voicemonkey',
    label: 'VoiceMonkey',
    params: [{ key: 'token', label: 'Token', sensitive: true }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should render correctly', () => {
    render(<CredentialStrategyCard strategy={strategy} initialValues={{ token: 'old' }} verified={true} onSave={onSave} />);
    expect(screen.getByText('VoiceMonkey Credentials')).toBeDefined();
    expect(screen.getByTestId('pass-input').value).toBe('old');
    expect(screen.getByText('Verified & Saved')).toBeDefined();
  });

  it('should handle parameter change and dirty state', () => {
    render(<CredentialStrategyCard strategy={strategy} initialValues={{ token: 'old' }} verified={true} onSave={onSave} />);
    const input = screen.getByTestId('pass-input');
    
    fireEvent.change(input, { target: { value: 'new' } });
    expect(input.value).toBe('new');
    expect(screen.queryByText('Verified & Saved')).toBeNull();
    expect(screen.getByText('Test & Verify')).toBeDefined();
  });

  it('should handle discard changes', () => {
    render(<CredentialStrategyCard strategy={strategy} initialValues={{ token: 'old' }} verified={true} onSave={onSave} />);
    const input = screen.getByTestId('pass-input');
    fireEvent.change(input, { target: { value: 'new' } });
    
    const discardButton = screen.getByTitle('Discard Changes');
    fireEvent.click(discardButton);
    expect(input.value).toBe('old');
  });

  it('should handle reset flow', async () => {
    onSave.mockResolvedValue({ success: true });
    render(<CredentialStrategyCard strategy={strategy} initialValues={{ token: 'old' }} onSave={onSave} />);
    
    fireEvent.click(screen.getByTitle(/Reset/));
    expect(screen.getByText('Clear Credentials')).toBeDefined();
    
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ token: '' }, true));
  });

  it('should handle verification flow', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    onSave.mockResolvedValue({ success: true });
    render(<CredentialStrategyCard strategy={strategy} initialValues={{ token: 'val' }} onSave={onSave} />);
    
    fireEvent.click(screen.getByText('Test & Verify'));
    expect(screen.getByText('Audio Warning')).toBeDefined();
    
    fireEvent.click(screen.getByText('Confirm')); // Safety Warning
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/verify'), expect.any(Object)));
    
    expect(screen.getByText('Audio Verification')).toBeDefined();
    fireEvent.click(screen.getByText('Confirm')); // Success confirmation
    
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ token: 'val' }, false));
    expect(screen.getByText('Verified & Saved')).toBeDefined();
  });

  it('should handle verification trigger failure', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Trigger failed' }) });
    render(<CredentialStrategyCard strategy={strategy} initialValues={{ token: 'val' }} onSave={onSave} />);
    
    fireEvent.click(screen.getByText('Test & Verify'));
    fireEvent.click(screen.getByText('Confirm')); // Safety Warning
    
    await waitFor(() => expect(screen.getByText('Trigger failed')).toBeDefined());
  });

  it('should return null if no sensitive params', () => {
    const noSensitive = { ...strategy, params: [{ key: 'p', sensitive: false }] };
    const { container } = render(<CredentialStrategyCard strategy={noSensitive} onSave={onSave} />);
    expect(container.firstChild).toBeNull();
  });
});