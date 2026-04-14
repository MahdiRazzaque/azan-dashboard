import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DeveloperSettingsView from "../../../../src/views/settings/DeveloperSettingsView";
import { useSettings } from "../../../../src/hooks/useSettings";
import { MemoryRouter, useOutletContext } from "react-router-dom";

vi.mock("../../../../src/hooks/useSettings");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useOutletContext: vi.fn(),
  };
});

vi.mock("../../../../src/components/settings/developer/DiagnosticsTab", () => ({
  default: ({
    handleManualRefresh,
    callSystemAction,
    handleRunJob,
    feedback,
  }) => (
    <div data-testid="diagnostics-tab">
      <button onClick={() => handleManualRefresh("api")}>Refresh API</button>
      <button onClick={() => handleManualRefresh("tts")}>Refresh TTS</button>
      <button onClick={() => callSystemAction("config", "/api/config")}>
        Call Config Action
      </button>
      <button onClick={() => callSystemAction("other", "/api/other")}>
        Call Other Action
      </button>
      <button onClick={() => handleRunJob("job1")}>Run Job</button>
      {feedback &&
        Object.entries(feedback).map(([k, v]) => <div key={k}>{v}</div>)}
    </div>
  ),
}));
vi.mock(
  "../../../../src/components/settings/developer/AutomationTTSTab",
  () => ({
    default: () => <div data-testid="automation-tab">Automation Tab</div>,
  }),
);
vi.mock("../../../../src/components/settings/developer/SystemLogsTab", () => ({
  default: () => <div data-testid="logs-tab">Logs Tab</div>,
}));
vi.mock("../../../../src/components/settings/developer/HealthTab", () => ({
  default: () => <div data-testid="health-tab">Health Tab</div>,
}));

describe("DeveloperSettingsView Extended Coverage", () => {
  const mockSettings = {
    systemHealth: { tts: { healthy: true } },
    refreshHealth: vi.fn(),
    config: {},
    refresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue(mockSettings);
    useOutletContext.mockReturnValue({ logs: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (url === "/api/system/jobs")
          return { ok: true, json: () => Promise.resolve({ maintenance: [] }) };
        if (url === "/api/system/status/automation")
          return { ok: true, json: () => Promise.resolve({}) };
        if (url === "/api/system/status/tts")
          return { ok: true, json: () => Promise.resolve({}) };
        return { ok: true, json: () => Promise.resolve({}) };
      }),
    );
  });

  it("should handle API refresh failure", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/health") return { ok: false, status: 500 };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Refresh API"));
    });
    expect(await screen.findByText("Unreachable")).toBeDefined();
  });

  it("should handle refreshHealth error response", async () => {
    mockSettings.refreshHealth.mockResolvedValue({ error: "Rate Limit" });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Refresh TTS"));
    });
    expect(await screen.findByText("Rate Limit")).toBeDefined();
  });

  it("should handle fetchJobs with array data", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/system/jobs")
        return { ok: true, json: () => Promise.resolve([{ name: "Job 1" }]) };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
  });

  it("should handle fetchJobs with empty data", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/system/jobs")
        return { ok: true, json: () => Promise.resolve({}) };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
  });

  it("should handle fetchDiagnostics failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementation(async (url) => {
      if (url.includes("/api/system/status/")) return { ok: false };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch diagnostics"),
        expect.anything(),
      ),
    );
    consoleSpy.mockRestore();
  });

  it("should handle callSystemAction with warnings", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/config")
        return {
          ok: true,
          json: () => Promise.resolve({ message: "Done", warnings: ["W1"] }),
        };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Call Config Action"));
    expect(await screen.findByText("W1")).toBeDefined();
  });

  it("should handle callSystemAction failure", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/other")
        return {
          ok: false,
          json: () => Promise.resolve({ error: "Action Failed" }),
        };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Call Other Action"));
    expect(await screen.findByText("Action Failed")).toBeDefined();
  });

  it("should handle handleRunJob failure", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/system/run-job")
        return {
          ok: false,
          json: () => Promise.resolve({ message: "Job Failed" }),
        };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Run Job"));
    expect(await screen.findByText("Job Failed")).toBeDefined();
  });

  it("should handle tab switching", () => {
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Health"));
    expect(screen.getByTestId("health-tab")).toBeDefined();
    fireEvent.click(screen.getByText("Automation & TTS"));
    expect(screen.getByTestId("automation-tab")).toBeDefined();
    fireEvent.click(screen.getByText("System Logs"));
    expect(screen.getByTestId("logs-tab")).toBeDefined();
  });

  it("should handle message close click", async () => {
    fetch.mockImplementation(async (url) => {
      if (url === "/api/other")
        return {
          ok: true,
          json: () => Promise.resolve({ message: "Success" }),
        };
      return { ok: true, json: () => Promise.resolve({}) };
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Call Other Action"));
    await screen.findByText("Success");
    const closeBtn = screen.getByLabelText("Close message");
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    await waitFor(() => {
      expect(screen.queryByText("Success")).toBeNull();
    });
  });
});
