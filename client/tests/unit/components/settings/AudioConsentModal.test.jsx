import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AudioConsentModal from "../../../../src/components/settings/AudioConsentModal";

describe("AudioConsentModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    strategyLabel: "Test Speaker",
  };

  it("should return null if not open", () => {
    const { container } = render(
      <AudioConsentModal {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render label and message", () => {
    render(<AudioConsentModal {...defaultProps} />);
    expect(screen.getByText(/The output device/)).toBeDefined();
    expect(screen.getByText("Test Speaker")).toBeDefined();
  });

  it("should handle checkbox toggle", () => {
    render(<AudioConsentModal {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", { hidden: true });

    fireEvent.click(checkbox);
    // State is internal, we check result on confirm
  });

  it("should call onConfirm with dontAskAgain value", () => {
    const onConfirm = vi.fn();
    render(<AudioConsentModal {...defaultProps} onConfirm={onConfirm} />);

    // Toggle checkbox to true
    const checkbox = screen.getByRole("checkbox", { hidden: true });
    fireEvent.click(checkbox);

    const testButton = screen.getByText("Test Now");
    fireEvent.click(testButton);

    expect(onConfirm).toHaveBeenCalledWith(true);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onClose when cancel is clicked", () => {
    render(<AudioConsentModal {...defaultProps} />);
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onClose when X is clicked", () => {
    render(<AudioConsentModal {...defaultProps} />);
    const xButton = screen.getAllByRole("button")[0];
    fireEvent.click(xButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
