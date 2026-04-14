import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DynamicField from "../../../../src/components/settings/DynamicField";

describe("DynamicField", () => {
  let onChange;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("should render text input by default", () => {
    const param = {
      type: "text",
      label: "Name",
      placeholder: "Enter name",
      description: "Your name",
    };
    render(<DynamicField param={param} value="" onChange={onChange} />);

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Your name")).toBeDefined();
    const input = screen.getByPlaceholderText("Enter name");
    expect(input.getAttribute("type")).toBe("text");

    fireEvent.change(input, { target: { value: "John" } });
    expect(onChange).toHaveBeenCalledWith("John");
  });

  it("should render number input", () => {
    const param = {
      type: "number",
      label: "Age",
      placeholder: "0",
      constraints: { min: 0, max: 100 },
    };
    render(<DynamicField param={param} value={25} onChange={onChange} />);

    const input = screen.getByPlaceholderText("0");
    expect(input.getAttribute("type")).toBe("number");
    expect(input.getAttribute("min")).toBe("0");
    expect(input.getAttribute("max")).toBe("100");

    fireEvent.change(input, { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it("should render select input", () => {
    const param = {
      type: "select",
      label: "Color",
      constraints: {
        options: [
          { id: "r", label: "Red" },
          { id: "g", label: "Green" },
        ],
      },
    };
    render(<DynamicField param={param} value="r" onChange={onChange} />);

    const select = screen.getByRole("combobox");
    expect(select.value).toBe("r");

    fireEvent.change(select, { target: { value: "g" } });
    expect(onChange).toHaveBeenCalledWith("g");
  });

  it("should render password input with toggle", () => {
    const param = { type: "password", label: "Secret", placeholder: "***" };
    render(<DynamicField param={param} value="pass" onChange={onChange} />);

    const input = screen.getByPlaceholderText("***");
    expect(input.getAttribute("type")).toBe("password");

    const toggleButton = screen.getByRole("button");
    fireEvent.click(toggleButton);
    expect(input.getAttribute("type")).toBe("text");

    fireEvent.click(toggleButton);
    expect(input.getAttribute("type")).toBe("password");
  });

  it("should validate required fields", () => {
    const param = {
      type: "text",
      label: "Req",
      constraints: { required: true },
    };
    render(<DynamicField param={param} value="val" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Req is required")).toBeDefined();
  });

  it("should validate pattern constraints", () => {
    const param = {
      type: "text",
      label: "Pat",
      constraints: { pattern: "^[0-9]+$" },
    };
    render(<DynamicField param={param} value="123" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByText("Invalid Pat format")).toBeDefined();
  });

  it("should handle undefined value", () => {
    const param = { type: "text", label: "Name" };
    render(
      <DynamicField param={param} value={undefined} onChange={onChange} />,
    );
    const input = screen.getByRole("textbox");
    expect(input.value).toBe("");
  });
});
