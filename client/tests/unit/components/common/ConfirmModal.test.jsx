import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConfirmModal from "../../../../src/components/common/ConfirmModal";

describe("ConfirmModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    title: "Test Title",
    message: "Test Message",
  };

  it("should return null if not open", () => {
    const { container } = render(
      <ConfirmModal {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render title and message when open", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByText("Test Message")).toBeDefined();
  });

  it("should call onClose when backdrop is clicked (using selector)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ConfirmModal {...defaultProps} onClose={onClose} />,
    );
    // The backdrop is the first child of the outer div
    const backdrop = container.querySelector(".fixed > div:first-child");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    const buttons = screen.getAllByRole("button");
    // X button is the first one (absolute top-4 right-4)
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onConfirm and onClose when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onConfirm={onConfirm}
        onClose={onClose}
        confirmText="Yes"
      />,
    );
    const confirmButton = screen.getByText("Yes");
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal {...defaultProps} onCancel={onCancel} cancelText="No" />,
    );
    const cancelButton = screen.getByText("No");
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalled();
  });

  it("should call onClose when cancel button is clicked and onCancel is not provided", () => {
    const onClose = vi.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onCancel={undefined}
        onClose={onClose}
        cancelText="No"
      />,
    );
    const cancelButton = screen.getByText("No");
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("should render retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<ConfirmModal {...defaultProps} onRetry={onRetry} />);
    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it("should use retryText if provided", () => {
    render(
      <ConfirmModal
        {...defaultProps}
        onRetry={vi.fn()}
        retryText="Try Again"
      />,
    );
    expect(screen.getByText("Try Again")).toBeDefined();
  });

  it("should apply destructive styles when isDestructive is true", () => {
    render(<ConfirmModal {...defaultProps} isDestructive={true} />);
    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton.className).toContain("bg-red-600");
  });

  it("should apply non-destructive styles by default", () => {
    render(<ConfirmModal {...defaultProps} />);
    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton.className).toContain("bg-emerald-600");
  });
});
