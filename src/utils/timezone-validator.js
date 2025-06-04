/**
 * Timezone Validator Utility
 * 
 * Validates IANA timezone strings
 */

// List of valid IANA timezone identifiers
// This is a subset of common timezones - in a production app, you might want to use a more comprehensive list
// or a library like moment-timezone
const VALID_TIMEZONES = [
    // Africa
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Algiers', 'Africa/Cairo', 'Africa/Casablanca', 
    'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Tunis',
    
    // America
    'America/Anchorage', 'America/Bogota', 'America/Buenos_Aires', 'America/Caracas', 
    'America/Chicago', 'America/Denver', 'America/Edmonton', 'America/Halifax', 
    'America/Los_Angeles', 'America/Mexico_City', 'America/New_York', 'America/Phoenix', 
    'America/Santiago', 'America/Sao_Paulo', 'America/St_Johns', 'America/Toronto', 'America/Vancouver',
    
    // Asia
    'Asia/Baghdad', 'Asia/Baku', 'Asia/Bangkok', 'Asia/Beirut', 'Asia/Dhaka', 'Asia/Dubai', 
    'Asia/Hong_Kong', 'Asia/Istanbul', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kabul', 
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Kuwait', 'Asia/Manila', 
    'Asia/Muscat', 'Asia/Qatar', 'Asia/Riyadh', 'Asia/Seoul', 'Asia/Shanghai', 
    'Asia/Singapore', 'Asia/Taipei', 'Asia/Tehran', 'Asia/Tokyo', 'Asia/Yekaterinburg',
    
    // Australia
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin', 'Australia/Melbourne', 
    'Australia/Perth', 'Australia/Sydney',
    
    // Europe
    'Europe/Amsterdam', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Brussels', 
    'Europe/Bucharest', 'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Helsinki', 
    'Europe/Istanbul', 'Europe/Kaliningrad', 'Europe/Kiev', 'Europe/Lisbon', 'Europe/London', 
    'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris', 'Europe/Prague', 
    'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
    
    // Pacific
    'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Midway', 
    'Pacific/Samoa',
    
    // Others
    'UTC', 'GMT'
];

/**
 * Validates if a string is a valid IANA timezone identifier
 * @param {string} timezone - The timezone string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidTimezone(timezone) {
    if (!timezone || typeof timezone !== 'string') {
        return false;
    }
    
    // Check if timezone is in our list of valid timezones
    if (VALID_TIMEZONES.includes(timezone)) {
        return true;
    }
    
    // If not in our static list, try to use the built-in Intl API to validate
    try {
        // This will throw an error if the timezone is invalid
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Gets a list of valid IANA timezone identifiers
 * @returns {string[]} - Array of valid timezone strings
 */
export function getValidTimezones() {
    return VALID_TIMEZONES;
} 