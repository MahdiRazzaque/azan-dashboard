import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useClientPreferences, ClientPreferencesContext } from '../../../src/hooks/useClientPreferences';

describe('useClientPreferences', () => {
  it('should return context value', () => {
    const mockValue = { preferences: { theme: 'dark' } };
    const wrapper = ({ children }) => (
      <ClientPreferencesContext.Provider value={mockValue}>
        {children}
      </ClientPreferencesContext.Provider>
    );

    const { result } = renderHook(() => useClientPreferences(), { wrapper });
    expect(result.current).toEqual(mockValue);
  });

  it('should throw error if used outside provider', () => {
    // Suppress console.error for this test as throwing in a hook will log it
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => renderHook(() => useClientPreferences())).toThrow('useClientPreferences must be used within a ClientPreferencesProvider');
    
    consoleSpy.mockRestore();
  });
});
