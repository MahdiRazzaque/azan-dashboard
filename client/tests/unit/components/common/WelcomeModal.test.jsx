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
});
