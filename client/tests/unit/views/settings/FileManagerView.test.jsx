import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FileManagerView from "../../../../src/views/settings/FileManagerView";
import { useSettings } from "../../../../src/hooks/useSettings";

vi.mock("../../../../src/hooks/useSettings");
vi.mock("../../../../src/components/common/AudioTestModal", () => ({
  default: ({ isOpen, onTest, onClose }) =>
    isOpen ? (
      <div data-testid="test-modal">
        <button onClick={() => onTest("local")}>Test</button>
      </div>
    ) : null,
}));
vi.mock("../../../../src/components/common/ConfirmModal", () => ({
  default: ({ isOpen, onConfirm, onCancel, title }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        {title}
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

describe("FileManagerView Final Push Fix v2", () => {
  const mockFiles = [
    {
      name: "custom1.mp3",
      path: "custom/1.mp3",
      url: "/url/1",
      type: "custom",
      metadata: { protected: false },
    },
    {
      name: "protected.mp3",
      path: "custom/prot.mp3",
      url: "/url/prot",
      type: "custom",
      metadata: { protected: true },
    },
    {
      name: "tts_fajr_adhan.mp3",
      path: "cache/fajr.mp3",
      url: "/url/fajr",
      type: "cache",
    },
    {
      name: "other.mp3",
      path: "cache/other.mp3",
      url: "/url/other",
      type: "cache",
    },
  ];

  let mockAudio;

  const mockResponse = (data, ok = true, status = 200) => ({
    ok,
    status,
    json: () => Promise.resolve(data),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.mockReturnValue({
      systemHealth: {},
      config: { automation: { baseUrl: "http://base" } },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (url === "/api/system/audio-files")
          return mockResponse({
            files: mockFiles,
            total: mockFiles.length,
            page: 1,
            limit: 50,
            totalPages: 1,
          });
        if (url === "/api/system/outputs/registry") return mockResponse([]);
        return mockResponse({ success: true });
      }),
    );

    mockAudio = {
      play: vi.fn().mockResolvedValue(),
      pause: vi.fn(),
      src: "",
      onended: null,
    };
    vi.stubGlobal(
      "Audio",
      vi.fn().mockImplementation(function () {
        return mockAudio;
      }),
    );
  });

  it("should cover all branches and functions including errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FileManagerView />);
    await screen.findByText("custom1.mp3");

    // 1. toggleSection
    const fajrHeading = screen.getByRole("heading", { name: /fajr/i });
    fireEvent.click(fajrHeading);

    // 2. Play branches
    const playBtn = screen.getAllByTitle("Preview in Browser")[0];
    await act(async () => {
      fireEvent.click(playBtn);
    });
    await act(async () => {
      fireEvent.click(playBtn);
    }); // toggle off

    mockAudio.play.mockRejectedValueOnce(new Error("P"));
    await act(async () => {
      fireEvent.click(playBtn);
    }); // toggle on and fail

    // 3. Server Play
    const testBtn = screen.getAllByTitle("Test on Speakers")[0];
    fireEvent.click(testBtn);
    fireEvent.click(screen.getByText("Test"));

    // 4. Upload & Overwrite
    const input = document.getElementById("audio-upload");
    fireEvent.change(input, {
      target: { files: [new File([""], "new.mp3", { type: "audio/mpeg" })] },
    });
    fireEvent.change(input, {
      target: {
        files: [new File([""], "custom1.mp3", { type: "audio/mpeg" })],
      },
    });
    fireEvent.click(screen.getByText("Confirm"));

    // 5. Delete
    fireEvent.click(screen.getAllByTitle("Delete File")[0]);
    fireEvent.click(screen.getByText("Confirm"));

    // 6. Errors
    fetch.mockImplementationOnce(async () => ({
      ok: false,
      status: 413,
      json: () => Promise.reject(),
    }));
    fireEvent.change(input, {
      target: { files: [new File([""], "err.mp3", { type: "audio/mpeg" })] },
    });

    // 7. Info Panel & Revalidate
    const infoBtn = screen.getAllByTitle("View Compatibility")[0];
    fireEvent.click(infoBtn);
    expect(screen.getByText("Compatibility Analysis")).toBeDefined();

    const revalidateBtn = screen.getByText("Revalidate");
    await act(async () => {
      fireEvent.click(revalidateBtn);
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/settings/files/revalidate",
      expect.any(Object),
    );

    consoleSpy.mockRestore();
  });
});
