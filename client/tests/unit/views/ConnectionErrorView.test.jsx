import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConnectionErrorView from "../../../src/views/ConnectionErrorView";
import { useAuth } from "../../../src/hooks/useAuth";

vi.mock("../../../src/hooks/useAuth");

describe("ConnectionErrorView", () => {
  const refreshAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ refreshAuth });
  });

  it("should render error message", () => {
    render(<ConnectionErrorView />);
    expect(screen.getByText("Server Unreachable")).toBeDefined();
    expect(
      screen.getByText(/Please ensure the backend service is running/),
    ).toBeDefined();
  });

  it("should call refreshAuth when retry button is clicked", () => {
    render(<ConnectionErrorView />);
    const retryButton = screen.getByText("Retry Connection");
    fireEvent.click(retryButton);
    expect(refreshAuth).toHaveBeenCalled();
  });
});
