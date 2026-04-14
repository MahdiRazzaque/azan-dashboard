const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { DateTime } = require("luxon");
const prayerTimeService = require("@services/core/prayerTimeService");
const { calculateIqamah } = require("@utils/calculations");
const { resolveTemplate } = require("./audioAssetService");

/**
 * Calculates the current status of all automation triggers for the given configuration.
 *
 * @param {Object} config - The system configuration object.
 * @returns {Promise<Object>} A promise that resolves to an object representing the status of each trigger.
 */
const getAutomationStatus = async (config) => {
  const timezone = config.location.timezone;
  const now = DateTime.now().setZone(timezone);
  const triggers = config.automation.triggers;
  const prayerNames = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

  let prayerData;
  try {
    prayerData = await prayerTimeService.getPrayerTimes(config, now);
  } catch (e) {
    console.error(
      "[Diagnostics] Failed to fetch prayer times for status check:",
      e,
    );
    return {};
  }

  const result = {};

  for (const prayer of prayerNames) {
    result[prayer] = {};
    const prayerTriggers = triggers[prayer] || {};
    const startISO = prayerData.prayers[prayer];

    if (!startISO) {
      result[prayer].error = "No time data";
      continue;
    }

    const start = DateTime.fromISO(startISO).setZone(timezone);

    let iqamah = null;
    const prayerConfig = config.prayers[prayer];
    const isOverride = prayerConfig?.iqamahOverride === true;

    if (
      !isOverride &&
      prayerData.prayers.iqamah &&
      prayerData.prayers.iqamah[prayer]
    ) {
      iqamah = DateTime.fromISO(prayerData.prayers.iqamah[prayer]).setZone(
        timezone,
      );
    } else if (prayerConfig) {
      const calculatedIso = calculateIqamah(startISO, prayerConfig, timezone);
      iqamah = DateTime.fromISO(calculatedIso).setZone(timezone);
    }

    /**
     * Helper to determine the status of a specific trigger.
     *
     * @param {Object} triggerConfig - The configuration for the trigger.
     * @param {import('luxon').DateTime} time - The calculated execution time for the trigger.
     * @returns {Object} An object containing the status, time, and details of the trigger.
     */
    const getStatus = (triggerConfig, time) => {
      const enabled = triggerConfig?.enabled;
      if (!enabled) return { status: "DISABLED" };
      if (!time) return { status: "ERROR", error: "Time calculation failed" };

      const type = triggerConfig.type || "file";
      let source = "Unknown";
      if (type === "file")
        source = triggerConfig.path
          ? path.basename(triggerConfig.path)
          : "No File";
      else if (type === "url") source = triggerConfig.url || "No URL";
      else if (type === "tts")
        source = triggerConfig.template
          ? `"${triggerConfig.template.substring(0, 30)}${triggerConfig.template.length > 30 ? "..." : ""}"`
          : "No Template";

      const targets = triggerConfig.targets || [];

      const details = {
        type,
        source,
        targets: targets.join(", "),
      };

      if (time < now) {
        return { status: "PASSED", time: time.toISO(), details };
      } else {
        return { status: "UPCOMING", time: time.toISO(), details };
      }
    };

    result[prayer].adhan = getStatus(prayerTriggers.adhan, start);
    const preAdhanOffset = prayerTriggers.preAdhan?.offsetMinutes || 0;
    result[prayer].preAdhan = getStatus(
      prayerTriggers.preAdhan,
      start.minus({ minutes: preAdhanOffset }),
    );

    if (prayer !== "sunrise") {
      result[prayer].iqamah = getStatus(prayerTriggers.iqamah, iqamah);
      const preIqamahOffset = prayerTriggers.preIqamah?.offsetMinutes || 0;
      result[prayer].preIqamah = getStatus(
        prayerTriggers.preIqamah,
        iqamah ? iqamah.minus({ minutes: preIqamahOffset }) : null,
      );
    }
  }

  return result;
};

/**
 * Checks the status of TTS (Text-to-Speech) assets for the given configuration.
 *
 * @param {Object} config - The system configuration object.
 * @returns {Promise<Object>} A promise that resolves to an object indicating the status of TTS assets.
 */
const getTTSStatus = async (config) => {
  const prayers = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  const result = {};

  const cacheDir = path.join(process.cwd(), "public", "audio", "cache");
  const metaCacheDir = path.join(__dirname, "../../public/audio/cache");

  const checkTasks = [];

  for (const prayer of prayers) {
    result[prayer] = {};
    const prayerTriggers = config.automation.triggers[prayer] || {};
    const events =
      prayer === "sunrise"
        ? ["preAdhan", "adhan"]
        : ["preAdhan", "adhan", "preIqamah", "iqamah"];

    for (const event of events) {
      const triggerConfig = prayerTriggers[event];

      if (!triggerConfig || !triggerConfig.enabled) {
        result[prayer][event] = { status: "DISABLED" };
        continue;
      }

      const audioType = triggerConfig.type || "file";

      if (audioType === "url") {
        result[prayer][event] = { status: "URL", detail: triggerConfig.url };
      } else if (audioType === "file") {
        const filename = triggerConfig.path
          ? path.basename(triggerConfig.path)
          : "Unknown";
        result[prayer][event] = { status: "CUSTOM_FILE", detail: filename };
      } else if (audioType === "tts") {
        checkTasks.push(
          (async () => {
            const expectedFilename = `tts_${prayer}_${event}.mp3`;
            const audioPath = path.join(cacheDir, expectedFilename);
            const metaPath = path.join(
              metaCacheDir,
              expectedFilename + ".json",
            );

            try {
              await fsp.access(audioPath);
              await fsp.access(metaPath);

              const content = await fsp.readFile(metaPath, "utf8");
              const meta = JSON.parse(content);

              const expectedText = resolveTemplate(
                triggerConfig.template,
                prayer,
                triggerConfig.offsetMinutes,
              );

              if (meta.text === expectedText) {
                result[prayer][event] = {
                  status: "GENERATED",
                  detail: meta.generatedAt,
                };
              } else {
                result[prayer][event] = {
                  status: "MISMATCH",
                  detail: "Template changed",
                };
              }
            } catch (e) {
              if (e.code === "ENOENT") {
                result[prayer][event] = { status: "MISSING" };
              } else {
                result[prayer][event] = {
                  status: "ERROR",
                  detail: "Corrupt Meta or Access Denied",
                };
              }
            }
          })(),
        );
      } else {
        result[prayer][event] = { status: "UNKNOWN" };
      }
    }
  }

  await Promise.all(checkTasks);
  return result;
};

module.exports = {
  getAutomationStatus,
  getTTSStatus,
};
