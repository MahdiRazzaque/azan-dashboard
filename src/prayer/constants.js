/**
 * Constants for prayer time calculation methods and parameters.
 * These are used for both backend calculations and frontend dropdown population.
 */

// Import constants from Aladhan module
import { 
    CALCULATION_METHODS,
    ASR_JURISTIC_METHODS,
    LATITUDE_ADJUSTMENT_METHODS,
    MIDNIGHT_MODES,
    IQAMAH_PRAYERS
} from './aladhan/constants.js';

// Re-export all constants for use throughout the application
export { 
    CALCULATION_METHODS,
    ASR_JURISTIC_METHODS,
    LATITUDE_ADJUSTMENT_METHODS,
    MIDNIGHT_MODES,
    IQAMAH_PRAYERS
};

/**
 * Helper function to convert constants object to array format for dropdowns
 * @param {Object} constantsObj - Object with ID keys and name values
 * @returns {Array} Array of {id, name} objects for dropdown population
 */
export function getDropdownOptions(constantsObj) {
    return Object.entries(constantsObj).map(([id, name]) => ({
        id: parseInt(id, 10),
        name
    }));
}

/**
 * Helper function to convert constants object to sorted array format for dropdowns
 * @param {Object} constantsObj - Object with ID keys and name values
 * @returns {Array} Array of {id, name} objects sorted alphabetically by name
 */
export function getSortedDropdownOptions(constantsObj) {
    return Object.entries(constantsObj)
        .map(([id, name]) => ({
            id: parseInt(id, 10),
            name
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// Pre-formatted dropdown options - sorted alphabetically
export const CALCULATION_METHOD_OPTIONS = getSortedDropdownOptions(CALCULATION_METHODS);
export const ASR_JURISTIC_METHOD_OPTIONS = getSortedDropdownOptions(ASR_JURISTIC_METHODS);
export const MIDNIGHT_MODE_OPTIONS = getSortedDropdownOptions(MIDNIGHT_MODES);

// Special handling for latitude adjustment methods - sorted alphabetically
export const LATITUDE_ADJUSTMENT_METHOD_OPTIONS = [
    { id: null, name: "None (Default)" },
    ...getSortedDropdownOptions(LATITUDE_ADJUSTMENT_METHODS)
        .filter(option => option.name !== "None") // Remove the duplicate "None" option
];

/**
 * Default values for new Aladhan configurations
 */
export const DEFAULT_ALADHAN_CONFIG = {
    calculationMethodId: 3, // Muslim World League (MWL)
    asrJuristicMethodId: 0, // Standard/Shafi'i
    latitudeAdjustmentMethodId: null, // None
    midnightModeId: 0, // Standard
    iqamahOffsets: {
        fajr: 30,
        zuhr: 30, 
        asr: 30,
        maghrib: 5,
        isha: 30
    }
}; 