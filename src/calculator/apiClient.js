// apiClient.js
import fetch from 'node-fetch';
import { API_BASE_URL } from './constants.js';

export async function fetchPrayerTimesForYear(year, config) {
    const params = new URLSearchParams({
        latitude: config.latitude,
        longitude: config.longitude,
        method: config.calculationMethod,
        school: config.asrJuristicMethod, // Asr Juristic Method
        shafaq: config.shafaq,
        iso8601: config.iso8601.toString()
    });

    if (config.latitudeAdjustmentMethod !== null) {
        params.append('latitudeAdjustmentMethod', config.latitudeAdjustmentMethod);
    }
    if (config.midnightMode !== null) { // Should always be set by config
        params.append('midnightMode', config.midnightMode);
    }
    // Note: The API docs /calendar/{year} also needs timezone in the query string for annual calendar!
    // The /timings endpoint uses it implicitly from lat/long if not given,
    // but /calendar specifically lists timezone.
    if (config.timezone) {
        params.append('timezonestring', config.timezone); // Aladhan uses 'timezonestring' for /calendar
    }


    const url = `${API_BASE_URL}/calendar/${year}?${params.toString()}`;
    console.log(`Fetching prayer times from: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        if (data.code !== 200 || !data.data) {
            throw new Error(`API returned an error or unexpected data structure: ${data.status || JSON.stringify(data)}`);
        }
        return data.data; // This should be an object with months as keys { "1": [...days], "2": [...days] }
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        throw error; // Re-throw to be caught by main
    }
}