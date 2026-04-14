import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../../../../src/components/layout/ProtectedRoute";
import { useAuth } from "../../../../src/hooks/useAuth";

vi.mock("../../../../src/hooks/useAuth");

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading spinner when auth is loading", () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false });
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(container.querySelector(".animate-spin")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("should redirect to /login when not authenticated", () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: false });
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Login Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("should render children when authenticated", () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("Protected Content")).toBeDefined();
  });
});
