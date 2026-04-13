import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { useAuth } from '../../../src/hooks/useAuth';

const TestComponent = () => {
  const { isAuthenticated, loading, setupRequired, connectionError, login, logout, clearConnectionError } = useAuth();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="auth">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="setup">{setupRequired ? 'Setup Required' : 'No Setup'}</div>
      <div data-testid="error">{connectionError ? 'Connection Error' : 'No Error'}</div>
      <button onClick={() => login('pass')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => clearConnectionError()}>Clear Error</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle status requiring setup', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ requiresSetup: true })
    });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('setup').textContent).toBe('Setup Required'));
    expect(screen.getByTestId('auth').textContent).toBe('Not Authenticated');
  });

  it('should handle status authenticated', async () => {
    // status call
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ requiresSetup: false })
    });
    // check call
    fetch.mockResolvedValueOnce({ ok: true });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('Authenticated'));
    expect(screen.getByTestId('setup').textContent).toBe('No Setup');
  });

  it('should handle status unauthenticated', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ requiresSetup: false })
    });
    fetch.mockResolvedValueOnce({ ok: false });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('Not Authenticated'));
  });

  it('should handle connection error (500)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Connection Error'));
  });

  it('should handle non-500 status error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('No Error'));
    expect(screen.getByTestId('auth').textContent).toBe('Not Authenticated');
  });

  it('should handle network error (TypeError)', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Connection Error'));
  });

  it('should handle generic error in checkStatus', async () => {
    fetch.mockRejectedValueOnce(new Error('Some other error'));

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('No Error'));
    expect(screen.getByTestId('auth').textContent).toBe('Not Authenticated');
  });

  it('should handle SyntaxError in checkStatus', async () => {
    const error = new SyntaxError('Unexpected token');
    fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(error)
    });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Connection Error'));
  });

  it('should handle successful login', async () => {
    // Initial status check
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ requiresSetup: false }) });
    fetch.mockResolvedValueOnce({ ok: false });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    // Mock login call
    fetch.mockResolvedValueOnce({ ok: true });
    
    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('Authenticated'));
  });

  it('should handle failed login', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ requiresSetup: false }) });
    fetch.mockResolvedValueOnce({ ok: false });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    fetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Wrong password' }) });
    
    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('Not Authenticated'));
  });

  it('should handle login network error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ requiresSetup: false }) });
    fetch.mockResolvedValueOnce({ ok: false });
    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    fetch.mockRejectedValueOnce(new Error('Network error'));
    
    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Login failed', expect.any(Error)));
    consoleSpy.mockRestore();
  });

  it('should handle logout error', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ requiresSetup: false }) });
    fetch.mockResolvedValueOnce({ ok: true });
    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('Authenticated'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockRejectedValueOnce(new Error('Logout failed'));
    
    act(() => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Logout failed', expect.any(Error)));
    consoleSpy.mockRestore();
  });

  it('should clear connection error', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Connection Error'));

    act(() => {
      screen.getByText('Clear Error').click();
    });
    expect(screen.getByTestId('error').textContent).toBe('No Error');
  });
});
