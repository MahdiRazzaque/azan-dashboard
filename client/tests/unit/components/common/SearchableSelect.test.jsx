import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SearchableSelect from '../../../../src/components/common/SearchableSelect';

describe('SearchableSelect', () => {
  const options = [
    { value: '1', label: 'Option 1', sublabel: 'Sub 1' },
    { value: '2', label: 'Option 2', missing: true },
    { value: '3', label: 'Special', sublabel: 'Sub 3' }
  ];

  it('should render placeholder when no value selected', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} placeholder="Test Select" />);
    expect(screen.getByText('Test Select')).toBeDefined();
  });

  it('should render selected option label', () => {
    render(<SearchableSelect options={options} value="1" onChange={vi.fn()} />);
    expect(screen.getByText('Option 1')).toBeDefined();
    expect(screen.getByText('Sub 1')).toBeDefined();
  });

  it('should toggle dropdown on click', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} />);
    const trigger = screen.getByText('Select...');
    
    fireEvent.click(trigger);
    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
    
    fireEvent.click(trigger);
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  it('should filter options based on search', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Select...'));
    
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Option 1' } });
    
    expect(screen.getByText('Option 1')).toBeDefined();
    expect(screen.queryByText('Option 2')).toBeNull();
    expect(screen.queryByText('Special')).toBeNull();
  });

  it('should filter based on sublabel', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Select...'));
    
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Sub 3' } });
    
    expect(screen.getByText('Special')).toBeDefined();
  });

  it('should call onChange and close when an option is selected', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={options} onChange={onChange} />);
    fireEvent.click(screen.getByText('Select...'));
    
    fireEvent.click(screen.getByText('Option 1'));
    expect(onChange).toHaveBeenCalledWith('1');
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  it('should clear search when X is clicked', () => {
    const { container } = render(<SearchableSelect options={options} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Select...'));
    
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'search term' } });
    
    // X button appears
    const clearButton = container.querySelector('svg.lucide-x');
    fireEvent.click(clearButton);
    
    expect(input.value).toBe('');
  });

  it('should show "No results found"', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Select...'));
    
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText('No results found')).toBeDefined();
  });

  it('should close dropdown when clicking outside', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Select...'));
    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
    
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  it('should apply missing style to option', () => {
    render(<SearchableSelect options={options} value="2" onChange={vi.fn()} />);
    const label = screen.getByText('Option 2');
    expect(label.className).toContain('text-red-400');
  });
});
