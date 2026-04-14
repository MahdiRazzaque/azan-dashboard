const { DateTime } = require("luxon");
const { z } = require("zod");
const Bottleneck = require("bottleneck");
const BaseProvider = require("./BaseProvider");
const {
  ProviderConnectionError,
  ProviderValidationError,
} = require("./errors");

const AladhanDaySchema = z
  .object({
    timings: z
      .object({
        Fajr: z.string(),
        Sunrise: z.string(),
        Dhuhr: z.string(),
        Asr: z.string(),
        Sunset: z.string(),
        Maghrib: z.string(),
        Isha: z.string(),
        Imsak: z.string(),
        Midnight: z.string(),
      })
      .passthrough(),
    date: z
      .object({
        gregorian: z
          .object({
            date: z.string(),
            day: z.string(),
            month: z
              .object({
                number: z.number(),
              })
              .passthrough(),
            year: z.string(),
          })
          .passthrough(),
      })
      .passthrough(),
    meta: z
      .object({
        timezone: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

/**
 * Response from Aladhan /v1/calendar/:year
 * Data is structured as { "1": [days...], "2": [days...] }
 */
const AladhanAnnualResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.record(z.string(), z.array(AladhanDaySchema)),
});
const {
  CALCULATION_METHODS,
  ASR_JURISTIC_METHODS,
  LATITUDE_ADJUSTMENT_METHODS,
  MIDNIGHT_MODES,
  API_BASE_URL,
} = require("@utils/constants");

/**
 * Provider for the Aladhan.com Prayer Times API.
 */
class AladhanProvider extends BaseProvider {
  /**
   * Rate limiter for Aladhan API.
   * Observed Limit: ~536 RPM | Safe Limit: 300 RPM (5 req/s)
   * Burst: ~15 | Safe Burst: 10
   */
  static queue = new Bottleneck({
    minTime: 0,
    maxConcurrent: 5,
    reservoir: 10,
    reservoirRefreshAmount: 5,
    reservoirRefreshInterval: 1000, // 5 req/s = 300 RPM
  });

  /** @override */
  async getAnnualTimes(year) {
    const key = `aladhan-${this.globalConfig.location.coordinates.lat}-${this.globalConfig.location.coordinates.long}-${year}`;
    return this.deduplicateRequest(key, () =>
      AladhanProvider.queue.schedule(() => this._doFetch(year)),
    );
  }

  /** @override */
  async healthCheck() {
    try {
      const url = `${API_BASE_URL}/methods`;
      const response = await fetch(url);
      if (response.ok) {
        return { healthy: true, message: "Reachable" };
      }
      return { healthy: false, message: `API returned ${response.status}` };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }

  /** @override */
  static getConfigSchema() {
    const { z } = require("zod");
    return z
      .object({
        type: z.literal("aladhan"),
        method: z.coerce.number().int().min(0).max(23).default(15),
        madhab: z.coerce.number().int().min(0).max(1).default(1),
        latitudeAdjustmentMethod: z.coerce
          .number()
          .int()
          .min(0)
          .max(3)
          .default(0),
        midnightMode: z.coerce.number().int().min(0).max(1).default(0),
      })
      .passthrough();
  }

  /** @override */
  static getMetadata() {
    const {
      CALCULATION_METHODS,
      ASR_JURISTIC_METHODS,
      LATITUDE_ADJUSTMENT_METHODS,
      MIDNIGHT_MODES,
    } = require("@utils/constants");

    /**
     * Converts a constant object to a sorted array of option objects.
     * @param {Object} obj - The constant object.
     * @returns {Array} Sorted options.
     */
    const toOptions = (obj) =>
      Object.entries(obj)
        .map(([id, label]) => ({ id: parseInt(id), label }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return {
      id: "aladhan",
      label: "Aladhan.com",
      description: "Global prayer times from Aladhan.com API",
      requiresCoordinates: true,
      capabilities: {
        providesIqamah: false,
      },
      branding: {
        accentColor: "blue",
        icon: "Globe",
      },
      parameters: [
        {
          key: "method",
          type: "select",
          label: "Calculation Method",
          description: "The method used to calculate prayer times.",
          default: 15,
          constraints: {
            required: true,
            options: toOptions(CALCULATION_METHODS),
          },
        },
        {
          key: "madhab",
          type: "select",
          label: "Madhab (Asr)",
          description: "Juristic method for Asr prayer time.",
          default: 1,
          constraints: {
            required: true,
            options: toOptions(ASR_JURISTIC_METHODS),
          },
        },
        {
          key: "latitudeAdjustmentMethod",
          type: "select",
          label: "Latitude Adjustment",
          description: "Method for adjusting times at high latitudes.",
          default: 0,
          constraints: {
            required: true,
            options: toOptions(LATITUDE_ADJUSTMENT_METHODS),
          },
        },
        {
          key: "midnightMode",
          type: "select",
          label: "Midnight Mode",
          description: "The method used to calculate midnight.",
          default: 0,
          constraints: {
            required: true,
            options: toOptions(MIDNIGHT_MODES),
          },
        },
      ],
    };
  }

  /**
   * Fetches annual prayer times from the Aladhan API and validates the response.
   * @param {number|string} year The calendar year for which to retrieve prayer calculations.
   * @returns {Promise<Object>} A promise resolving to a normalised map of prayer times.
   * @private
   */
  async _doFetch(year) {
    const { coordinates, timezone } = this.globalConfig.location;

    // Use provider-specific settings
    const { method, madhab, latitudeAdjustmentMethod, midnightMode } =
      this.sourceConfig;

    const methodId =
      typeof method === "number"
        ? method
        : this._getCalculationMethodId(method);
    const school =
      typeof madhab === "number" ? madhab : this._getMadhabId(madhab);
    const latAdj =
      typeof latitudeAdjustmentMethod === "number"
        ? latitudeAdjustmentMethod
        : this._getLatAdjId(latitudeAdjustmentMethod);
    const midnight =
      typeof midnightMode === "number"
        ? midnightMode
        : this._getMidnightId(midnightMode);

    const url = `${API_BASE_URL}/calendar/${year}?latitude=${coordinates.lat}&longitude=${coordinates.long}&method=${methodId}&school=${school}&latitudeAdjustmentMethod=${latAdj}&midnightMode=${midnight}`;

    console.log(`[Aladhan] Fetching from URL: ${url}`);

    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new ProviderConnectionError(
        `Failed to connect to Aladhan API: ${error.message}`,
        500,
        "Aladhan",
      );
    }

    console.log(`[Aladhan] Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const message = `Aladhan API Error: ${response.statusText}`;
      if (response.status >= 500) {
        throw new ProviderConnectionError(message, response.status, "Aladhan");
      } else {
        throw new ProviderValidationError(message, {
          statusCode: response.status,
        });
      }
    }

    const json = await response.json();
    let validData;
    try {
      validData = AladhanAnnualResponseSchema.parse(json);
      console.log("[Aladhan] Validation passed.");
    } catch (error) {
      console.error(
        "[Aladhan] Validation FAILED:",
        error.issues || error.message,
      );
      throw new ProviderValidationError("Aladhan Schema Validation Failed", {
        issues: error.issues,
      });
    }

    return this._normalizeResponse(validData, timezone);
  }

  /**
   * Normalises the Aladhan API response into a standard format used by the application.
   * @param {Object} validData The validated data object from the Aladhan API response.
   * @param {string} timezone The timezone string used to initialise local times.
   * @returns {Object} A nested object mapped by ISO date strings containing prayer times.
   * @private
   */
  _normalizeResponse(validData, timezone) {
    const resultMap = {};

    Object.values(validData.data).forEach((monthDays) => {
      monthDays.forEach((dayInfo) => {
        const dateStr = dayInfo.date.gregorian.date;
        const [d, m, y] = dateStr.split("-");
        const dateObj = DateTime.fromObject(
          { day: d, month: m, year: y },
          { zone: timezone },
        );
        const isoDateKey = dateObj.toISODate();

        /**
         * Cleans and formats raw time strings from the API into ISO 8601 timestamps.
         * @param {string} timeStr The raw time string (e.g., '05:00 (GST)').
         * @returns {string|null} The formatted ISO string or null if input is empty.
         */
        const cleanTime = (timeStr) => {
          if (!timeStr) return null;
          const t = timeStr.split(" ")[0];
          const [hours, minutes] = t.split(":").map(Number);
          return dateObj
            .set({ hour: hours, minute: minutes, second: 0 })
            .toISO();
        };

        resultMap[isoDateKey] = {
          fajr: cleanTime(dayInfo.timings.Fajr),
          sunrise: cleanTime(dayInfo.timings.Sunrise),
          dhuhr: cleanTime(dayInfo.timings.Dhuhr),
          asr: cleanTime(dayInfo.timings.Asr),
          maghrib: cleanTime(dayInfo.timings.Maghrib),
          isha: cleanTime(dayInfo.timings.Isha),
          iqamah: {},
        };
      });
    });

    return resultMap;
  }

  // --- Helper Methods ---

  /**
   * Retrieves the numeric calculation method ID based on the provided method name.
   * @param {string} methodName The name of the calculation method.
   * @returns {number} The corresponding calculation method ID, defaulting to 2 (ISNA).
   * @private
   */
  _getCalculationMethodId(methodName) {
    for (const [id, name] of Object.entries(CALCULATION_METHODS)) {
      if (name === methodName || name.includes(methodName)) return parseInt(id);
    }
    return 2; // Default ISNA
  }

  /**
   * Retrieves the numeric madhab (school of thought) ID for Asr juristic methods.
   * @param {string} madhabName The name of the madhab.
   * @returns {number} The corresponding madhab ID, defaulting to 0 (Shafi).
   * @private
   */
  _getMadhabId(madhabName) {
    for (const [id, name] of Object.entries(ASR_JURISTIC_METHODS)) {
      if (name.includes(madhabName)) return parseInt(id);
    }
    return 0; // Default Shafi
  }

  /**
   * Retrieves the numeric latitude adjustment method ID.
   * @param {string} name The name of the latitude adjustment method.
   * @returns {number} The corresponding ID, defaulting to 0.
   * @private
   */
  _getLatAdjId(name) {
    if (!name) return 0;
    for (const [id, val] of Object.entries(LATITUDE_ADJUSTMENT_METHODS)) {
      if (val.includes(name)) return parseInt(id);
    }
    return 0;
  }

  /**
   * Retrieves the numeric midnight mode ID.
   * @param {string} name The name of the midnight mode.
   * @returns {number} The corresponding ID, defaulting to 0.
   * @private
   */
  _getMidnightId(name) {
    if (!name) return 0;
    for (const [id, val] of Object.entries(MIDNIGHT_MODES)) {
      if (val.includes(name)) return parseInt(id);
    }
    return 0;
  }
}

// Log queue status if needed for debugging
AladhanProvider.queue.on("failed", (error, jobInfo) => {
  console.warn(
    `[Queue:Aladhan] Job ${jobInfo.options.id} failed: ${error.message}`,
  );
});

module.exports = AladhanProvider;
