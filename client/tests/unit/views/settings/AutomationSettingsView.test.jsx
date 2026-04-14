import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AutomationSettingsView from "../../../../src/views/settings/AutomationSettingsView";
import { useSettings } from "../../../../src/hooks/useSettings";

vi.mock("../../../../src/hooks/useSettings");
vi.mock(
  "../../../../src/components/settings/automation/AutomationGeneralTab",
  () => ({ default: () => <div data-testid="general-tab">General Tab</div> }),
);
vi.mock(
  "../../../../src/components/settings/automation/AutomationOutputsTab",
  () => ({ default: () => <div data-testid="outputs-tab">Outputs Tab</div> }),
);
vi.mock(
  "../../../../src/components/settings/automation/AutomationVoiceTab",
  () => ({ default: () => <div data-testid="voice-tab">Voice Tab</div> }),
);

describe("AutomationSettingsView", () => {
  const mockConfig = { automation: { outputs: { local: { enabled: true } } } };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      config: mockConfig,
      draftConfig: mockConfig,
      updateSetting: vi.fn(),
      loading: false,
      systemHealth: { local: { healthy: true } },
      bulkUpdateOffsets: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
  });

  it("should render correctly and default to General tab", () => {
    render(
      <MemoryRouter>
        <AutomationSettingsView />
      </MemoryRouter>,
    );
    expect(screen.getByText("Automation & Outputs")).toBeDefined();
    expect(screen.getByTestId("general-tab")).toBeDefined();
  });

  it("should switch tabs", () => {
    render(
      <MemoryRouter>
        <AutomationSettingsView />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Outputs"));
    expect(screen.getByTestId("outputs-tab")).toBeDefined();

    fireEvent.click(screen.getByText("Voice Library"));
    expect(screen.getByTestId("voice-tab")).toBeDefined();
  });

  it("should show unhealthy indicator for outputs tab", () => {
    useSettings.mockReturnValue({
      config: mockConfig,
      draftConfig: mockConfig,
      updateSetting: vi.fn(),
      loading: false,
      systemHealth: { local: { healthy: false } },
      bulkUpdateOffsets: vi.fn(),
    });
    render(
      <MemoryRouter>
        <AutomationSettingsView />
      </MemoryRouter>,
    );
    const outputsTab = screen.getByText("Outputs").closest("button");
    // AlertTriangle should be present
    expect(outputsTab.querySelector(".lucide-triangle-alert")).toBeDefined();
  });

  it("should handle fetch error for strategies", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: false });
    render(
      <MemoryRouter>
        <AutomationSettingsView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });
});
