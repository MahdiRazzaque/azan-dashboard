/**
 * Prayer Source Validator
 * 
 * Comprehensive validation for prayer source settings
 */

import { validateMyMasjidGuildId } from './mymasjid-provider.js';
import { validateAladhanConfig } from './aladhan-provider.js';
import { isValidTimezone } from '../utils/timezone-validator.js';

/**
 * Validates prayer source settings
 * @param {Object} settings - Prayer source settings to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
export async function validatePrayerSourceSettings(settings) {
    // Basic validation result structure
    const result = {
        isValid: true,
        errors: []
    };

    // Check if settings object exists
    if (!settings) {
        result.isValid = false;
        result.errors.push({
            field: null,
            message: 'Settings object is missing'
        });
        return result;
    }

    // Check if source is specified
    if (!settings.source) {
        result.isValid = false;
        result.errors.push({
            field: 'source',
            message: 'Prayer time source must be specified'
        });
        return result;
    }

    // Validate based on source type
    if (settings.source === 'mymasjid') {
        return validateMyMasjidSettings(settings);
    } else if (settings.source === 'aladhan') {
        return validateAladhanSettings(settings);
    } else {
        result.isValid = false;
        result.errors.push({
            field: 'source',
            message: `Invalid prayer source type: ${settings.source}`
        });
        return result;
    }
}

/**
 * Validates MyMasjid settings
 * @param {Object} settings - MyMasjid settings to validate
 * @returns {Promise<Object>} - Validation result with isValid flag and errors array
 */
async function validateMyMasjidSettings(settings) {
    const result = {
        isValid: true,
        errors: []
    };

    // Check if guildId is provided
    if (!settings.guildId) {
        result.isValid = false;
        result.errors.push({
            field: 'guildId',
            message: 'Guild ID is required for MyMasjid source'
        });
        return result;
    }

    // Validate guildId format (should be a non-empty string)
    if (typeof settings.guildId !== 'string' || settings.guildId.trim() === '') {
        result.isValid = false;
        result.errors.push({
            field: 'guildId',
            message: 'Guild ID must be a non-empty string'
        });
        return result;
    }

    // Validate guildId with API call if all basic validations pass
    if (result.isValid) {
        try {
            const apiValidation = await validateMyMasjidGuildId(settings.guildId, true);
            
            if (!apiValidation.isValid) {
                result.isValid = false;
                result.errors.push({
                    field: 'guildId',
                    message: apiValidation.error || 'Invalid Guild ID'
                });
            } else {
                // Add masjid name to the result for convenience
                result.masjidName = apiValidation.masjidName;
            }
        } catch (error) {
            result.isValid = false;
            result.errors.push({
                field: 'guildId',
                message: `Failed to validate Guild ID: ${error.message}`
            });
        }
    }

    return result;
}

/**
 * Validates Aladhan settings
 * @param {Object} settings - Aladhan settings to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
function validateAladhanSettings(settings) {
    const result = {
        isValid: true,
        errors: []
    };

    // Required parameters
    validateRequiredNumericParam(settings, 'latitude', -90, 90, result);
    validateRequiredNumericParam(settings, 'longitude', -180, 180, result);
    
    // Timezone validation
    if (!settings.timezone) {
        result.isValid = false;
        result.errors.push({
            field: 'timezone',
            message: 'Timezone is required'
        });
    } else if (typeof settings.timezone !== 'string') {
        result.isValid = false;
        result.errors.push({
            field: 'timezone',
            message: 'Timezone must be a string'
        });
    } else if (!isValidTimezone(settings.timezone)) {
        result.isValid = false;
        result.errors.push({
            field: 'timezone',
            message: `Invalid timezone: ${settings.timezone}`
        });
    }
    
    // Use the existing Aladhan validation for method IDs and other parameters
    const aladhanValidation = validateAladhanConfig(settings);
    if (!aladhanValidation.isValid) {
        result.isValid = false;
        result.errors.push({
            field: aladhanValidation.field || 'unknown',
            message: aladhanValidation.error
        });
    }
    
    // Validate iqamah offsets
    if (!settings.iqamahOffsets) {
        result.isValid = false;
        result.errors.push({
            field: 'iqamahOffsets',
            message: 'Iqamah offsets are required'
        });
    } else {
        const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
        for (const prayer of prayers) {
            validateRequiredNumericParam(
                settings.iqamahOffsets, 
                prayer, 
                0, 
                120, 
                result, 
                `iqamahOffsets.${prayer}`
            );
        }
    }

    return result;
}

/**
 * Helper function to validate a required numeric parameter
 * @param {Object} obj - Object containing the parameter
 * @param {string} param - Parameter name
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {Object} result - Validation result to update
 * @param {string} [fieldName] - Optional field name for error reporting
 */
function validateRequiredNumericParam(obj, param, min, max, result, fieldName = param) {
    if (obj[param] === undefined || obj[param] === null) {
        result.isValid = false;
        result.errors.push({
            field: fieldName,
            message: `${fieldName} is required`
        });
    } else if (typeof obj[param] !== 'number') {
        result.isValid = false;
        result.errors.push({
            field: fieldName,
            message: `${fieldName} must be a number`
        });
    } else if (obj[param] < min || obj[param] > max) {
        result.isValid = false;
        result.errors.push({
            field: fieldName,
            message: `${fieldName} must be between ${min} and ${max}`
        });
    }
} 