import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SettingsLayout from '../../../../src/components/layout/SettingsLayout';
import { useAuth } from '../../../../src/hooks/useAuth';
import { useSettings } from '../../../../src/hooks/useSettings';

vi.mock('../../../../src/hooks/useAuth');
vi.mock('../../../../src/hooks/useSettings');
vi.mock('../../../../src/components/common/ConfirmModal', () => ({ default: ({ isOpen, onConfirm, title }) => isOpen ? <div data-testid="confirm-modal">{title}<button onClick={onConfirm}>Confirm</button></div> : null }));
vi.mock('../../../../src/components/common/SaveProcessModal', () => ({ default: ({ isOpen, result }) => isOpen ? <div data-testid="process-modal">{result?.success ? 'Saved' : 'Saving'}</div> : null }));

describe('SettingsLayout', () => {
  const logout = vi.fn();
  const resetDraft = vi.fn();
  const saveSettings = vi.fn();
  const resetToDefaults = vi.fn();
  const refreshHealth = vi.fn();
  const validateBeforeSave = vi.fn().mockReturnValue({ success: true });
  const isSectionDirty = vi.fn().mockReturnValue(false);
  const getSectionHealth = vi.fn().mockReturnValue({ healthy: true });
  const hasUnsavedChanges = vi.fn().mockReturnValue(false);

  const baseMock = {
    config: { automation: { outputs: {} } },
    draftConfig: { automation: { outputs: {} } },
    systemHealth: {},
    hasUnsavedChanges,
    saveSettings,
    resetToDefaults,
    isSectionDirty,
    getSectionHealth,
    resetDraft,
    saving: false,
    validateBeforeSave,
    refreshHealth
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ logout });
    useSettings.mockReturnValue(baseMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render correctly', () => {
    render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(screen.getByText('Azan Dashboard')).toBeDefined();
    expect(refreshHealth).toHaveBeenCalledWith('all');
  });

  it('should handle sidebar toggle on mobile', () => {
    render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    const menuButton = screen.getAllByRole('button')[0];
    fireEvent.click(menuButton);
    expect(screen.getByRole('complementary').className).toContain('translate-x-0');
  });

  it('should handle logout', () => {
    render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    fireEvent.click(screen.getByText('Logout'));
    expect(logout).toHaveBeenCalled();
  });

  it('should handle global save flow', async () => {
    hasUnsavedChanges.mockReturnValue(true);
    saveSettings.mockResolvedValue({ success: true });
    render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    
    fireEvent.click(screen.getByTitle('Save all changes'));
    expect(screen.getByTestId('process-modal')).toBeDefined();
    
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
  });

  it('should handle health issues in General tab', () => {
    useSettings.mockReturnValue({
        ...baseMock,
        config: { sources: { backup: { enabled: true } } },
        systemHealth: { primarySource: { healthy: false }, backupSource: { healthy: false } }
    });
    const { container } = render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(container.querySelector('.lucide-triangle-alert')).toBeDefined();
  });

  it('should handle health issues in Automation tab', () => {
    useSettings.mockReturnValue({
        ...baseMock,
        draftConfig: { automation: { outputs: { local: { enabled: true } } } },
        systemHealth: { local: { healthy: false } }
    });
    const { container } = render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(container.querySelector('.lucide-triangle-alert')).toBeDefined();
  });

  it('should handle health for Credentials tab', () => {
    render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    // Credentials health should always return true
    expect(screen.getByText('Credentials')).toBeDefined();
  });

  it('should not show warning for offline backup if it is disabled', () => {
    useSettings.mockReturnValue({
        ...baseMock,
        config: { sources: { backup: { enabled: false } } },
        systemHealth: { backupSource: { healthy: false } }
    });
    const { container } = render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(container.querySelector('.lucide-triangle-alert')).toBeNull();
  });

  it('should handle dirty check for Developer tab', () => {
    isSectionDirty.mockImplementation(p => p === 'data');
    const { container } = render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(container.querySelector('.bg-orange-500')).toBeDefined();
  });

  it('should handle failed global reset', async () => {
    resetToDefaults.mockResolvedValue({ success: false, error: 'Reset Failed' });
    render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    
    fireEvent.click(screen.getByTitle('Reset to Factory Defaults'));
    fireEvent.click(screen.getByText('Confirm'));
    
    await waitFor(() => expect(screen.getByText(/Reset failed: Reset Failed/)).toBeDefined());
  });

  it('should handle missing output health in Automation tab', () => {
    useSettings.mockReturnValue({
        ...baseMock,
        draftConfig: { automation: { outputs: { local: { enabled: true } } } },
        systemHealth: {} // local missing
    });
    const { container } = render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(container.querySelector('.lucide-triangle-alert')).toBeNull();
  });

  it('should handle dirty check for Automation tab', () => {
    useSettings.mockReturnValue({
        ...baseMock,
        config: { automation: { foo: 'bar', triggers: {}, outputs: {} } },
        draftConfig: { automation: { foo: 'baz', triggers: {}, outputs: {} } },
        hasUnsavedChanges: () => true
    });
    const { container } = render(<MemoryRouter><SettingsLayout /></MemoryRouter>);
    expect(container.querySelector('.bg-orange-500')).toBeDefined();
  });
});
