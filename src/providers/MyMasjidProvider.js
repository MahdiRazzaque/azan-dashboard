const { DateTime } = require('luxon');
const BaseProvider = require('./BaseProvider');
const { ProviderConnectionError, ProviderValidationError } = require('./errors');
const { myMasjidQueue } = require('@utils/requestQueue');
const { MyMasjidBulkResponseSchema } = require('@config/apiSchemas');

/**
 * Provider for the MyMasjid API.
 */
class MyMasjidProvider extends BaseProvider {
    /** @override */
    async getAnnualTimes(year) {
        const key = `mymasjid-${this.sourceConfig.masjidId}`;
        return this.deduplicateRequest(key, () => myMasjidQueue.schedule(() => this._doFetch(year)));
    }

    /**
     * Fetches prayer times from the MyMasjid API and validates the response.
     * @param {number|string} year The calendar year for which to retrieve prayer calculations.
     * @returns {Promise<Object>} A promise resolving to a normalised map of prayer times.
     * @private
     */
    async _doFetch(year) {
        const { masjidId } = this.sourceConfig;
        const { timezone } = this.globalConfig.location;

        if (!masjidId) {
            throw new ProviderValidationError('Masjid ID is required', { masjidId: 'missing' });
        }

        const url = `https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${masjidId}`;

        console.log(`[MyMasjid] Fetching from URL: ${url}`);

        let response;
        try {
            response = await fetch(url);
        } catch (error) {
            throw new ProviderConnectionError(`Failed to connect to MyMasjid API: ${error.message}`, 500, 'MyMasjid');
        }

        console.log(`[MyMasjid] Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const message = `MyMasjid API Error: ${response.statusText}`;
            if (response.status >= 500) {
                throw new ProviderConnectionError(message, response.status, 'MyMasjid');
            } else if (response.status === 400) {
                throw new ProviderValidationError('Invalid Masjid ID: The ID provided is incorrect.', { statusCode: 400 });
            } else if (response.status === 404) {
                throw new ProviderValidationError('Masjid ID not found.', { statusCode: 404 });
            } else {
                throw new ProviderValidationError(message, { statusCode: response.status });
            }
        }

        const json = await response.json();
        let validData;
        try {
            validData = MyMasjidBulkResponseSchema.parse(json);
            console.log('[MyMasjid] Validation passed.');
        } catch (error) {
            console.error('[MyMasjid] Validation FAILED:', error.issues || error.message);
            throw new ProviderValidationError('MyMasjid Schema Validation Failed', { issues: error.issues });
        }

        return this._normalizeResponse(validData, timezone);
    }

    /**
     * Normalises the MyMasjid API response into a standard format used by the application.
     * @param {Object} validData The validated data object from the MyMasjid API response.
     * @param {string} timezone The timezone string used to initialise local times.
     * @returns {Object} A nested object mapped by ISO date strings containing prayer times.
     * @private
     */
    _normalizeResponse(validData, timezone) {
        const resultMap = {};
        const currentYear = DateTime.now().setZone(timezone).year;

        validData.model.salahTimings.forEach(day => {
            const dateObj = DateTime.fromObject(
                { day: day.day, month: day.month, year: currentYear },
                { zone: timezone }
            );

            if (!dateObj.isValid) return;

            const isoDateKey = dateObj.toISODate();

            /**
             * Formats a time string into an ISO 8601 timestamp.
             * @param {string} t The raw time string.
             * @param {DateTime} dateBase The Luxon DateTime object for the specific day.
             * @returns {string|null} The formatted ISO string or null if input is empty.
             */
            const formatTime = (t, dateBase) => {
                if (!t) return null;
                const [h, m] = t.split(':').map(Number);
                return dateBase.set({ hour: h, minute: m, second: 0 }).toISO();
            };

            /**
             * Extracts the prayer time from the day object based on the provided key.
             * @param {string} key The key identifying the prayer (e.g., 'fajr').
             * @param {Object} dayObj The object containing timings for a specific day.
             * @returns {string|null} The extracted time string or null.
             */
            const getTime = (key, dayObj) => {
                const val = dayObj[key];
                if (Array.isArray(val)) {
                    return (val && val.length > 0) ? val[0].salahTime : null;
                }
                return typeof val === 'string' ? val : null;
            };

            /**
             * Extracts the iqamah time from the day object based on the provided key.
             * @param {string} key The key identifying the prayer (e.g., 'fajr').
             * @param {Object} dayObj The object containing timings for a specific day.
             * @returns {string|null} The extracted iqamah time string or null.
             */
            const getIqamah = (key, dayObj) => {
                if (Array.isArray(dayObj[key])) {
                    return (dayObj[key] && dayObj[key].length > 0) ? dayObj[key][0].iqamahTime : null;
                }
                const flatKey = `iqamah_${key.charAt(0).toUpperCase() + key.slice(1)}`;
                return typeof dayObj[flatKey] === 'string' ? dayObj[flatKey] : null;
            };

            resultMap[isoDateKey] = {
                fajr: formatTime(getTime('fajr', day), dateObj),
                sunrise: formatTime(getTime('shouruq', day), dateObj),
                dhuhr: formatTime(getTime('zuhr', day), dateObj),
                asr: formatTime(getTime('asr', day), dateObj),
                maghrib: formatTime(getTime('maghrib', day), dateObj),
                isha: formatTime(getTime('isha', day), dateObj),
                iqamah: {
                    fajr: formatTime(getIqamah('fajr', day), dateObj),
                    dhuhr: formatTime(getIqamah('zuhr', day), dateObj),
                    asr: formatTime(getIqamah('asr', day), dateObj),
                    maghrib: formatTime(getIqamah('maghrib', day), dateObj),
                    isha: formatTime(getIqamah('isha', day), dateObj),
                }
            };
        });

        return resultMap;
    }
}

module.exports = MyMasjidProvider;
