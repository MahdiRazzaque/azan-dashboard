import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useNavigate, useLocation } from "react-router-dom";
import LoginView from "../../../src/views/LoginView";
import { useAuth } from "../../../src/hooks/useAuth";

vi.mock("../../../src/hooks/useAuth");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe("LoginView", () => {
  const mockLogin = vi.fn();
  const mockNavigate = vi.fn();
  const mockLocation = { state: null };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ login: mockLogin });
    useNavigate.mockReturnValue(mockNavigate);
    useLocation.mockReturnValue(mockLocation);
  });

  it("should render login form", () => {
    render(
      <MemoryRouter>
        <LoginView />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText("Password")).toBeDefined();
    expect(screen.getByText("Unlock Settings")).toBeDefined();
  });

  it("should handle successful login and navigate to /settings", async () => {
    mockLogin.mockResolvedValue({ success: true });
    render(
      <MemoryRouter>
        <LoginView />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Password");
    const button = screen.getByText("Unlock Settings");

    fireEvent.change(input, { target: { value: "correctpassword" } });
    fireEvent.click(button);

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith("correctpassword"),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/settings", { replace: true });
  });

  it("should handle successful login and navigate to previous location", async () => {
    useLocation.mockReturnValue({
      state: { from: { pathname: "/developer" } },
    });
    mockLogin.mockResolvedValue({ success: true });
    render(
      <MemoryRouter>
        <LoginView />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Password");
    const button = screen.getByText("Unlock Settings");

    fireEvent.change(input, { target: { value: "password" } });
    fireEvent.click(button);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/developer", {
        replace: true,
      }),
    );
  });

  it("should handle failed login and show error", async () => {
    mockLogin.mockResolvedValue({ success: false, error: "Wrong password" });
    render(
      <MemoryRouter>
        <LoginView />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Password");
    const button = screen.getByText("Unlock Settings");

    fireEvent.change(input, { target: { value: "wrongpassword" } });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByText("Wrong password")).toBeDefined(),
    );
  });

  it("should show default error if none provided", async () => {
    mockLogin.mockResolvedValue({ success: false });
    render(
      <MemoryRouter>
        <LoginView />
      </MemoryRouter>,
    );

    const button = screen.getByText("Unlock Settings");
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByText("Invalid Password")).toBeDefined(),
    );
  });
});
