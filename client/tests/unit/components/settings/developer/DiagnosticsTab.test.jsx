import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DiagnosticsTab from "../../../../../src/components/settings/developer/DiagnosticsTab";

vi.mock(
  "../../../../../src/components/settings/PrayerSourceStatusCard",
  () => ({ default: () => <div data-testid="source-card">Source Card</div> }),
);
vi.mock(
  "../../../../../src/components/settings/developer/StorageManagementCard",
  () => ({ default: () => <div data-testid="storage-card">Storage Card</div> }),
);
vi.mock(
  "../../../../../src/components/settings/developer/NetworkConfigCard",
  () => ({ default: () => <div data-testid="network-card">Network Card</div> }),
);

describe("DiagnosticsTab", () => {
  const handleManualRefresh = vi.fn();
  const callSystemAction = vi.fn();
  const handleRunJob = vi.fn();

  const defaultProps = {
    config: {},
    systemHealth: {
      tts: { healthy: true },
      ports: { api: "3000", tts: "8000" },
    },
    apiOnline: true,
    refreshing: null,
    handleManualRefresh,
    feedback: {},
    loading: null,
    callSystemAction,
    handleRunJob,
    jobStatuses: {},
    jobs: [{ name: "Job 1", nextInvocation: "2026-01-30T15:00:00" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all sections", () => {
    render(<DiagnosticsTab {...defaultProps} />);
    expect(screen.getByText("System Health")).toBeDefined();
    expect(screen.getByText("System Actions")).toBeDefined();
    expect(screen.getByText("Maintenance Jobs")).toBeDefined();
    expect(screen.getByTestId("source-card")).toBeDefined();
    expect(screen.getByTestId("network-card")).toBeDefined();
    expect(screen.getByTestId("storage-card")).toBeDefined();
  });

  it("should handle manual refresh of services", () => {
    render(<DiagnosticsTab {...defaultProps} />);
    const refreshButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector(".lucide-refresh-cw"));

    // API Refresh
    fireEvent.click(refreshButtons[0]);
    expect(handleManualRefresh).toHaveBeenCalledWith("api");

    // TTS Refresh
    fireEvent.click(refreshButtons[1]);
    expect(handleManualRefresh).toHaveBeenCalledWith("tts");
  });

  it("should handle system actions", () => {
    render(<DiagnosticsTab {...defaultProps} />);

    fireEvent.click(screen.getByText("Regenerate TTS Assets"));
    expect(callSystemAction).toHaveBeenCalledWith(
      "tts",
      "/api/system/regenerate-tts",
    );

    fireEvent.click(screen.getByText("Restart Scheduler"));
    expect(callSystemAction).toHaveBeenCalledWith(
      "scheduler",
      "/api/system/restart-scheduler",
    );
  });

  it("should show feedback balloons", () => {
    const props = {
      ...defaultProps,
      feedback: { api: "Updated" },
    };
    render(<DiagnosticsTab {...props} />);
    expect(screen.getByText("Updated")).toBeDefined();
  });

  it("should handle maintenance jobs", () => {
    render(<DiagnosticsTab {...defaultProps} />);
    expect(screen.getByText("Job 1")).toBeDefined();

    const runJobButton = screen.getByTitle("Run Now");
    fireEvent.click(runJobButton);
    expect(handleRunJob).toHaveBeenCalledWith("Job 1");
  });

  it("should show empty jobs message", () => {
    render(<DiagnosticsTab {...defaultProps} jobs={[]} />);
    expect(screen.getByText("No active maintenance jobs")).toBeDefined();
  });

  it("should disable action buttons when loading", () => {
    render(<DiagnosticsTab {...defaultProps} loading="tts" />);
    const ttsButton = screen
      .getByText("Regenerate TTS Assets")
      .closest("button");
    expect(ttsButton.disabled).toBe(true);

    const restartButton = screen
      .getByText("Restart Scheduler")
      .closest("button");
    expect(restartButton.disabled).toBe(true);
  });

  it("should show refreshing state for services", () => {
    const props = {
      ...defaultProps,
      refreshing: "api",
    };
    const { container } = render(<DiagnosticsTab {...props} />);
    // Check for animate-spin on the refresh icon of API server
    const apiSection = screen
      .getByText("API Server")
      .closest("div").parentElement;
    const refreshIcon = apiSection.querySelector(".animate-spin");
    expect(refreshIcon).toBeDefined();
  });

  it("should show offline state for API server", () => {
    const props = {
      ...defaultProps,
      apiOnline: false,
    };
    const { container } = render(<DiagnosticsTab {...props} />);
    const apiSection = screen.getByText("API Server").closest("div");
    // XCircle should be present
    expect(apiSection.querySelector(".lucide-circle-x")).toBeDefined();
  });

  it("should show TTS Service Offline message when unhealthy", () => {
    const props = {
      ...defaultProps,
      systemHealth: { tts: null },
    };
    render(<DiagnosticsTab {...props} />);
    expect(screen.getByText("TTS Service Offline")).toBeDefined();
  });
});
