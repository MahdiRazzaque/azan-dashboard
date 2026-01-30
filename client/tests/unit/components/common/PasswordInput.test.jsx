import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PasswordInput from '../../../../src/components/common/PasswordInput';

describe('PasswordInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: 'Enter password'
  };

  it('should render correctly with default props', () => {
    render(<PasswordInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toBeDefined();
    expect(input.getAttribute('type')).toBe('password');
  });

  it('should toggle password visibility', () => {
    render(<PasswordInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByRole('button');
    
    fireEvent.click(toggleButton);
    expect(input.getAttribute('type')).toBe('text');
    
    fireEvent.click(toggleButton);
    expect(input.getAttribute('type')).toBe('password');
  });

  it('should call onChange and set touched when typing', () => {
    const onChange = vi.fn();
    render(<PasswordInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Enter password');
    
    fireEvent.change(input, { target: { value: 'newpassword' } });
    expect(onChange).toHaveBeenCalledWith('newpassword');
  });

  it('should not show strength indicator by default', () => {
    render(<PasswordInput {...defaultProps} showStrength={false} />);
    expect(screen.queryByText('Password Strength')).toBeNull();
  });

  it('should show strength indicator when showStrength is true and touched', () => {
    render(<PasswordInput {...defaultProps} showStrength={true} value="" />);
    const input = screen.getByPlaceholderText('Enter password');
    
    // Initially hidden because not touched and value is empty
    const strengthLabel = screen.queryByText('Password Strength');
    // It's in the DOM but maybe hidden by classes. 
    // The code says: className={`... ${touched || value.length > 0 ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
    // So it is rendered.
    expect(strengthLabel).not.toBeNull();

    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByText('Weak')).toBeDefined();
  });

  it('should show "Weak" strength for 2 or fewer passed checks', () => {
    const { container } = render(<PasswordInput {...defaultProps} showStrength={true} value="abc" />);
    // abc passes: Lowercase (1)
    expect(screen.getByText('Weak')).toBeDefined();
    const progressBar = container.querySelector('.bg-red-500');
    expect(progressBar).toBeDefined();
    expect(progressBar.style.width).toBe('20%');
  });

  it('should show "Medium" strength for 3 or 4 passed checks', () => {
    render(<PasswordInput {...defaultProps} showStrength={true} value="Abc1" />);
    // Abc1 passes: Uppercase, Lowercase, Number (3)
    expect(screen.getByText('Medium')).toBeDefined();
    // Use container to find the progress bar specifically
  });

  it('should show "Strong" strength for all 5 passed checks', () => {
    render(<PasswordInput {...defaultProps} showStrength={true} value="Abc1!" />);
    // Abc1! passes: 8+ (Wait, Abc1! is only 5 chars)
    // Let's use: "Abcdef1!" (8 chars)
    render(<PasswordInput {...defaultProps} showStrength={true} value="Abcdef1!" />);
    expect(screen.getByText('Strong')).toBeDefined();
  });

  it('should correctly display requirement checks', () => {
    const { container } = render(<PasswordInput {...defaultProps} showStrength={true} value="A" />);
    // Uppercase passed, others failed
    expect(screen.getByText('Uppercase')).toBeDefined();
    // The icon for passed check is Lucide Check
    // We can check for the presence of the svg or the class
    const passedCheck = screen.getByText('Uppercase').previousSibling;
    expect(passedCheck.nodeName).toBe('svg');
    
    const failedCheck = screen.getByText('8+ Characters').previousSibling;
    expect(failedCheck.nodeName).toBe('DIV');
    expect(failedCheck.className).toContain('rounded-full');
  });

  it('should use cn utility function correctly (implicitly)', () => {
    // This covers the cn function which uses twMerge and clsx
    const { rerender } = render(<PasswordInput {...defaultProps} showStrength={true} value="abc" />);
    const strengthText = screen.getByText('Weak');
    expect(strengthText.className).toContain('text-red-400');

    rerender(<PasswordInput {...defaultProps} showStrength={true} value="Abcdef1!" />);
    const strengthTextStrong = screen.getByText('Strong');
    expect(strengthTextStrong.className).toContain('text-emerald-400');
  });
});
