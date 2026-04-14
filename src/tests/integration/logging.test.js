const fs = require("fs/promises");
const path = require("path");
const sseService = require("@services/system/sseService");
const logger = require("@utils/logger");

describe("Logging Integration", () => {
  const logDir = logger.LOG_DIR;

  beforeEach(async () => {
    // Cleanup log dir
    try {
      const files = await fs.readdir(logDir);
      for (const file of files) {
        await fs.unlink(path.join(logDir, file));
      }
    } catch (e) {}
  });

  it("should create a log file when logging", async () => {
    sseService.log("Test message", "info");

    // Wait a bit for file I/O
    await new Promise((resolve) => setTimeout(resolve, 100));

    const files = await fs.readdir(logDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^session-\d{4}-\d{2}-\d{2}\.log$/);

    const content = await fs.readFile(path.join(logDir, files[0]), "utf8");
    expect(content).toContain("[INFO] Test message");
  });

  it("should rotate logs and keep only max 10 files", async () => {
    // Manually create 12 log files
    for (let i = 1; i <= 12; i++) {
      const date = `2020-01-${i.toString().padStart(2, "0")}`;
      const filePath = path.join(logDir, `session-${date}.log`);
      await fs.writeFile(filePath, "old log content");
      // Ensure different mtimes
      const time =
        new Date(
          `2020-01-${i.toString().padStart(2, "0")}T12:00:00Z`,
        ).getTime() / 1000;
      const utimes = require("fs").utimesSync;
      utimes(filePath, time, time);
    }

    let files = await fs.readdir(logDir);
    expect(files.length).toBe(12);

    await logger.rotateLogs();

    files = await fs.readdir(logDir);
    expect(files.length).toBe(10);

    // Should keep the newest ones (12, 11, 10, 9, 8, 7, 6, 5, 4, 3)
    expect(files).not.toContain("session-2020-01-01.log");
    expect(files).not.toContain("session-2020-01-02.log");
    expect(files).toContain("session-2020-01-12.log");
  });
});
