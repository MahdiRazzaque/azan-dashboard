import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSettings, SettingsContext } from '../../../src/hooks/useSettings';

describe('useSettings', () => {
  it('should return context value', () => {
    const wrapper = ({ children }) => (
      <SettingsContext.Provider value={{ config: { test: true } }}>
        {children}
      </SettingsContext.Provider>
    );

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.config.test).toBe(true);
  });

  it('should return null if used outside provider', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current).toBeNull();
  });
});
