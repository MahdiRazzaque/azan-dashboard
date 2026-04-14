import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, useOutletContext } from "react-router-dom";
import DeveloperSettingsView from "../../../../src/views/settings/DeveloperSettingsView";
import { useSettings } from "../../../../src/hooks/useSettings";

vi.mock("../../../../src/hooks/useSettings");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useOutletContext: vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("../../../../src/components/settings/developer/DiagnosticsTab", () => ({
  default: ({
    handleManualRefresh,
    callSystemAction,
    handleRunJob,
    jobs,
    feedback,
  }) => (
    <div data-testid="diagnostics-tab">
      <button onClick={() => handleManualRefresh("api")}>Refresh API</button>
      <button onClick={() => handleManualRefresh("tts")}>Refresh TTS</button>
      <button onClick={() => callSystemAction("tts", "/api/tts")}>
        Call TTS
      </button>
      <button onClick={() => callSystemAction("config", "/api/config")}>
        Call Config
      </button>
      <button onClick={() => handleRunJob("Job1")}>Run Job</button>
      {jobs.length > 0 ? (
        <div>{jobs[0].name}</div>
      ) : (
        <div>No active maintenance jobs</div>
      )}
      {feedback.api && <div>{feedback.api}</div>}
      {feedback.tts && <div>{feedback.tts}</div>}
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

describe("DeveloperSettingsView", () => {
  const refresh = vi.fn();
  const refreshHealth = vi.fn();
  const mockConfig = { id: "cfg" };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      config: mockConfig,
      draftConfig: mockConfig,
      refresh,
      refreshHealth,
      loading: false,
      systemHealth: {},
    });
    useOutletContext.mockReturnValue({ logs: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url) => {
        if (url === "/api/system/jobs")
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ maintenance: [{ name: "Job1" }] }),
          });
        if (url === "/api/system/status/automation")
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        if (url === "/api/system/status/tts")
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: "OK" }),
        });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render correctly and fetch initial data", async () => {
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    expect(screen.getByText("Developer Tools")).toBeDefined();
    expect(await screen.findByText("Job1")).toBeDefined();
  });

  it("should handle run job failure with error field", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/system/run-job")
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Job Error" }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Run Job"));
    expect(await screen.findByText("Job Error")).toBeDefined();
  });

  it("should handle diagnostics partial failure (autoRes fail)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementation((url) => {
      if (url.includes("/status/automation"))
        return Promise.resolve({ ok: false });
      if (url.includes("/status/tts"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("should handle diagnostics partial failure (ttsRes fail)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementation((url) => {
      if (url.includes("/status/automation"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      if (url.includes("/status/tts")) return Promise.resolve({ ok: false });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("should handle successful manual refresh of API", async () => {
    fetch.mockResolvedValueOnce({ ok: true }); // API Ping
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Refresh API"));
    expect(await screen.findByText("Online")).toBeDefined();
  });

  it("should handle manual refresh of other services failure", async () => {
    refreshHealth.mockResolvedValue({ error: "Rate Limit" });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Refresh TTS"));
    await waitFor(() => expect(refreshHealth).toHaveBeenCalledWith("tts"));
  });

  it("should handle system actions successfully", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/tts")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, message: "TTS Rebuilt" }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );

    await screen.findByText("Call TTS");
    fireEvent.click(screen.getByText("Call TTS"));
    expect(await screen.findByText("TTS Rebuilt")).toBeDefined();
  });

  it("should handle special config action", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/config")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, message: "Config Saved" }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );

    await screen.findByText("Call Config");
    fireEvent.click(screen.getByText("Call Config"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(refreshHealth).toHaveBeenCalledWith("primarySource");
  });

  it("should handle run job action", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/system/run-job")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );

    await screen.findByText("Run Job");
    fireEvent.click(screen.getByText("Run Job"));
    expect(await screen.findByText(/executed successfully/)).toBeDefined();
  });

  it("should handle fetchJobs with legacy array format", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/system/jobs")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: "LegacyJob" }]),
        });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    expect(await screen.findByText("LegacyJob")).toBeDefined();
  });

  it("should handle fetchJobs with automation only", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/system/jobs")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ automation: [] }),
        });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No active maintenance jobs")).toBeDefined();
  });

  it("should handle fetchJobs error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementation((url) => {
      if (url === "/api/system/jobs")
        return Promise.reject(new Error("Job fail"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("should handle system action with warnings", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/tts")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Done",
              warnings: ["W1"],
            }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Call TTS"));
    expect(await screen.findByText("W1")).toBeDefined();
  });

  it("should handle diagnostics fetch failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementation((url) => {
      if (url.includes("/api/system/status"))
        return Promise.resolve({ ok: false });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("should handle system action failure with error field", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/tts")
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Specific Error" }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Call TTS"));
    expect(await screen.findByText("Specific Error")).toBeDefined();
  });

  it("should handle system action failure with no details", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/tts")
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ maintenance: [] }),
      });
    });
    render(
      <MemoryRouter>
        <DeveloperSettingsView />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Call TTS"));
    expect(await screen.findByText("Failed")).toBeDefined();
  });
});
