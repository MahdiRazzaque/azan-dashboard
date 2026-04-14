import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import StorageManagementCard from "../../../../../src/components/settings/developer/StorageManagementCard";
import { useSettings } from "../../../../../src/hooks/useSettings";

vi.mock("../../../../../src/hooks/useSettings");

describe("StorageManagementCard", () => {
  const updateSetting = vi.fn();
  const saveSettings = vi.fn();
  const config = { data: { storageLimit: 1.5 } };
  const mockStorage = {
    usedBytes: 50 * 1024 * 1024,
    limitBytes: 100 * 1024 * 1024,
    systemFreeBytes: 10 * 1024 * 1024 * 1024,
    recommendedLimitGB: 5.0,
    breakdown: { custom: 20 * 1024 * 1024, cache: 30 * 1024 * 1024 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      draftConfig: null,
      updateSetting,
      saveSettings,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStorage),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should show loading state initially", () => {
    render(<StorageManagementCard config={config} />);
    expect(screen.getByText(/Loading Storage Stats/)).toBeDefined();
  });

  it("should render storage stats after loading", async () => {
    render(<StorageManagementCard config={config} />);
    await waitFor(() =>
      expect(screen.getByText(/50.0 MB \/ 100 MB/)).toBeDefined(),
    );
    expect(screen.getByText(/50.0% USED/)).toBeDefined();
    expect(screen.getByText(/Disk Free: 10.0 GB/)).toBeDefined();
  });

  it("should handle successful save", async () => {
    saveSettings.mockResolvedValue({ success: true });
    render(<StorageManagementCard config={config} />);

    await waitFor(() => screen.getByDisplayValue("1.5"));
    const input = screen.getByRole("spinbutton");
    const saveButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));

    fireEvent.change(input, { target: { value: "2.0" } });
    fireEvent.click(saveButton);

    expect(updateSetting).toHaveBeenCalledWith("data.storageLimit", 2);
    await waitFor(() =>
      expect(screen.getByText("Limit updated")).toBeDefined(),
    );
  });

  it("should handle invalid limit input", async () => {
    render(<StorageManagementCard config={config} />);
    await waitFor(() => screen.getByDisplayValue("1.5"));

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "0.05" } });

    const saveButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-save"));
    fireEvent.click(saveButton);

    expect(screen.getByText("Invalid limit")).toBeDefined();
  });

  it("should show amber color for high usage", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ ...mockStorage, usedBytes: 80 * 1024 * 1024 }),
    });
    render(<StorageManagementCard config={config} />);
    await waitFor(() => expect(screen.getByText(/80.0% USED/)).toBeDefined());
    expect(screen.getByText(/80.0% USED/).className).toContain("amber");
  });

  it("should show red color for critical usage", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ ...mockStorage, usedBytes: 95 * 1024 * 1024 }),
    });
    render(<StorageManagementCard config={config} />);
    await waitFor(() => expect(screen.getByText(/95.0% USED/)).toBeDefined());
    expect(screen.getByText(/95.0% USED/).className).toContain("red");
  });
});
