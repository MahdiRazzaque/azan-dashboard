import moment from 'moment-timezone';

// Define TEST_MODE
const TEST_MODE = true; // Set to true to enable test mode
const TEST_START_TIME = TEST_MODE ? 
  moment.tz('02:00:00', 'HH:mm:ss', 'Europe/London') : 
  null;
const timeOffset = TEST_MODE ? moment().diff(TEST_START_TIME) : 0;

// Time utility functions
function getCurrentTime() {
    if (TEST_MODE) {
        return moment.tz('Europe/London').subtract(timeOffset, 'milliseconds');
    }
    return moment.tz('Europe/London');
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
    timeOffset
}; 