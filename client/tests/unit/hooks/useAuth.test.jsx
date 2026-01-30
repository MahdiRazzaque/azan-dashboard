import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAuth, AuthContext } from '../../../src/hooks/useAuth';

describe('useAuth', () => {
  it('should return context value', () => {
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ isAuthenticated: true, user: { name: 'Test' } }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user.name).toBe('Test');
  });

  it('should return null if used outside provider', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeNull();
  });
});
