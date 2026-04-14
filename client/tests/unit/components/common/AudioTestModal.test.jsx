import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AudioTestModal from "../../../../src/components/common/AudioTestModal";
import { useSettings } from "../../../../src/hooks/useSettings";

vi.mock("../../../../src/hooks/useSettings");

describe("AudioTestModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    file: { name: "test.mp3" },
    consentGiven: false,
    setConsentGiven: vi.fn(),
    onTest: vi.fn(),
  };

  const mockStrategies = [
    { id: "browser", label: "Browser", hidden: false },
    { id: "local", label: "Local Speaker", hidden: false },
    { id: "voicemonkey", label: "Alexa", hidden: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      systemHealth: {
        local: { healthy: true },
        voicemonkey: { healthy: false, message: "Offline" },
      },
      config: {
        automation: {
          outputs: {
            local: { enabled: true },
            voicemonkey: { enabled: true },
          },
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStrategies),
      }),
    );
  });

  it("should return null if not open or no file", () => {
    const { container, rerender } = render(
      <AudioTestModal {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toBeNull();

    rerender(<AudioTestModal {...defaultProps} file={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should fetch and render strategies", async () => {
    render(<AudioTestModal {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText("All Dashboards")).toBeDefined(),
    );
    expect(screen.getByText("Local Speaker")).toBeDefined();
    expect(screen.getByText("Alexa")).toBeDefined();
  });

  it("should handle fetch error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: false });
    render(<AudioTestModal {...defaultProps} />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    // Should still render (with empty targets except browser if we coded it so, but here strategies is state)
    consoleSpy.mockRestore();
  });

  it("should toggle consent", () => {
    const setConsentGiven = vi.fn();
    render(
      <AudioTestModal {...defaultProps} setConsentGiven={setConsentGiven} />,
    );
    const checkbox = screen.getByRole("checkbox", { hidden: true });

    fireEvent.click(checkbox);
    expect(setConsentGiven).toHaveBeenCalledWith(true);
  });

  it("should disable test buttons if consent not given", async () => {
    render(<AudioTestModal {...defaultProps} consentGiven={false} />);
    await waitFor(() => screen.getByText("All Dashboards"));

    const browserButton = screen.getByText("All Dashboards").closest("button");
    expect(browserButton.disabled).toBe(true);
  });

  it("should enable test buttons if consent given", async () => {
    render(<AudioTestModal {...defaultProps} consentGiven={true} />);
    await waitFor(() => screen.getByText("All Dashboards"));

    const browserButton = screen.getByText("All Dashboards").closest("button");
    expect(browserButton.disabled).toBe(false);

    fireEvent.click(browserButton);
    expect(defaultProps.onTest).toHaveBeenCalledWith("browser");
  });

  it("should disable unhealthy or disabled targets", async () => {
    useSettings.mockReturnValue({
      systemHealth: {
        local: { healthy: true },
        voicemonkey: { healthy: false },
      },
      config: {
        automation: {
          outputs: {
            local: { enabled: false },
            voicemonkey: { enabled: true },
          },
        },
      },
    });
    render(<AudioTestModal {...defaultProps} consentGiven={true} />);
    await waitFor(() => screen.getByText("Alexa"));

    const localButton = screen.getByText("Local Speaker").closest("button");
    expect(localButton.disabled).toBe(true);
    expect(
      screen.getByText("This output is disabled in settings"),
    ).toBeDefined();

    const alexaButton = screen.getByText("Alexa").closest("button");
    expect(alexaButton.disabled).toBe(true);
    expect(screen.getByText(/Offline: Service unreachable/)).toBeDefined();
  });

  it("should render healthy and enabled non-browser targets", async () => {
    useSettings.mockReturnValue({
      systemHealth: { local: { healthy: true } },
      config: { automation: { outputs: { local: { enabled: true } } } },
    });
    render(<AudioTestModal {...defaultProps} consentGiven={true} />);
    await waitFor(() => screen.getByText("Local Speaker"));

    const localButton = screen.getByText("Local Speaker").closest("button");
    expect(localButton.disabled).toBe(false);
    expect(
      screen.getByText("Plays on the mosque local audio system"),
    ).toBeDefined();
  });

  it("should handle hidden strategies by filtering them out", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "browser", label: "Browser", hidden: false },
          { id: "hidden-one", label: "Hidden", hidden: true },
        ]),
    });
    render(<AudioTestModal {...defaultProps} />);
    await waitFor(() => screen.getByText("All Dashboards"));
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("should call onClose when close buttons are clicked", () => {
    render(<AudioTestModal {...defaultProps} />);
    const xButton = screen.getAllByRole("button")[0]; // X button in header
    fireEvent.click(xButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });
});
