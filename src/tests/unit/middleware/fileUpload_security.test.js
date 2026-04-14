const path = require("path");
const upload = require("@middleware/fileUpload");

describe("FileUpload Security", () => {
  describe("DiskStorage Sanitisation", () => {
    it("should sanitise filenames containing path traversal sequences", () => {
      const req = {};
      const file = { originalname: "../../etc/passwd.mp3" };
      const cb = jest.fn();

      upload.storage.getFilename(req, file, cb);

      // It should NOT be the original name if it contains traversal sequences
      const resultFilename = cb.mock.calls[0][1];
      expect(resultFilename).not.toContain("..");
      expect(resultFilename).not.toContain("/");
      expect(resultFilename).not.toContain("\\");
      expect(resultFilename).toBe("passwd.mp3");
    });

    it("should replace spaces and special characters with underscores", () => {
      const req = {};
      const file = { originalname: "my azan file!.mp3" };
      const cb = jest.fn();

      upload.storage.getFilename(req, file, cb);

      const resultFilename = cb.mock.calls[0][1];
      expect(resultFilename).toBe("my_azan_file_.mp3");
    });
  });
});
