/**
 * Utilities for validating configuration against the schema.
 */
import { configSchema, myMasjidSchema, aladhanSchema } from './schema.js';
import { CALCULATION_METHODS, ASR_JURISTIC_METHODS, LATITUDE_ADJUSTMENT_METHODS, MIDNIGHT_MODES } from '../prayer/aladhan/constants.js';

/**
 * Validates a value against a schema field.
 * @param {*} value - The value to validate.
 * @param {Object} schemaField - The schema field to validate against.
 * @param {string} fieldName - The name of the field being validated.
 * @returns {Object} - Object with isValid and error properties.
 */
function validateField(value, schemaField, fieldName) {
  // Check required
  if (schemaField.required && (value === undefined || value === null)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  // If not required and not provided, it's valid
  if (!schemaField.required && (value === undefined || value === null)) {
    return { isValid: true };
  }

  // Check type
  if (schemaField.type === 'string' && typeof value !== 'string') {
    return { isValid: false, error: `${fieldName} must be a string` };
  }
  if (schemaField.type === 'number' && typeof value !== 'number') {
    return { isValid: false, error: `${fieldName} must be a number` };
  }
  if (schemaField.type === 'boolean' && typeof value !== 'boolean') {
    return { isValid: false, error: `${fieldName} must be a boolean` };
  }
  if (schemaField.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    return { isValid: false, error: `${fieldName} must be an object` };
  }

  // Check enum
  if (schemaField.enum && !schemaField.enum.includes(value)) {
    return { isValid: false, error: `${fieldName} must be one of: ${schemaField.enum.join(', ')}` };
  }

  // Check min/max for numbers
  if (schemaField.type === 'number') {
    if (schemaField.min !== undefined && value < schemaField.min) {
      return { isValid: false, error: `${fieldName} must be at least ${schemaField.min}` };
    }
    if (schemaField.max !== undefined && value > schemaField.max) {
      return { isValid: false, error: `${fieldName} must be at most ${schemaField.max}` };
    }
  }

  // Check nested schema for objects
  if (schemaField.type === 'object' && schemaField.properties) {
    const result = validateObject(value, schemaField.properties, fieldName);
    if (!result.isValid) {
      return result;
    }
  }

  // Check nested schema reference
  if (schemaField.type === 'object' && schemaField.schema) {
    const result = validateObject(value, schemaField.schema, fieldName);
    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}

/**
 * Validates an object against a schema.
 * @param {Object} obj - The object to validate.
 * @param {Object} schema - The schema to validate against.
 * @param {string} [prefix=''] - Prefix for field names in error messages.
 * @returns {Object} - Object with isValid and error properties.
 */
function validateObject(obj, schema, prefix = '') {
  for (const [key, schemaField] of Object.entries(schema)) {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    const result = validateField(obj[key], schemaField, fieldName);
    if (!result.isValid) {
      return result;
    }
  }
  return { isValid: true };
}

/**
 * Validates a timezone string.
 * @param {string} timezone - The timezone to validate.
 * @returns {boolean} - Whether the timezone is valid.
 */
export function isValidTimeZone(timezone) {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (ex) {
    return false;
  }
}

/**
 * Validates the Aladhan-specific parameters.
 * @param {Object} aladhanConfig - The Aladhan configuration to validate.
 * @returns {Object} - Object with isValid and error properties.
 */
export function validateAladhanConfig(aladhanConfig) {
  // Basic schema validation
  const schemaResult = validateObject(aladhanConfig, aladhanSchema, 'aladhan');
  if (!schemaResult.isValid) {
    return schemaResult;
  }

  // Validate timezone
  if (!isValidTimeZone(aladhanConfig.timezone)) {
    return { isValid: false, error: 'Invalid timezone. Please provide a valid IANA timezone name.' };
  }

  // Validate calculation method
  if (!CALCULATION_METHODS[aladhanConfig.calculationMethodId]) {
    return { isValid: false, error: 'Invalid calculation method ID.' };
  }

  // Validate Asr juristic method
  if (!ASR_JURISTIC_METHODS[aladhanConfig.asrJuristicMethodId]) {
    return { isValid: false, error: 'Invalid Asr juristic method ID.' };
  }

  // Validate latitude adjustment method if provided
  if (aladhanConfig.latitudeAdjustmentMethodId !== null && 
      aladhanConfig.latitudeAdjustmentMethodId !== undefined && 
      !LATITUDE_ADJUSTMENT_METHODS[aladhanConfig.latitudeAdjustmentMethodId]) {
    return { isValid: false, error: 'Invalid latitude adjustment method ID.' };
  }

  // Validate midnight mode
  if (!MIDNIGHT_MODES[aladhanConfig.midnightModeId]) {
    return { isValid: false, error: 'Invalid midnight mode ID.' };
  }

  // Validate iqamah offsets are numbers
  const { iqamahOffsets } = aladhanConfig;
  if (!iqamahOffsets || typeof iqamahOffsets !== 'object') {
    return { isValid: false, error: 'Iqamah offsets must be provided as an object.' };
  }

  const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
  for (const prayer of prayers) {
    if (typeof iqamahOffsets[prayer] !== 'number') {
      return { isValid: false, error: `Iqamah offset for ${prayer} must be a number.` };
    }
  }

  return { isValid: true };
}

/**
 * Validates the MyMasjid-specific parameters.
 * @param {Object} myMasjidConfig - The MyMasjid configuration to validate.
 * @returns {Object} - Object with isValid and error properties.
 */
export function validateMyMasjidConfig(myMasjidConfig) {
  // Basic schema validation
  const schemaResult = validateObject(myMasjidConfig, myMasjidSchema, 'mymasjid');
  if (!schemaResult.isValid) {
    return schemaResult;
  }

  // Additional validation for guildId format could be added here
  // For now, we'll just check that it's not empty
  if (!myMasjidConfig.guildId.trim()) {
    return { isValid: false, error: 'Guild ID cannot be empty.' };
  }

  return { isValid: true };
}

/**
 * Validates the entire configuration.
 * @param {Object} config - The configuration to validate.
 * @returns {Object} - Object with isValid and error properties.
 */
export function validateConfig(config) {
  // Basic schema validation
  const schemaResult = validateObject(config, configSchema);
  if (!schemaResult.isValid) {
    return schemaResult;
  }

  // Validate source-specific configuration
  const { source } = config.prayerData;
  
  if (source === 'mymasjid') {
    if (!config.prayerData.mymasjid) {
      return { isValid: false, error: 'MyMasjid configuration is required when source is "mymasjid".' };
    }
    return validateMyMasjidConfig(config.prayerData.mymasjid);
  }
  
  if (source === 'aladhan') {
    if (!config.prayerData.aladhan) {
      return { isValid: false, error: 'Aladhan configuration is required when source is "aladhan".' };
    }
    return validateAladhanConfig(config.prayerData.aladhan);
  }

  return { isValid: true };
} 