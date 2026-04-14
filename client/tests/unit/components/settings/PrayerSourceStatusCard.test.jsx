import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PrayerSourceStatusCard from "../../../../src/components/settings/PrayerSourceStatusCard";
import { useSettings } from "../../../../src/hooks/useSettings";
import { useProviders } from "../../../../src/hooks/useProviders";

vi.mock("../../../../src/hooks/useSettings");
vi.mock("../../../../src/hooks/useProviders");

describe("PrayerSourceStatusCard", () => {
  const refreshHealth = vi.fn();
  const mockProviders = [
    {
      id: "aladhan",
      label: "Aladhan",
      branding: { icon: "Globe", accentColor: "blue" },
    },
    {
      id: "mymasjid",
      label: "MyMasjid",
      branding: { icon: "Database", accentColor: "emerald" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({ systemHealth: {}, refreshHealth });
    useProviders.mockReturnValue({ providers: mockProviders });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url) => {
        if (url === "/api/prayers")
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ meta: { source: "Aladhan" } }),
          });
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

  it("should render correctly and fetch active source", async () => {
    render(
      <PrayerSourceStatusCard
        config={{ sources: { primary: { type: "aladhan" } } }}
      />,
    );
    expect(screen.getByText("Prayer Source Status")).toBeDefined();
    await waitFor(() => expect(screen.getByText("Aladhan")).toBeDefined());
  });

  it("should handle connectivity test success", async () => {
    render(
      <PrayerSourceStatusCard
        config={{ sources: { primary: { type: "aladhan" } } }}
      />,
    );
    await waitFor(() => screen.getByText("Aladhan"));

    const testButton = screen.getAllByText("Test Connectivity")[0];
    fireEvent.click(testButton);

    await waitFor(() =>
      expect(screen.getByText("Connection Success")).toBeDefined(),
    );
    expect(refreshHealth).toHaveBeenCalledWith("primarySource");
  });

  it("should handle connectivity test failure", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/prayers")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ meta: { source: "Aladhan" } }),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: false, message: "Rejected" }),
      });
    });
    render(
      <PrayerSourceStatusCard
        config={{ sources: { primary: { type: "aladhan" } } }}
      />,
    );
    await waitFor(() => screen.getByText("Aladhan"));

    fireEvent.click(screen.getAllByText("Test Connectivity")[0]);
    await waitFor(() => expect(screen.getByText("Rejected")).toBeDefined());
  });

  it("should detect cache fallback", async () => {
    useSettings.mockReturnValue({
      systemHealth: {
        primarySource: { healthy: false },
        backupSource: { healthy: false },
      },
      refreshHealth,
    });
    render(
      <PrayerSourceStatusCard
        config={{
          sources: {
            primary: { type: "aladhan" },
            backup: { type: "mymasjid", enabled: true },
          },
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Dashboard Cache")).toBeDefined(),
    );
  });

  it("should handle fetch exception in connectivity test", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/prayers")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ meta: { source: "Aladhan" } }),
        });
      return Promise.reject(new Error("Network Fail"));
    });
    render(
      <PrayerSourceStatusCard
        config={{ sources: { primary: { type: "aladhan" } } }}
      />,
    );
    await waitFor(() => screen.getByText("Aladhan"));

    fireEvent.click(screen.getAllByText("Test Connectivity")[0]);
    await waitFor(() => expect(screen.getByText("Network Fail")).toBeDefined());
  });
});
