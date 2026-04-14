import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AutomationTTSTab from "../../../../../src/components/settings/developer/AutomationTTSTab";

vi.mock("../../../../../src/components/settings/developer/StatusCells", () => ({
  AutomationStatusCell: ({ status }) => (
    <div data-testid="automation-status">{status}</div>
  ),
  TTSStatusCell: ({ status }) => <div data-testid="tts-status">{status}</div>,
}));

describe("AutomationTTSTab", () => {
  const fetchDiagnostics = vi.fn();
  const defaultProps = {
    config: {
      automation: {
        global: {
          enabled: true,
          preAdhanEnabled: true,
          adhanEnabled: true,
          preIqamahEnabled: true,
          iqamahEnabled: true,
        },
      },
    },
    systemHealth: { tts: { healthy: true } },
    automationStatus: {
      fajr: {
        preAdhan: { status: "PASSED" },
        adhan: { status: "PASSED" },
        preIqamah: { status: "PASSED" },
        iqamah: { status: "PASSED" },
      },
      sunrise: { preAdhan: { status: "PASSED" }, adhan: { status: "PASSED" } },
    },
    ttsStatus: {
      fajr: {
        preAdhan: { status: "GENERATED" },
        adhan: { status: "GENERATED" },
        preIqamah: { status: "GENERATED" },
        iqamah: { status: "GENERATED" },
      },
      sunrise: {
        preAdhan: { status: "GENERATED" },
        adhan: { status: "GENERATED" },
      },
    },
    fetchDiagnostics,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render correctly with status data", () => {
    render(<AutomationTTSTab {...defaultProps} />);
    expect(screen.getByText("Automation Timeline")).toBeDefined();
    expect(screen.getByText("TTS Asset Status")).toBeDefined();
    expect(screen.getAllByTestId("automation-status").length).toBeGreaterThan(
      0,
    );
  });

  it("should handle refresh successfully", async () => {
    fetchDiagnostics.mockResolvedValue(true);
    render(<AutomationTTSTab {...defaultProps} />);

    const refreshButton = screen.getAllByRole("button", {
      name: /Refresh/i,
    })[0];
    fireEvent.click(refreshButton);

    expect(fetchDiagnostics).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getAllByText("Refreshed").length).toBeGreaterThan(0),
    );
  });

  it("should handle refresh failure", async () => {
    fetchDiagnostics.mockResolvedValue(false);
    render(<AutomationTTSTab {...defaultProps} />);

    const refreshButton = screen.getAllByRole("button", {
      name: /Refresh/i,
    })[0];
    fireEvent.click(refreshButton);

    await waitFor(() =>
      expect(screen.getAllByText("Failed").length).toBeGreaterThan(0),
    );
  });

  it("should show globally disabled state", () => {
    const props = {
      ...defaultProps,
      config: { automation: { global: { enabled: false } } },
    };
    render(<AutomationTTSTab {...props} />);
    expect(screen.getByText("Automation Globally Disabled")).toBeDefined();
  });

  it("should show sub-systems disabled opacity", () => {
    const props = {
      ...defaultProps,
      config: {
        automation: { global: { enabled: true, preAdhanEnabled: false } },
      },
    };
    render(<AutomationTTSTab {...props} />);
    const headers = screen.getAllByText("Pre-Adhan");
    // First header is in Timeline table
    expect(headers[0].className).toContain("opacity-30");
  });

  it("should show TTS service offline message", () => {
    const props = {
      ...defaultProps,
      systemHealth: { tts: { healthy: false } },
    };
    render(<AutomationTTSTab {...props} />);
    expect(screen.getByText("SERVICE OFFLINE")).toBeDefined();
  });

  it("should show loading state when status is null", () => {
    render(
      <AutomationTTSTab
        {...defaultProps}
        automationStatus={null}
        ttsStatus={null}
      />,
    );
    const loadingCells = screen.getAllByText("Loading...");
    expect(loadingCells.length).toBeGreaterThan(0);
  });
});
