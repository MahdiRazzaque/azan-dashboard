const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const numberToWords = require("number-to-words");

const limiter = new Bottleneck({
  maxConcurrent: 3,
});

const configService = require("@config"); // Singleton
const audioValidator = require("@utils/audioValidator");
const OutputFactory = require("../../outputs");
const { AUDIO_PATHS, TTS_FILENAME_PATTERN } = require("@utils/constants");

// AUDIO ROOT: public/audio (for mp3 files)
const AUDIO_ROOT = path.join(
  __dirname,
  "../../../",
  AUDIO_PATHS.CUSTOM_DIR,
  "../",
);
const AUDIO_CACHE_DIR = path.join(
  __dirname,
  "../../../",
  AUDIO_PATHS.CACHE_DIR,
);
const AUDIO_TEMP_DIR = path.join(__dirname, "../../../", AUDIO_PATHS.TEMP_DIR);
const AUDIO_CUSTOM_DIR = path.join(
  __dirname,
  "../../../",
  AUDIO_PATHS.CUSTOM_DIR,
);

// METADATA ROOT: src/public/audio (for .mp3.json files)
// Note: Metadata is stored in src/public/audio to be included in the build/dist if needed,
// while audio files are in public/audio.
const META_ROOT = path.join(__dirname, "../../public/audio");
const META_CACHE_DIR = path.join(META_ROOT, "cache");
const META_CUSTOM_DIR = path.join(META_ROOT, "custom");

const ARABIC_NAMES = {
  fajr: "فجر",
  sunrise: "شُروق",
  dhuhr: "ظُهْر",
  asr: "عصر",
  maghrib: "مغرب",
  isha: "عِشَا",
};

const PRAYER_NAMES = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

/**
 * Helper to ensure a single directory exists.
 *
 * @param {string} dir - The directory path to ensure.
 * @returns {Promise<void>} A promise that resolves when the directory is ready.
 */
async function ensureDir(dir) {
  try {
    await fsp.access(dir);
  } catch {
    await fsp.mkdir(dir, { recursive: true });
  }
}

/**
 * Ensures that necessary directories exist.
 *
 * @returns {Promise<void>} A promise that resolves when all directories are ready.
 */
const ensureDirs = async () => {
  const dirs = [
    AUDIO_CACHE_DIR,
    AUDIO_TEMP_DIR,
    AUDIO_CUSTOM_DIR,
    META_CACHE_DIR,
    META_CUSTOM_DIR,
  ];
  await Promise.all(dirs.map(ensureDir));
};

/**
 * Internal helper to build full metadata including compatibility blocks.
 *
 * @param {string} audioPath - The path to the audio file.
 * @param {Object} basicMetadata - The basic audio metadata extracted from the file.
 * @returns {Promise<Object>} A promise that resolves to the enriched metadata object.
 */
