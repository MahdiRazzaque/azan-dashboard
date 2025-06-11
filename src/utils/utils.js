import moment from 'moment-timezone';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get TEST_MODE from environment variable
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_START_TIME = TEST_MODE ? 
  moment.tz(process.env.TEST_START_TIME || '02:00:00', 'HH:mm:ss', process.env.TEST_TIMEZONE || 'Europe/London') : 
  null;
const timeOffset = TEST_MODE ? moment().diff(TEST_START_TIME) : 0;

/**
 * Get the current TEST_MODE status
 * @returns {boolean} - Whether TEST_MODE is enabled
 */
function getTestMode() {
    return TEST_MODE;
}

/**
 * Get the TEST_MODE configuration
 * @returns {Object} - TEST_MODE configuration
 */
function getTestModeConfig() {
    return {
        enabled: TEST_MODE,
        startTime: TEST_MODE ? TEST_START_TIME.format('HH:mm:ss') : null,
        timezone: process.env.TEST_TIMEZONE || 'Europe/London'
    };
}

// Time utility functions
function getCurrentTime() {
    if (TEST_MODE) {
        return moment.tz(process.env.TEST_TIMEZONE || 'Europe/London').subtract(timeOffset, 'milliseconds');
    }
    return moment.tz(process.env.TEST_TIMEZONE || 'Europe/London');
}

function formatTimeRemaining(ms) {
    if (ms < 0) return '--:--:--';
    const duration = moment.duration(ms);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    // Format parts
    const parts = [];
    if (hours === 1) {
        parts.push('1h');
    } else if (hours > 1) {
        parts.push(`${hours}h`);
    }

    if (minutes > 0 || hours > 0) {
        parts.push(`${seconds > 0 ? minutes+1 : minutes}min`);
    }

    if (seconds > 0 && minutes <= 0) {
        parts.push(`${seconds}sec`);
    }

    return parts.join(' ');
}

// Logging utility functions
function logSection(title) {
    console.log('\n' + '='.repeat(40));
    console.log(`🕌 ${title.toUpperCase()} 🕌`);
    console.log('='.repeat(40));
}

function logPrayerTimesTable(timings, title) {
    console.log(`\n${title}:`);
    console.table(
        Object.entries(timings)
            .filter(([name, time]) => name !== 'sunrise')
            .map(([name, time]) => ({
                'Prayer': name.charAt(0).toUpperCase() + name.slice(1),
                'Time': time
            }))
    );
}

// Prayer icons mapping
const PRAYER_ICONS = {
    fajr: { type: 'fas', name: 'fa-sun' },
    sunrise: { type: 'mdi', name: 'mdi-weather-sunset-up' },
    zuhr: { type: 'fas', name: 'fa-sun' },
    asr: { type: 'fas', name: 'fa-cloud-sun' },
    maghrib: { type: 'mdi', name: 'mdi-weather-sunset' },
    isha: { type: 'fas', name: 'fa-moon' }
};

export {
    getCurrentTime,
    formatTimeRemaining,
    logSection,
    logPrayerTimesTable,
    PRAYER_ICONS,
    TEST_MODE,
    TEST_START_TIME,
    timeOffset,
    getTestMode,
    getTestModeConfig
}; 