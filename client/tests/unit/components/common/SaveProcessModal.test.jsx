import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import SaveProcessModal from '../../../../src/components/common/SaveProcessModal';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

describe('SaveProcessModal', () => {
  const mockNavigate = vi.fn();
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    status: 'processing',
    result: null,
    processStatus: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useNavigate.mockReturnValue(mockNavigate);
  });

  it('should return null if not open', () => {
    const { container } = render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} isOpen={false} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render processing state', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} processStatus="Custom status" />
      </MemoryRouter>
    );
    expect(screen.getByText('Custom status')).toBeDefined();
    expect(screen.getByText(/This process involves generating audio files/)).toBeDefined();
  });

  it('should render default processing state when processStatus is null', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} processStatus={null} />
      </MemoryRouter>
    );
    expect(screen.getByText('Saving Configuration...')).toBeDefined();
    expect(screen.getByText(/Please wait while we update the system/)).toBeDefined();
  });

  it('should render success state', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={{ success: true }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Configuration Saved')).toBeDefined();
    expect(screen.getByText('Great, Close')).toBeDefined();
  });

  it('should render warning state', () => {
    const result = { success: true, warning: true, warningsList: ['Warning 1', 'Warning 2'] };
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={result} />
      </MemoryRouter>
    );
    expect(screen.getByText('Saved with Warnings')).toBeDefined();
    expect(screen.getByText('Warning 1')).toBeDefined();
    expect(screen.getByText('Warning 2')).toBeDefined();
    
    const healthButton = screen.getByText('Go to System Health');
    fireEvent.click(healthButton);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/developer');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render error state without warningsList', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={{ success: false, error: 'Failed big time' }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Configuration Not Saved')).toBeDefined();
    expect(screen.getByText('Failed big time')).toBeDefined();
  });

  it('should handle single warning string', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={{ success: true, warning: 'Single warning' }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Single warning')).toBeDefined();
  });

  it('should handle boolean warning with fallback', () => {
    // This is to cover the 'Unknown Issue' branch if somehow reachable, 
    // but primarily to cover the case where warning is just true.
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={{ success: true, warning: true }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Saved with Warnings')).toBeDefined();
  });

  it('should handle null warningsList', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={{ success: true, warning: 'Single', warningsList: null }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Single')).toBeDefined();
  });

  it('should call onClose when close button clicked', () => {
    render(
      <MemoryRouter>
        <SaveProcessModal {...defaultProps} result={{ success: true }} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Great, Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