const enrichMetadata = async (audioPath, basicMetadata) => {
  const compatibility = {};
  const strategyInstances = OutputFactory.getAllStrategyInstances();

  for (const instance of strategyInstances) {
    const metadata = instance.constructor.getMetadata();
    compatibility[metadata.id] = await instance.validateAsset(
      audioPath,
      basicMetadata,
    );
  }

  return {
    ...basicMetadata,
    compatibility,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Performs a full analysis of an audio file, updating its metadata sidecar.
 *
 * @param {string} audioPath - The path to the audio file.
 * @returns {Promise<Object>} A promise that resolves to the updated metadata.
 */
const analyzeFile = async (audioPath) => {
  const basicMetadata = await audioValidator.analyseAudioFile(audioPath);
  const enrichedMetadata = await enrichMetadata(audioPath, basicMetadata);

  // Determine meta path based on audio path
  const filename = path.basename(audioPath);
  const isCache = audioPath.includes("cache");
  const metaDir = isCache ? META_CACHE_DIR : META_CUSTOM_DIR;
  // nosemgrep: path-join-resolve-traversal -- filename from path.basename() of internal audioPath, not user input
  const metaPath = path.join(metaDir, filename + ".json");

  // Read existing metadata to preserve fields like 'text', 'voice', 'protected'
  let existingData = {};
  try {
    const content = await fsp.readFile(metaPath, "utf8");
    existingData = JSON.parse(content);
  } catch {
    /* ignore */
  }

  const finalMetadata = {
    ...existingData,
    ...enrichedMetadata,
  };

  await fsp.writeFile(metaPath, JSON.stringify(finalMetadata));
  return finalMetadata;
};

/**
 * Cleans up old audio files from the cache directory.
 *
 * @returns {Promise<void>} A promise that resolves when the cleanup is complete.
 */
const cleanupCache = async () => {
  await ensureDirs();
  const now = Date.now();
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

  try {
    const files = await fsp.readdir(AUDIO_CACHE_DIR);
    for (const file of files) {
      const filePath = path.join(AUDIO_CACHE_DIR, file);
      const stats = await fsp.stat(filePath);
      if (now - stats.mtimeMs > MAX_AGE) {
        await fsp.unlink(filePath);

        // Cleanup metadata as well
        const metaPath = path.join(META_CACHE_DIR, file + ".json");
        try {
          await fsp.access(metaPath);
          await fsp.unlink(metaPath);
        } catch {
          /* ignore */
        }

        console.log(`[AudioService] Deleted old cache file and meta: ${file}`);
      }
    }
  } catch (error) {
    console.error("[AudioService] Cache cleanup failed:", error.message);
  }
};

/**
 * Cleans up temporary preview audio files.
 *
 * @param {boolean} [force=false] - Whether to force deletion of all temp files regardless of age.
 * @returns {Promise<void>} A promise that resolves when the cleanup is complete.
 */
const cleanupTempAudio = async (force = false) => {
  console.log(
    `[AudioService] Cleaning up temporary audio files (force: ${force})...`,
  );
  try {
    await fsp.access(AUDIO_TEMP_DIR);
  } catch {
    return;
  }

  const now = Date.now();
  const MAX_AGE = 1 * 60 * 60 * 1000; // 1 hour

  try {
    const files = await fsp.readdir(AUDIO_TEMP_DIR);
    const audioExtensions = [
      ".mp3",
      ".wav",
      ".aac",
      ".ogg",
      ".opus",
      ".flac",
      ".m4a",
    ];
    let deletedCount = 0;
    for (const file of files) {
      if (!audioExtensions.includes(path.extname(file).toLowerCase())) continue;
      const filePath = path.join(AUDIO_TEMP_DIR, file);
      const stats = await fsp.stat(filePath);

      if (force || now - stats.mtimeMs > MAX_AGE) {
        await fsp.unlink(filePath);
        deletedCount++;
      }
    }
    console.log(
      `[AudioService] Cleaned up ${deletedCount} temporary preview files.`,
    );
  } catch (error) {
    console.error("[AudioService] Temp cleanup failed:", error.message);
  }
};

/**
 * Resolves placeholders within a message template string.
 *
 * @param {string} template - The message template string containing placeholders.
 * @param {string} prayerKey - The key identifying the prayer.
 * @param {number} [offsetMinutes] - Optional offset minutes for placeholders.
 * @returns {string} The resolved message string.
 */
const resolveTemplate = (template, prayerKey, offsetMinutes) => {
  let result = template;
  result = result.replace(
    /{prayerEnglish}/g,
    prayerKey.charAt(0).toUpperCase() + prayerKey.slice(1),
  );
  result = result.replace(
    /{prayerArabic}/g,
    ARABIC_NAMES[prayerKey] || prayerKey,
  );
  if (offsetMinutes !== undefined) {
    const words = numberToWords.toWords(offsetMinutes);
    result = result.replace(/{minutes}/g, words);
  }
  return result;
};

/**
 * Generates an audio file using the external Text-to-Speech service.
 *
 * @param {string} filename - The name of the file to be generated.
 * @param {string} text - The text to convert to speech.
 * @param {string} serviceUrl - The URL of the TTS service.
 * @param {string} voice - The voice to use for generation.
 * @returns {Promise<void>} A promise that resolves when the audio is generated.
 */
const generateTTS = async (filename, text, serviceUrl, voice) => {
  const url = `${serviceUrl}/generate-tts`;
  try {
    await axios.post(
      url,
      { text, filename, voice },
      {
        maxContentLength: 5000000,
      },
    );
    console.log(`[AudioService] Successfully generated: ${filename}`);
  } catch (error) {
    // nosemgrep: unsafe-formatstring -- filename is a hash-based internal value, not user HTTP input
    console.error(
      `[AudioService] TTS Generation failed for ${filename}:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Ensures a TTS file exists and is valid based on current configuration.
 *
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The name of the event.
 * @param {Object} settings - Trigger settings for the event.
 * @param {Object} config - The system configuration.
 * @returns {Promise<Object>} A promise resolving to a result object indicating success or failure.
 */
const ensureTTSFile = async (prayer, event, settings, config) => {
  const pythonServiceUrl =
    config.automation?.pythonServiceUrl || "http://localhost:8000";
  const text = resolveTemplate(
    settings.template,
    prayer,
    settings.offsetMinutes,
  );
  const filename = TTS_FILENAME_PATTERN.replace("{prayer}", prayer).replace(
    "{event}",
    event,
  );
  const audioPath = path.join(AUDIO_CACHE_DIR, filename);
  const metaPath = path.join(META_CACHE_DIR, filename + ".json");
  const effectiveVoice =
    settings.voice || config.automation?.defaultVoice || "ar-SA-HamedNeural";

  let shouldGenerate = true;
  try {
    await fsp.access(audioPath);
    await fsp.access(metaPath);

    const content = await fsp.readFile(metaPath, "utf8");
    const meta = JSON.parse(content);
    if (meta.text === text && meta.voice === effectiveVoice) {
      const now = new Date();
      await fsp.utimes(audioPath, now, now);
      await fsp.utimes(metaPath, now, now);
      shouldGenerate = false;
    }
  } catch {
    /* missing or corrupted */
  }

  if (!shouldGenerate) {
    return { success: true, message: "Valid file exists", generated: false };
  }

  // Check TTS Health before generating
  const healthCheck = require("./healthCheck");
  const ttsHealth = await healthCheck.refresh("tts");
  if (!ttsHealth.tts?.healthy) {
    return {
      success: false,
      message:
        "TTS Service Offline. Generation will be attempted again at trigger time.",
      generated: false,
    };
  }

  console.log(`[AudioService] Preparing TTS for ${prayer} - ${event}`);
  const storageService = require("./storageService");
  const estimatedSize = text.length * 1024;
  const quotaCheck = await storageService.checkQuota(estimatedSize);

  if (!quotaCheck.success) {
    throw new Error(`Storage Limit Exceeded: ${quotaCheck.message}`);
  }

  try {
    await generateTTS(filename, text, pythonServiceUrl, effectiveVoice);

    const basicMetadata = await audioValidator.analyseAudioFile(audioPath);
    const enrichedMetadata = await enrichMetadata(audioPath, basicMetadata);

    await fsp.writeFile(
      metaPath,
      JSON.stringify({
        text,
        voice: effectiveVoice,
        generatedAt: new Date().toISOString(),
        ...enrichedMetadata,
      }),
    );
    return {
      success: true,
      message: "Successfully generated",
      generated: true,
    };
  } catch (e) {
    // nosemgrep: unsafe-formatstring -- filename is a hash-based internal value, not user HTTP input
    console.error(
      `[AudioService] TTS generation failed for ${filename}:`,
      e.message,
    );
    return { success: false, message: e.message, generated: false };
  }
};

/**
 * Synchronises audio assets with the current configuration.
 *
 * @param {boolean} [forceClean=false] - Whether to delete all existing cached assets first.
 * @returns {Promise<Object>} A promise resolving to an object containing any warnings encountered.
 */
const syncAudioAssets = async (forceClean = false) => {
  console.log("[AudioService] Synchronising audio assets...");
  await ensureDirs();

  const config = configService.get();
  const triggers = config.automation?.triggers;
  const warnings = [];

  if (forceClean) {
    console.log("[AudioService] Force cleaning all cached assets...");
    const dirs = [AUDIO_CACHE_DIR, META_CACHE_DIR];
    for (const dir of dirs) {
      try {
        await fsp.access(dir);
        const files = await fsp.readdir(dir);
        // nosemgrep: path-join-resolve-traversal -- f comes from fs.readdir(), not user input
        await Promise.all(files.map((f) => fsp.unlink(path.join(dir, f))));
      } catch {
        /* ignore */
      }
    }
  }

  if (!triggers) return { warnings: [] };

  const tasks = [];
  for (const prayer of PRAYER_NAMES) {
    const prayerTriggers = triggers[prayer];
    if (!prayerTriggers) continue;

    for (const [event, settings] of Object.entries(prayerTriggers)) {
      if (!settings.enabled || settings.type !== "tts" || !settings.template)
        continue;

      tasks.push({ prayer, event, settings });
    }
  }

  const results = await Promise.allSettled(
    tasks.map((task) =>
      limiter.schedule(() =>
        ensureTTSFile(task.prayer, task.event, task.settings, config),
      ),
    ),
  );

  results.forEach((result, index) => {
    const task = tasks[index];
    const niceName = `${task.prayer.charAt(0).toUpperCase() + task.prayer.slice(1)} ${task.event.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}`;

    if (result.status === "rejected") {
      // nosemgrep: unsafe-formatstring -- task.prayer and task.event are internal config constants, not user HTTP input
      console.error(
        `[AudioService] Asset sync failed for ${task.prayer} ${task.event}:`,
        result.reason.message,
      );
      warnings.push(`${niceName}: ${result.reason.message}`);
    } else if (!result.value.success) {
      warnings.push(`${niceName}: ${result.value.message}`);
    }
  });

  await cleanupCache();
  await cleanupTempAudio();
  console.log("[AudioService] Asset preparation complete.");
  return { warnings };
};

/**
 * Ensures that a "test.mp3" file exists.
 *
 * @returns {Promise<void>} A promise that resolves when the test audio is ready.
 */
const ensureTestAudio = async () => {
  await ensureDirs();
  const testAudioPath = path.join(AUDIO_CUSTOM_DIR, "test.mp3");
  const testMetaPath = path.join(META_CUSTOM_DIR, "test.mp3.json");

  try {
    await fsp.access(testAudioPath);
    await fsp.access(testMetaPath);
    return;
  } catch {
    // Continue to generation
  }

  console.log('[AudioService] Generating "test.mp3" for output testing...');
  const config = configService.get();
  const pythonServiceUrl =
    config.automation?.pythonServiceUrl || "http://localhost:8000";
  const voice = "en-GB-RyanNeural";
  const text = "This is a test of the notification system!";
  const filename = "test.mp3";

  try {
    await generateTTS(filename, text, pythonServiceUrl, voice);

    const cacheAudioPath = path.join(AUDIO_CACHE_DIR, filename);

    try {
      await fsp.access(cacheAudioPath);
      try {
        await fsp.copyFile(cacheAudioPath, testAudioPath);
        await fsp.unlink(cacheAudioPath);
      } catch (moveError) {
        console.error(
          `[AudioService] Move failed, attempting rename fallback:`,
          moveError.message,
        );
        await fsp.rename(cacheAudioPath, testAudioPath);
      }

      const basicMetadata =
        await audioValidator.analyseAudioFile(testAudioPath);
      const enrichedMetadata = await enrichMetadata(
        testAudioPath,
        basicMetadata,
      );

      await fsp.writeFile(
        testMetaPath,
        JSON.stringify({
          text,
          voice,
          generatedAt: new Date().toISOString(),
          hidden: true,
          ...enrichedMetadata,
        }),
      );

      console.log('[AudioService] "test.mp3" generated and moved to custom.');
    } catch {
      console.error(
        `[AudioService] Cache file missing after generation: ${cacheAudioPath}`,
      );
    }
  } catch (error) {
    console.error(
      "[AudioService] Failed to generate test audio:",
      error.message,
    );
  }
};

/**
 * Generates a temporary TTS preview.
 *
 * @param {string} template - The message template string.
 * @param {string} prayerKey - The key identifying the prayer.
 * @param {number} offsetMinutes - The offset minutes for the template.
 * @param {string} voice - The voice to use for the preview.
 * @returns {Promise<Object>} A promise resolving to an object containing the preview URL.
 */
const previewTTS = async (template, prayerKey, offsetMinutes, voice) => {
  const text = resolveTemplate(
    template,
    prayerKey.toLowerCase(),
    offsetMinutes,
  );
  const config = configService.get();
  const pythonUrl =
    config.automation?.pythonServiceUrl || "http://localhost:8000";

  const hash = crypto
    .createHash("md5")
    .update(`${text}|${voice}`)
    .digest("hex")
    .slice(0, 12);
  const filename = `preview_${hash}.mp3`;
  // nosemgrep: path-join-resolve-traversal -- filename is derived from MD5 hash, not user input
  const audioPath = path.join(AUDIO_TEMP_DIR, filename);

  try {
    await fsp.access(audioPath);
    const stats = await fsp.stat(audioPath);
    if (Date.now() - stats.mtimeMs < 1 * 60 * 60 * 1000) {
      const now = new Date();
      await fsp.utimes(audioPath, now, now);
      return { url: `/public/audio/temp/${filename}` };
    }
  } catch {
    /* doesn't exist */
  }

  try {
    const response = await axios.post(
      `${pythonUrl}/preview-tts`,
      { text, voice, filename },
      { maxContentLength: 5000000 },
    );
    return response.data;
  } catch (error) {
    console.error("[AudioService] Preview generation failed:", error.message);
    throw error;
  }
};

/**
 * Generates metadata sidecar files for any existing audio files.
 *
 * @returns {Promise<void>} A promise that resolves when the metadata generation is complete.
 */
const generateMetadataForExistingFiles = async () => {
  await ensureDirs();
  const directories = [
    { audio: AUDIO_CUSTOM_DIR, meta: META_CUSTOM_DIR },
    { audio: AUDIO_CACHE_DIR, meta: META_CACHE_DIR },
  ];

  for (const dirSet of directories) {
    try {
      await fsp.access(dirSet.audio);
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
    const files = (await fsp.readdir(dirSet.audio)).filter((f) =>
      audioExtensions.includes(path.extname(f).toLowerCase()),
    );
    for (const file of files) {
      const audioPath = path.join(dirSet.audio, file);
      const metaPath = path.join(dirSet.meta, file + ".json");

      const legacyMetaPath = audioPath + ".json";
      const redundantMetaPath = audioPath + ".meta.json";

      try {
        await fsp.access(metaPath);
        // Already exists
      } catch {
        try {
          console.log(`[AudioService] Generating metadata for ${file}...`);
          const basicMetadata =
            await audioValidator.analyseAudioFile(audioPath);
          const enrichedMetadata = await enrichMetadata(
            audioPath,
            basicMetadata,
          );

          let existingData = {};
          try {
            await fsp.access(legacyMetaPath);
            existingData = JSON.parse(
              await fsp.readFile(legacyMetaPath, "utf8"),
            );
          } catch {
            try {
              await fsp.access(redundantMetaPath);
              existingData = JSON.parse(
                await fsp.readFile(redundantMetaPath, "utf8"),
              );
            } catch {
              /* ignore */
            }
          }

          if (file === "azan.mp3") {
            existingData.protected = true;
          }

          await fsp.writeFile(
            metaPath,
            JSON.stringify({
              ...existingData,
              ...enrichedMetadata,
            }),
          );

          try {
            await fsp.unlink(legacyMetaPath);
          } catch {
            /* ignore */
          }
          try {
            await fsp.unlink(redundantMetaPath);
          } catch {
            /* ignore */
          }
        } catch (error) {
          // nosemgrep: unsafe-formatstring -- file comes from fs.readdir(), not user HTTP input
          console.error(
            `[AudioService] Metadata generation failed for ${file}:`,
            error.message,
          );
        }
      }
    }
  }
};

module.exports = {
  syncAudioAssets,
  ensureTTSFile,
  ensureTestAudio,
  cleanupCache,
  cleanupTempAudio,
  resolveTemplate,
  previewTTS,
  generateMetadataForExistingFiles,
  enrichMetadata,
  analyzeFile,
};
