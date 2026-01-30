import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import { useAuth } from '../../src/hooks/useAuth';
import { useAudio } from '../../src/hooks/useAudio';
import { usePrayerTimes } from '../../src/hooks/usePrayerTimes';
import { useSSE } from '../../src/hooks/useSSE';
import { useClientPreferences } from '../../src/hooks/useClientPreferences';

// Mock all hooks used in App
vi.mock('../../src/hooks/useAuth');
vi.mock('../../src/hooks/useAudio');
vi.mock('../../src/hooks/usePrayerTimes');
vi.mock('../../src/hooks/useSSE');
vi.mock('../../src/hooks/useClientPreferences');

// Mock views and components to simplify testing App logic
vi.mock('../../src/views/DashboardView', () => ({ default: () => <div data-testid="dashboard-view">Dashboard</div> }));
vi.mock('../../src/views/LoginView', () => ({ default: () => <div data-testid="login-view">Login</div> }));
vi.mock('../../src/views/SetupView', () => ({ default: () => <div data-testid="setup-view">Setup</div> }));
vi.mock('../../src/views/ConnectionErrorView', () => ({ default: () => <div data-testid="connection-error-view">Connection Error</div> }));
vi.mock('../../src/components/layout/ProtectedRoute', () => ({ default: ({ children }) => <div data-testid="protected-route">{children}</div> }));
vi.mock('../../src/components/layout/SettingsLayout', () => ({ default: () => <div data-testid="settings-layout">Settings</div> }));

describe('App', () => {
  const mockUseAuth = useAuth;
  const mockUseAudio = useAudio;
  const mockUsePrayerTimes = usePrayerTimes;
  const mockUseSSE = useSSE;
  const mockUseClientPreferences = useClientPreferences;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseClientPreferences.mockReturnValue({
      preferences: { appearance: { autoUnmute: false } },
      isAudioExcluded: vi.fn()
    });
    mockUseAudio.mockReturnValue({
      playUrl: vi.fn(),
      isMuted: false,
      toggleMute: vi.fn(),
      blocked: false
    });
    mockUsePrayerTimes.mockReturnValue({
      prayers: [],
      nextPrayer: null,
      lastUpdated: null,
      refetch: vi.fn()
    });
    mockUseSSE.mockReturnValue({
      logs: [],
      isConnected: true,
      processStatus: {}
    });
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false,
      isAuthenticated: false,
      connectionError: null
    });
  });

  it('should render loading state', () => {
    mockUseAuth.mockReturnValue({
      loading: true
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('should render connection error view', () => {
    mockUseAuth.mockReturnValue({
      connectionError: new Error('Failed to connect')
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('connection-error-view')).toBeDefined();
  });

  it('should redirect to /setup if setup is required and path is not /setup', () => {
    mockUseAuth.mockReturnValue({
      setupRequired: true,
      loading: false
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    // Navigate is used, so SetupView should be rendered eventually if Router follows the redirect
    // But since it's a unit test of App component, Navigate component itself is returned.
    // MemoryRouter should handle it.
    expect(screen.getByTestId('setup-view')).toBeDefined();
  });

  it('should redirect to /login if setup is NOT required and path is /setup', () => {
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false
    });
    render(
      <MemoryRouter initialEntries={['/setup']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-view')).toBeDefined();
  });

  it('should redirect to /settings if authenticated and path is /login', () => {
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false,
      isAuthenticated: true
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );
    // /settings redirects to general, but we just check if it enters the settings area
    expect(screen.getByTestId('settings-layout')).toBeDefined();
  });

  it('should render DashboardView for root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('dashboard-view')).toBeDefined();
  });

  it('should handle audio play via handleAudioPlay callback passed to useSSE', () => {
    let capturedHandleAudioPlay;
    mockUseSSE.mockImplementation((cb) => {
      capturedHandleAudioPlay = cb;
      return { logs: [], isConnected: true, processStatus: {} };
    });

    const playUrl = vi.fn();
    mockUseAudio.mockReturnValue({
      playUrl,
      isMuted: false,
      toggleMute: vi.fn(),
      blocked: false
    });

    const isAudioExcluded = vi.fn().mockReturnValue(false);
    mockUseClientPreferences.mockReturnValue({
      preferences: { appearance: { autoUnmute: false } },
      isAudioExcluded
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    capturedHandleAudioPlay('Fajr', 'azan', 'fajr.mp3');
    expect(isAudioExcluded).toHaveBeenCalledWith('Fajr', 'azan');
    expect(playUrl).toHaveBeenCalledWith('fajr.mp3');
  });

  it('should skip audio play if excluded', () => {
    let capturedHandleAudioPlay;
    mockUseSSE.mockImplementation((cb) => {
      capturedHandleAudioPlay = cb;
      return { logs: [], isConnected: true, processStatus: {} };
    });

    const playUrl = vi.fn();
    mockUseAudio.mockReturnValue({
      playUrl,
      isMuted: false,
      toggleMute: vi.fn(),
      blocked: false
    });

    const isAudioExcluded = vi.fn().mockReturnValue(true);
    mockUseClientPreferences.mockReturnValue({
      preferences: { appearance: { autoUnmute: false } },
      isAudioExcluded
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    capturedHandleAudioPlay('Fajr', 'azan', 'fajr.mp3');
    expect(isAudioExcluded).toHaveBeenCalledWith('Fajr', 'azan');
    expect(playUrl).not.toHaveBeenCalled();
  });
});
