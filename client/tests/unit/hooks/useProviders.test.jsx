import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useProviders } from "../../../src/hooks/useProviders";
import { SettingsContext } from "../../../src/hooks/useSettings";

describe("useProviders", () => {
  it("should return provider metadata from SettingsContext", () => {
    const mockContextValue = {
      providers: [{ id: "aladhan", name: "Aladhan" }],
      providersLoading: false,
      fetchProviders: vi.fn(),
    };

    const wrapper = ({ children }) => (
      <SettingsContext.Provider value={mockContextValue}>
        {children}
      </SettingsContext.Provider>
    );

    const { result } = renderHook(() => useProviders(), { wrapper });

    expect(result.current.providers).toEqual(mockContextValue.providers);
    expect(result.current.loading).toBe(false);
    expect(result.current.refresh).toBe(mockContextValue.fetchProviders);
  });
});
