import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WelcomeModal from '../../../../src/components/common/WelcomeModal';

describe('WelcomeModal', () => {
  const defaultProps = {
    onStartTour: vi.fn(),
    onSkip: vi.fn()
  };

  it('renders with title "Welcome to your Azan Dashboard"', () => {
    render(<WelcomeModal {...defaultProps} />);
    expect(screen.getByText('Welcome to your Azan Dashboard')).toBeDefined();
  });

  it('has "Start Tour" and "Skip Tour" buttons', () => {
    render(<WelcomeModal {...defaultProps} />);
    expect(screen.getByText('Start Tour')).toBeDefined();
    expect(screen.getByText('Skip Tour')).toBeDefined();
  });

  it('calls onStartTour prop when "Start Tour" is clicked', () => {
    const onStartTour = vi.fn();
    render(<WelcomeModal {...defaultProps} onStartTour={onStartTour} />);
    fireEvent.click(screen.getByText('Start Tour'));
    expect(onStartTour).toHaveBeenCalled();
  });

  it('calls onSkip prop when "Skip Tour" is clicked', () => {
    const onSkip = vi.fn();
    render(<WelcomeModal {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Skip Tour'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(<WelcomeModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('welcome-modal-title');
  });

  it('renders with fixed overlay (has fixed inset-0 classes)', () => {
    const { container } = render(<WelcomeModal {...defaultProps} />);
    const overlay = container.firstChild;
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
  });

  it('"Start Tour" button has focus on mount (auto-focus)', () => {
    render(<WelcomeModal {...defaultProps} />);
    const startButton = screen.getByText('Start Tour');
    expect(document.activeElement).toBe(startButton);
  });

  it('renders custom title and description when provided', () => {
    render(<WelcomeModal {...defaultProps} title="Custom Title" description="Custom desc" />);
    expect(screen.getByText('Custom Title')).toBeDefined();
    expect(screen.getByText('Custom desc')).toBeDefined();
  });

  it('Tab from Skip Tour button wraps focus to Start Tour', () => {
    render(<WelcomeModal {...defaultProps} />);
    const skipBtn = screen.getByText('Skip Tour');
    const startBtn = screen.getByText('Start Tour');
    skipBtn.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(startBtn);
  });

  it('Shift+Tab from Start Tour button wraps focus to Skip Tour', () => {
    render(<WelcomeModal {...defaultProps} />);
    const skipBtn = screen.getByText('Skip Tour');
    const startBtn = screen.getByText('Start Tour');
    startBtn.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(skipBtn);
  });

  it('Tab from a non-boundary element does not affect focus', () => {
    render(<WelcomeModal {...defaultProps} />);
    screen.getByRole('dialog').focus();
    const preventDefaultSpy = vi.fn();
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Tab',
      shiftKey: false,
      preventDefault: preventDefaultSpy
    });
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('non-Tab keydown does not affect focus', () => {
    render(<WelcomeModal {...defaultProps} />);
    const startBtn = screen.getByText('Start Tour');
    startBtn.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(document.activeElement).toBe(startBtn);
  });
});
