import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import SetupView from '../../../src/views/SetupView';
import { useAuth } from '../../../src/hooks/useAuth';

vi.mock('../../../src/hooks/useAuth');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

describe('SetupView', () => {
  const refreshAuth = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ refreshAuth });
    useNavigate.mockReturnValue(mockNavigate);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should render setup form', () => {
    render(
      <MemoryRouter>
        <SetupView />
      </MemoryRouter>
    );
    expect(screen.getByText('Welcome to Azan Dashboard')).toBeDefined();
    expect(screen.getByText('Set Password')).toBeDefined();
  });

  it('should show error if passwords do not match', async () => {
    render(
      <MemoryRouter>
        <SetupView />
      </MemoryRouter>
    );

    const inputs = screen.getAllByPlaceholderText(/password/i);
    // PasswordInput placeholders: "Enter password" and "Repeat password"
    const passInput = screen.getByPlaceholderText('Enter password');
    const confirmInput = screen.getByPlaceholderText('Repeat password');
    const button = screen.getByText('Set Password');

    fireEvent.change(passInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'password456' } });
    fireEvent.click(button);

    expect(screen.getByText('Passwords do not match')).toBeDefined();
  });

  it('should show error if password is too short', async () => {
    render(
      <MemoryRouter>
        <SetupView />
      </MemoryRouter>
    );

    const passInput = screen.getByPlaceholderText('Enter password');
    const confirmInput = screen.getByPlaceholderText('Repeat password');
    const button = screen.getByText('Set Password');

    fireEvent.change(passInput, { target: { value: '1234' } });
    fireEvent.change(confirmInput, { target: { value: '1234' } });
    fireEvent.click(button);

    expect(screen.getByText('Password must be at least 5 characters')).toBeDefined();
  });

  it('should handle successful setup', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    render(
      <MemoryRouter>
        <SetupView />
      </MemoryRouter>
    );

    const passInput = screen.getByPlaceholderText('Enter password');
    const confirmInput = screen.getByPlaceholderText('Repeat password');
    const button = screen.getByText('Set Password');

    fireEvent.change(passInput, { target: { value: 'securepassword' } });
    fireEvent.change(confirmInput, { target: { value: 'securepassword' } });
    fireEvent.click(button);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/setup', expect.any(Object)));
    expect(refreshAuth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('should handle setup failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' })
    });

    render(
      <MemoryRouter>
        <SetupView />
      </MemoryRouter>
    );

    const passInput = screen.getByPlaceholderText('Enter password');
    const confirmInput = screen.getByPlaceholderText('Repeat password');
    const button = screen.getByText('Set Password');

    fireEvent.change(passInput, { target: { value: 'securepassword' } });
    fireEvent.change(confirmInput, { target: { value: 'securepassword' } });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('Server error')).toBeDefined());
  });

  it('should show default error if setup failed without error message', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({})
    });

    render(
      <MemoryRouter>
        <SetupView />
      </MemoryRouter>
    );

    const passInput = screen.getByPlaceholderText('Enter password');
    const confirmInput = screen.getByPlaceholderText('Repeat password');
    const button = screen.getByText('Set Password');

    fireEvent.change(passInput, { target: { value: 'securepassword' } });
    fireEvent.change(confirmInput, { target: { value: 'securepassword' } });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('Setup failed')).toBeDefined());
  });
});
