const fs = require("fs").promises;
const path = require("path");
const audioValidator = require("@utils/audioValidator");
const OutputFactory = require("../../outputs");

// Constants for directories
const AUDIO_ROOT = path.join(__dirname, "../../../public/audio");
const META_ROOT = path.join(__dirname, "../../public/audio");

/**
 * Service to migrate audio asset metadata to the new schema.
 * Ensures all files have compatibility blocks for registered output strategies.
 */
class AssetMigrationService {
  /**
   * Performs a full scan and migration of all audio assets.
   * Processes in batches to avoid blocking the event loop.
   *
   * @returns {Promise<void>}
   */
  async migrateAll() {
    console.log("[Migration] Starting audio asset compatibility scan...");
    const startTime = Date.now();

    try {
      const directories = [
        {
          audio: path.join(AUDIO_ROOT, "custom"),
          meta: path.join(META_ROOT, "custom"),
        },
        {
          audio: path.join(AUDIO_ROOT, "cache"),
          meta: path.join(META_ROOT, "cache"),
        },
      ];

      let totalProcessed = 0;
      let totalUpdated = 0;

      for (const dirSet of directories) {
        try {
          await fs.access(dirSet.audio);
        } catch {
          continue;
        }

        const audioExtensions = [
          ".mp3",
          ".wav",
          ".aac",
          ".ogg",
          ".opus",
          ".flac",
          ".m4a",
        ];
        const files = (await fs.readdir(dirSet.audio)).filter((f) =>
          audioExtensions.includes(path.extname(f).toLowerCase()),
        );

        // Process in batches of 50
        const BATCH_SIZE = 50;
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          console.log(
            `[Migration] Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(files.length / BATCH_SIZE)} in ${path.basename(dirSet.audio)}...`,
          );

          const results = await Promise.all(
            batch.map((file) => this._migrateFile(file, dirSet)),
          );

          totalProcessed += batch.length;
          totalUpdated += results.filter((r) => r === true).length;

          // Yield to event loop to keep server responsive
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `[Migration] Completed in ${duration}s. Processed: ${totalProcessed}, Updated: ${totalUpdated}`,
      );
    } catch (error) {
      console.error(
        "[Migration] Critical failure during asset migration:",
        error.message,
      );
    }
  }

  /**
   * Migrates a single file if it lacks compatibility metadata.
   *
   * @param {string} file - Filename.
   * @param {Object} dirSet - Directory paths for audio and meta.
   * @returns {Promise<boolean>} True if the file was updated.
   * @private
   */
  async _migrateFile(file, dirSet) {
    // nosemgrep: path-join-resolve-traversal -- file comes from fs.readdir(), not user input
    const audioPath = path.join(dirSet.audio, file);
    // nosemgrep: path-join-resolve-traversal -- file comes from fs.readdir(), not user input
    const metaPath = path.join(dirSet.meta, file + ".json");

    try {
      try {
        await fs.access(metaPath);
      } catch {
        // generateMetadataForExistingFiles in audioAssetService will handle creation of missing sidecars
        return false;
      }

      const content = await fs.readFile(metaPath, "utf8");
      let metadata;
      try {
        metadata = JSON.parse(content);
      } catch {
        console.warn(`[Migration] Corrupted metadata for ${file}, skipping.`);
        return false;
      }

      // Check if all registered strategies have a compatibility block
      const strategies = OutputFactory.getAllStrategyInstances();
      const compatibility = metadata.compatibility || {};
      let needsUpdate = false;

      for (const strategy of strategies) {
        const id = strategy.constructor.getMetadata().id;
        if (!compatibility[id]) {
          needsUpdate = true;
          // We need basic metadata for validation
          // If missing from sidecar, re-analyse (shouldn't happen with newer files)
          if (!metadata.format || !metadata.bitrate) {
            const analysed = await audioValidator.analyseAudioFile(audioPath);
            // nosemgrep: insecure-object-assign -- both metadata (JSON.parse from file) and analysed (audioValidator) are trusted server-side data
            Object.assign(metadata, analysed);
          }

          compatibility[id] = await strategy.validateAsset(audioPath, metadata);
        }
      }

      if (needsUpdate) {
        metadata.compatibility = compatibility;
        metadata.updatedAt = new Date().toISOString();
        await fs.writeFile(metaPath, JSON.stringify(metadata));
        return true;
      }
    } catch (error) {
      console.warn(`[Migration] Failed to migrate ${file}: ${error.message}`);
    }
    return false;
  }
}

module.exports = new AssetMigrationService();
