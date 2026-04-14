import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TriggerCard from "../../../../src/components/settings/TriggerCard";
import { useSettings } from "../../../../src/hooks/useSettings";

vi.mock("../../../../src/hooks/useSettings");
vi.mock("../../../../src/components/common/SearchableSelect", () => ({
  default: ({ placeholder, onChange, options }) => (
    <div data-testid="searchable-select">
      {placeholder}
      <button onClick={() => onChange(options[0]?.value)}>Select First</button>
    </div>
  ),
}));

describe("TriggerCard", () => {
  const onChange = vi.fn();
  const defaultProps = {
    label: "Test Trigger",
    trigger: {
      enabled: true,
      type: "file",
      path: "audio.mp3",
      targets: ["local"],
    },
    onChange,
    files: [{ name: "audio.mp3", path: "audio.mp3", type: "audio/mpeg" }],
    eventType: "adhan",
    strategies: [
      { id: "local", label: "Local" },
      {
        id: "voicemonkey",
        label: "Alexa",
        compatibilityKey: "alexaCompatible",
      },
    ],
  };

  const mockSettings = {
    systemHealth: { tts: { healthy: true }, local: { healthy: true } },
    config: {
      automation: {
        global: { enabled: true },
        outputs: { local: { enabled: true } },
      },
    },
    voices: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue(mockSettings);
  });

  it("should render correctly when enabled", () => {
    render(<TriggerCard {...defaultProps} />);
    expect(screen.getByText("Test Trigger")).toBeDefined();
    expect(screen.getByText("Audio Source")).toBeDefined();
  });

  it("should handle master switch disable (Global)", () => {
    useSettings.mockReturnValue({
      ...mockSettings,
      config: { automation: { global: { enabled: false } } },
    });
    render(<TriggerCard {...defaultProps} />);
    expect(screen.getByText("Disabled by Global Switch")).toBeDefined();
  });

  it("should handle master switch disable (Sub-system)", () => {
    useSettings.mockReturnValue({
      ...mockSettings,
      config: {
        automation: { global: { enabled: true, adhanEnabled: false } },
      },
    });
    render(<TriggerCard {...defaultProps} eventType="adhan" />);
    expect(screen.getByText("Disabled by Sub-System")).toBeDefined();
  });

  it("should toggle enabled state", () => {
    render(<TriggerCard {...defaultProps} />);
    const switchButton = screen.getByRole("switch");
    fireEvent.click(switchButton);
    expect(onChange).toHaveBeenCalledWith({
      ...defaultProps.trigger,
      enabled: false,
    });
  });

  it("should change type", () => {
    render(<TriggerCard {...defaultProps} />);
    fireEvent.click(screen.getByText("TTS"));
    expect(onChange).toHaveBeenCalledWith({
      ...defaultProps.trigger,
      type: "tts",
    });
  });

  it("should show offset input for pre-events", () => {
    render(<TriggerCard {...defaultProps} eventType="preAdhan" />);
    expect(screen.getByLabelText("Minutes Before")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Minutes Before"), {
      target: { value: "20" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultProps.trigger,
      offsetMinutes: 20,
    });
  });

  it("should show dirty indicator", () => {
    const { container } = render(
      <TriggerCard {...defaultProps} isDirty={true} />,
    );
    expect(container.querySelector(".bg-orange-500")).toBeDefined();
  });

  it("should show service warnings for disabled output", () => {
    useSettings.mockReturnValue({
      ...mockSettings,
      config: {
        automation: {
          global: { enabled: true },
          outputs: { local: { enabled: false } },
        },
      },
    });
    render(<TriggerCard {...defaultProps} />);
    expect(screen.getByText("Local Output Disabled")).toBeDefined();
  });

  it("should show service warnings for offline output", () => {
    useSettings.mockReturnValue({
      ...mockSettings,
      systemHealth: { local: { healthy: false, message: "Bad Connection" } },
    });
    render(<TriggerCard {...defaultProps} />);
    expect(
      screen.getByText("Local Output Offline: Bad Connection"),
    ).toBeDefined();
  });

  it("should show warning for incompatible file", () => {
    const props = {
      ...defaultProps,
      trigger: {
        ...defaultProps.trigger,
        type: "file",
        path: "bad.mp3",
        targets: ["voicemonkey"],
      },
      files: [
        {
          name: "bad.mp3",
          path: "bad.mp3",
          alexaCompatible: false,
          alexaIssues: ["Low Bitrate"],
        },
      ],
    };
    render(<TriggerCard {...props} />);
    expect(screen.getByText("Alexa Incompatible: Low Bitrate")).toBeDefined();
  });

  it("should toggle targets", () => {
    render(<TriggerCard {...defaultProps} />);
    const alexaLabel = screen.getByText("Alexa");
    fireEvent.click(alexaLabel);
    expect(onChange).toHaveBeenCalledWith({
      ...defaultProps.trigger,
      targets: ["local", "voicemonkey"],
    });

    const localLabel = screen.getByText("Local");
    fireEvent.click(localLabel);
    expect(onChange).toHaveBeenCalledWith({
      ...defaultProps.trigger,
      targets: [],
    });
  });

  it("should render extra content", () => {
    render(
      <TriggerCard
        {...defaultProps}
        extraContent={<div data-testid="extra">Extra</div>}
      />,
    );
    expect(screen.getByTestId("extra")).toBeDefined();
  });

  it("should handle TTS inputs", () => {
    const props = {
      ...defaultProps,
      trigger: { enabled: true, type: "tts", template: "Hello" },
    };
    render(<TriggerCard {...props} />);
    const input = screen.getByPlaceholderText(/TTS Template String/);
    fireEvent.change(input, { target: { value: "New Template" } });
    expect(onChange).toHaveBeenCalledWith({
      ...props.trigger,
      template: "New Template",
    });
  });

  it("should handle URL input", () => {
    const props = {
      ...defaultProps,
      trigger: { enabled: true, type: "url", url: "http://" },
    };
    render(<TriggerCard {...props} />);
    const input = screen.getByPlaceholderText("https://...");
    fireEvent.change(input, { target: { value: "https://test.mp3" } });
    expect(onChange).toHaveBeenCalledWith({
      ...props.trigger,
      url: "https://test.mp3",
    });
  });

  it("should handle invalid offset input", () => {
    render(<TriggerCard {...defaultProps} eventType="preAdhan" />);
    const input = screen.getByLabelText("Minutes Before");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultProps.trigger,
      offsetMinutes: 15,
    });
  });

  it("should display character counter for TTS input", () => {
    const props = {
      ...defaultProps,
      trigger: { enabled: true, type: "tts", template: "Hello" },
    };
    render(<TriggerCard {...props} />);
    expect(screen.getByText("5/50")).toBeDefined();
  });

  it("should enforce maxLength on TTS input", () => {
    const props = {
      ...defaultProps,
      trigger: { enabled: true, type: "tts", template: "" },
    };
    render(<TriggerCard {...props} />);
    const input = screen.getByPlaceholderText(/TTS Template String/);
    expect(input.maxLength).toBe(50);
  });
});
