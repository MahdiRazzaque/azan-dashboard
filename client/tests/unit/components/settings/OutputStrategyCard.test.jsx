import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OutputStrategyCard from "../../../../src/components/settings/OutputStrategyCard";

vi.mock("../../../../src/components/settings/AudioConsentModal", () => ({
  default: ({ isOpen, onConfirm }) =>
    isOpen ? (
      <div data-testid="consent-modal">
        <button onClick={() => onConfirm(true)}>Confirm</button>
      </div>
    ) : null,
}));

describe("OutputStrategyCard", () => {
  const onChange = vi.fn();
  const strategy = {
    id: "local",
    label: "Local Speaker",
    params: [
      { key: "device", label: "Device", type: "text", default: "hw:0,0" },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        options: ["High", "Low"],
      },
    ],
    defaultLeadTimeMs: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render correctly", () => {
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ enabled: true }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Local Speaker")).toBeDefined();
  });

  it("should handle toggle", () => {
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ enabled: true }}
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("enabled", false);
  });

  it("should handle lead time adjustment with snapping", () => {
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ enabled: true, leadTimeMs: 0 }}
        onChange={onChange}
      />,
    );
    const slider = screen.getByRole("slider");

    fireEvent.change(slider, { target: { value: "700" } });
    expect(onChange).toHaveBeenCalledWith("leadTimeMs", 0);

    fireEvent.change(slider, { target: { value: "1200" } });
    expect(onChange).toHaveBeenCalledWith("leadTimeMs", 1200);
  });

  it("should handle parameter changes", () => {
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ params: { device: "old-device" } }}
        onChange={onChange}
      />,
    );
    const input = screen.getByDisplayValue("old-device");
    fireEvent.change(input, { target: { value: "new-device" } });
    expect(onChange).toHaveBeenCalledWith("params", { device: "new-device" });
  });

  it("should handle health check returning unhealthy without message", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ local: { healthy: false } }), // No message
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ enabled: true }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Check Health"));
    await waitFor(() => expect(screen.getByText("Offline")).toBeDefined());
  });

  it("should handle health check returning unhealthy with message", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ local: { healthy: false, message: "Device Error" } }),
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Check Health"));
    await waitFor(() => expect(screen.getByText("Offline")).toBeDefined());
  });

  it("should handle fetch exception in health check", async () => {
    fetch.mockRejectedValueOnce(new Error("Network Fail"));
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Check Health"));
    await waitFor(() => expect(screen.getByText("Offline")).toBeDefined());
  });

  it("should handle successful health check", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ local: { healthy: true } }),
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Check Health"));
    expect(screen.getByText("Checking...")).toBeDefined();

    await waitFor(() => expect(screen.getByText("Online")).toBeDefined());
  });

  it("should handle health check with no data for target", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}), // Empty response
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Check Health"));
    await waitFor(() => expect(screen.getByText("Offline")).toBeDefined());
  });

  it("should handle health check json parse error", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error("Parse Fail")),
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Check Health"));
    await waitFor(() => expect(screen.getByText("Offline")).toBeDefined());
  });

  it("should handle audio test flow", async () => {
    fetch.mockResolvedValue({ ok: true });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Test Audio"));
    const modal = screen.queryByTestId("consent-modal");
    if (modal) {
      fireEvent.click(screen.getByText("Confirm"));
    }

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.any(Object),
      ),
    );
  });

  it("should handle missing systemHealth in sync", () => {
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ enabled: true }}
        systemHealth={null}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Local Speaker")).toBeDefined();
  });

  it("should show correct lead time labels and styles", () => {
    const { rerender } = render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ leadTimeMs: 5000 }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("+5.0s")).toBeDefined();
    expect(screen.getByText("+5.0s").className).toContain("text-emerald-400");

    rerender(
      <OutputStrategyCard
        strategy={strategy}
        config={{ leadTimeMs: -5000 }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("-5.0s")).toBeDefined();
    expect(screen.getByText("-5.0s").className).toContain("text-amber-400");

    rerender(
      <OutputStrategyCard
        strategy={strategy}
        config={{ leadTimeMs: 0 }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Synchronised")).toBeDefined();
  });

  it("should handle missing target in systemHealth in sync", () => {
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{ enabled: true }}
        systemHealth={{ other: {} }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Local Speaker")).toBeDefined();
  });

  it("should handle audio test failure with message field", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: "Specific Message" }),
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Test Audio"));
    const modal = screen.queryByTestId("consent-modal");
    if (modal) fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("should handle audio test failure without any message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });
    render(
      <OutputStrategyCard
        strategy={strategy}
        config={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Test Audio"));
    const modal = screen.queryByTestId("consent-modal");
    if (modal) fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it("should return null if hidden", () => {
    const hiddenStrategy = { ...strategy, hidden: true };
    const { container } = render(
      <OutputStrategyCard
        strategy={hiddenStrategy}
        config={{}}
        onChange={onChange}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
