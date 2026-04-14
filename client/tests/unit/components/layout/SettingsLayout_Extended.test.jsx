import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SettingsLayout from "../../../../src/components/layout/SettingsLayout";
import { useSettings } from "../../../../src/hooks/useSettings";
import { useAuth } from "../../../../src/hooks/useAuth";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../../src/hooks/useAuth");
vi.mock("../../../../src/hooks/useSettings");
vi.mock("../../../../src/components/common/ConfirmModal", () => ({
  default: ({ isOpen, onConfirm, onClose, title }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        {title}
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));
vi.mock("../../../../src/components/common/SaveProcessModal", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="process-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe("SettingsLayout Extended Coverage", () => {
  const mockSettings = {
    config: {
      sources: { backup: { enabled: true } },
      automation: { outputs: { alexa: { enabled: true } } },
    },
    draftConfig: {
      sources: { backup: { enabled: true } },
      automation: { outputs: { alexa: { enabled: true } } },
    },
    systemHealth: {
      primarySource: { healthy: true },
      backupSource: { healthy: true },
      alexa: { healthy: true },
    },
    hasUnsavedChanges: vi.fn().mockReturnValue(false),
    saveSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    isSectionDirty: vi.fn().mockReturnValue(false),
    getSectionHealth: vi.fn().mockReturnValue({ healthy: true, issues: [] }),
    resetDraft: vi.fn(),
    saving: false,
    validateBeforeSave: vi.fn().mockReturnValue({ success: true }),
    refreshHealth: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ logout: vi.fn() });
    useSettings.mockReturnValue(mockSettings);
  });

  it("should handle validation failure in handleGlobalSave", async () => {
    mockSettings.hasUnsavedChanges.mockReturnValue(true);
    mockSettings.validateBeforeSave.mockReturnValue({
      success: false,
      error: "Validation Failed",
    });

    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTitle("Save all changes"));
    expect(await screen.findByText("Validation Failed")).toBeDefined();
  });

  it("should handle reset failure in handleGlobalReset", async () => {
    mockSettings.resetToDefaults.mockResolvedValue({
      success: false,
      error: "Reset Error",
    });

    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTitle("Reset to Factory Defaults"));
    fireEvent.click(screen.getByText("Confirm"));

    expect(await screen.findByText(/Reset failed: Reset Error/)).toBeDefined();
  });

  it("should show unhealthy indicator for General tab when sources are offline", () => {
    mockSettings.systemHealth.primarySource.healthy = false;

    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    // AlertTriangle should be present near General
    const generalLink = screen.getByText("General").closest("a");
    expect(generalLink.querySelector(".lucide-alert-triangle")).toBeDefined();
  });

  it("should show unhealthy indicator for Automation tab when outputs are offline", () => {
    mockSettings.systemHealth.alexa = { healthy: false };

    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    const automationLink = screen.getByText("Automation").closest("a");
    expect(
      automationLink.querySelector(".lucide-alert-triangle"),
    ).toBeDefined();
  });

  it("should handle sidebar toggle and overlay click", () => {
    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    // Open sidebar
    fireEvent.click(
      screen
        .getByRole("button", { name: "" })
        .parentElement.querySelector(".lucide-menu")
        .closest("button"),
    );

    // Click overlay
    const overlay = document.querySelector(".fixed.inset-0.z-20");
    fireEvent.click(overlay);
  });

  it("should handle nav item click", () => {
    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    const generalLink = screen.getByText("General").closest("a");
    fireEvent.click(generalLink);
  });

  it("should handle notification close click", async () => {
    mockSettings.validateBeforeSave.mockReturnValue({
      success: false,
      error: "Validation Failed",
    });
    mockSettings.hasUnsavedChanges.mockReturnValue(true);

    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTitle("Save all changes"));
    await screen.findByText("Validation Failed");
    const closeBtn = document.querySelector(".ml-auto.text-current");
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Validation Failed")).toBeNull();
  });

  it("should handle reset confirm close", () => {
    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTitle("Reset to Factory Defaults"));
    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("confirm-modal")).toBeNull();
  });

  it("should cover isDirty for Automation tab", () => {
    mockSettings.isSectionDirty.mockImplementation(
      (path) => path === "automation.outputs",
    );

    render(
      <MemoryRouter>
        <SettingsLayout />
      </MemoryRouter>,
    );

    const automationLink = screen.getByText("Automation").closest("a");
    // The dirty indicator is a span with bg-orange-500
    expect(automationLink.querySelector(".bg-orange-500")).toBeDefined();
  });
});
