import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  AutomationStatusCell,
  TTSStatusCell,
} from "../../../../../src/components/settings/developer/StatusCells";

describe("StatusCells", () => {
  describe("AutomationStatusCell", () => {
    it("should render PASSED status with time", () => {
      const time = new Date("2026-01-30T10:00:00Z").getTime();
      render(<AutomationStatusCell status="PASSED" time={time} />);
      // toLocaleTimeString format depends on environment, but we check if it's not 'Done'
      expect(screen.queryByText("Done")).toBeNull();
    });

    it("should render PASSED status without time", () => {
      render(<AutomationStatusCell status="PASSED" />);
      expect(screen.getByText("Done")).toBeDefined();
    });

    it("should render UPCOMING status with time", () => {
      const time = new Date("2026-01-30T10:00:00Z").getTime();
      render(<AutomationStatusCell status="UPCOMING" time={time} />);
      expect(screen.queryByText("Pending")).toBeNull();
    });

    it("should render UPCOMING status without time", () => {
      render(<AutomationStatusCell status="UPCOMING" />);
      expect(screen.getByText("Pending")).toBeDefined();
    });

    it("should render default status", () => {
      render(<AutomationStatusCell status="UNKNOWN" />);
      expect(screen.getByText("UNKNOWN")).toBeDefined();
    });

    it("should show details in title", () => {
      const details = { type: "tts", source: "azure", targets: "browser" };
      const { container } = render(
        <AutomationStatusCell status="PASSED" details={details} />,
      );
      const div = container.firstChild;
      expect(div.getAttribute("title")).toContain("Type: tts");
      expect(div.getAttribute("title")).toContain("Source: azure");
      expect(div.getAttribute("title")).toContain("Targets: browser");
    });
  });

  describe("TTSStatusCell", () => {
    it("should render GENERATED status with detail", () => {
      const detail = new Date().toISOString();
      render(<TTSStatusCell status="GENERATED" detail={detail} />);
      expect(screen.getByText("Ready")).toBeDefined();
    });

    it("should render GENERATED status without detail", () => {
      render(<TTSStatusCell status="GENERATED" />);
      expect(screen.getByText("Ready")).toBeDefined();
    });

    it("should render MISMATCH status", () => {
      render(<TTSStatusCell status="MISMATCH" />);
      expect(screen.getByText("Mismatch")).toBeDefined();
    });

    it("should render MISSING status", () => {
      const { container } = render(<TTSStatusCell status="MISSING" />);
      expect(screen.getByText("MISSING")).toBeDefined();
      expect(container.firstChild.className).toContain("text-red-400");
    });

    it("should render ERROR status", () => {
      const { container } = render(<TTSStatusCell status="ERROR" />);
      expect(screen.getByText("ERROR")).toBeDefined();
      expect(container.firstChild.className).toContain("text-red-400");
    });

    it("should render CUSTOM_FILE status", () => {
      render(<TTSStatusCell status="CUSTOM_FILE" />);
      expect(screen.getByText("File")).toBeDefined();
    });

    it("should render URL status", () => {
      render(<TTSStatusCell status="URL" />);
      expect(screen.getByText("URL")).toBeDefined();
    });

    it("should render default status", () => {
      render(<TTSStatusCell status="UNKNOWN" />);
      expect(screen.getByText("UNKNOWN")).toBeDefined();
    });
  });
});
