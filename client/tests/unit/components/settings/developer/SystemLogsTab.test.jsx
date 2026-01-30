import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SystemLogsTab from '../../../../../src/components/settings/developer/SystemLogsTab';

describe('SystemLogsTab', () => {
  it('should render "No logs received yet..." when logs are empty', () => {
    render(<SystemLogsTab logs={[]} />);
    expect(screen.getByText('No logs received yet...')).toBeDefined();
  });

  it('should render logs with correct levels and messages', () => {
    const logs = [
      { timestamp: '2026-01-30T10:00:00', level: 'INFO', message: 'Info log' },
      { timestamp: '2026-01-30T10:01:00', level: 'WARN', message: 'Warn log' },
      { timestamp: '2026-01-30T10:02:00', level: 'ERROR', message: 'Error log' }
    ];
    render(<SystemLogsTab logs={logs} />);
    
    expect(screen.getByText('Info log')).toBeDefined();
    expect(screen.getByText('Warn log')).toBeDefined();
    expect(screen.getByText('Error log')).toBeDefined();
    
    expect(screen.getByText('INFO')).toBeDefined();
    expect(screen.getByText('WARN')).toBeDefined();
    expect(screen.getByText('ERROR')).toBeDefined();
  });

  it('should render logs in reverse order', () => {
    const logs = [
      { timestamp: '2026-01-30T10:00:00', level: 'INFO', message: 'First' },
      { timestamp: '2026-01-30T10:01:00', level: 'INFO', message: 'Second' }
    ];
    const { container } = render(<SystemLogsTab logs={logs} />);
    const logMessages = container.querySelectorAll('.break-all');
    // In code: [...logs].reverse().map
    // So 'Second' should be first in DOM
    expect(logMessages[0].textContent).toBe('Second');
    expect(logMessages[1].textContent).toBe('First');
  });
});
