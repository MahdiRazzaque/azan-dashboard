const fs = require("fs").promises;
const path = require("path");
const checkDiskSpace = require("check-disk-space").default;
const configService = require("@config");

const AUDIO_DIR = path.join(__dirname, "../../../public/audio");
const CUSTOM_DIR = path.join(AUDIO_DIR, "custom");
const CACHE_DIR = path.join(AUDIO_DIR, "cache");

/**
 * Service for managing storage usage and quotas.
 */
const storageService = {
  /**
   * Recursively calculates the size of a directory in bytes.
   * Uses fs.lstat to avoid following symlinks, which prevents infinite recursion.
   *
   * @param {string} dirPath - The absolute path to the directory.
   * @param {Set<string>} [visitedPaths=new Set()] - A set of resolved paths already visited to prevent cycles.
   * @returns {Promise<number>} A promise resolving to the total size of the directory in bytes.
   */
  async getDirSize(dirPath, visitedPaths = new Set()) {
    let size = 0;
    // nosemgrep: path-join-resolve-traversal -- dirPath is a constant (CUSTOM_DIR/CACHE_DIR), not user input
    const realPath = path.resolve(dirPath);
    if (visitedPaths.has(realPath)) return 0;
    visitedPaths.add(realPath);

    try {
      await fs.access(dirPath);

      const files = await fs.readdir(dirPath);
      for (const file of files) {
        // nosemgrep: path-join-resolve-traversal -- dirPath is a constant and file comes from fs.readdir(), not user input
        const filePath = path.join(dirPath, file);
        try {
          const stats = await fs.lstat(filePath);
          if (stats.isSymbolicLink()) {
            continue; // Skip symlinks to avoid cross-device/circular issues
          }
          if (stats.isDirectory()) {
            size += await this.getDirSize(filePath, visitedPaths);
          } else {
            size += stats.size;
          }
        } catch (statError) {
          // nosemgrep: unsafe-formatstring -- filePath is derived from internal constants + fs.readdir(), not user HTTP input
          console.warn(
            `[StorageService] Could not lstat file: ${filePath}`,
            statError.message,
          );
        }
      }
    } catch (dirError) {
      // Only log error if it's not a 'file not found' error
      if (dirError.code !== "ENOENT" && dirError.message !== "ENOENT") {
        // nosemgrep: unsafe-formatstring -- dirPath is a constant (CUSTOM_DIR/CACHE_DIR), not user input
        console.error(
          `[StorageService] Error reading directory: ${dirPath}`,
          dirError.message,
        );
      }
    }
    return size;
  },

  /**
   * Retrieves the current audio storage usage breakdown.
   *
   * @returns {Promise<{total: number, custom: number, cache: number}>} A promise resolving to usage statistics in bytes.
   */
  async getUsage() {
    const [customSize, cacheSize] = await Promise.all([
      this.getDirSize(CUSTOM_DIR),
      this.getDirSize(CACHE_DIR),
    ]);

    return {
      total: customSize + cacheSize,
      custom: customSize,
      cache: cacheSize,
    };
  },

  /**
   * Get system disk stats for the audio partition.
   *
   * @returns {Promise<number|null>} A promise resolving to the free space in bytes, or null if the check failed.
   */
  async getSystemStats() {
    try {
      // Using AUDIO_DIR or current directory as reference
      const diskSpace = await checkDiskSpace(AUDIO_DIR);
      return diskSpace.free;
    } catch (error) {
      console.warn(
        "[StorageService] Failed to get system disk stats:",
        error.message,
      );
      return null;
    }
  },

  /**
   * Checks if adding a specified number of bytes would exceed the configured storage quota.
   *
   * @param {number} bytesToAdd - The number of bytes intended to be added to storage.
   * @returns {Promise<{success: boolean, message: string}>} A promise resolving to the result of the quota check.
   */
  async checkQuota(bytesToAdd) {
    const config = configService.get();
    const limitGB = config.data?.storageLimit || 1.0;
    const limitBytes = limitGB * 1024 * 1024 * 1024;

    const usage = await this.getUsage();
    const totalAfter = usage.total + bytesToAdd;

    if (totalAfter > limitBytes) {
      return {
        success: false,
        message: "Storage Limit Exceeded",
      };
    }

    return { success: true, message: "Quota check passed" };
  },

  /**
   * Calculates a recommended storage limit based on the currently active triggers.
   *
   * @returns {number} The recommended storage limit in gigabytes.
   */
  calculateRecommendedLimit() {
    const config = configService.get();
    const triggers = config.automation?.triggers;
    if (!triggers) return 0.5; // Base minimum

    let fileCount = 0;
    let ttsCount = 0;

    Object.values(triggers).forEach((prayerTriggers) => {
      Object.values(prayerTriggers).forEach((event) => {
        if (event.enabled) {
          if (event.type === "file") fileCount++;
          else if (event.type === "tts") ttsCount++;
        }
      });
    });

    // 0.5MB per file, 0.1MB per TTS (conservative)
    const estimatedBytes = (fileCount * 0.5 + ttsCount * 0.1) * 1024 * 1024;
    // Buffer of 2x + 100MB minimal
    const recommendedBytes = estimatedBytes * 2 + 100 * 1024 * 1024;

    // Return rounded to 1 decimal place, minimum 0.5 GB
    const recommendedGB = Math.max(
      0.5,
      Math.ceil((recommendedBytes / (1024 * 1024 * 1024)) * 10) / 10,
    );
    return recommendedGB;
  },
};

module.exports = storageService;
