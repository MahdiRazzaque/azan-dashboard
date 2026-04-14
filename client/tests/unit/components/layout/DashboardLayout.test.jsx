import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardLayout from "../../../../src/components/layout/DashboardLayout";

describe("DashboardLayout", () => {
  it("should render children correctly", () => {
    render(
      <DashboardLayout>
        <div data-testid="child">Child Content</div>
      </DashboardLayout>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("Child Content")).toBeDefined();
  });

  it("should have the correct container classes", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>,
    );
    const div = container.firstChild;
    expect(div.className).toContain("flex-col-reverse");
    expect(div.className).toContain("lg:grid-cols-2");
  });
});
