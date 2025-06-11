import express from 'express';
import { 
    CALCULATION_METHOD_OPTIONS,
    ASR_JURISTIC_METHOD_OPTIONS,
    LATITUDE_ADJUSTMENT_METHOD_OPTIONS,
    MIDNIGHT_MODE_OPTIONS,
    DEFAULT_ALADHAN_CONFIG
} from './constants.js';

const router = express.Router();

/**
 * Get all calculation method options
 * @route GET /api/prayer/constants/calculation-methods
 * @returns {Array} Array of calculation method options
 */
router.get('/calculation-methods', (req, res) => {
    res.json(CALCULATION_METHOD_OPTIONS);
});

/**
 * Get all Asr juristic method options
 * @route GET /api/prayer/constants/asr-methods
 * @returns {Array} Array of Asr juristic method options
 */
router.get('/asr-methods', (req, res) => {
    res.json(ASR_JURISTIC_METHOD_OPTIONS);
});

/**
 * Get all latitude adjustment method options
 * @route GET /api/prayer/constants/latitude-adjustments
 * @returns {Array} Array of latitude adjustment method options
 */
router.get('/latitude-adjustments', (req, res) => {
    res.json(LATITUDE_ADJUSTMENT_METHOD_OPTIONS);
});

/**
 * Get all midnight mode options
 * @route GET /api/prayer/constants/midnight-modes
 * @returns {Array} Array of midnight mode options
 */
router.get('/midnight-modes', (req, res) => {
    res.json(MIDNIGHT_MODE_OPTIONS);
});

/**
 * Get default Aladhan configuration
 * @route GET /api/prayer/constants/default-config
 * @returns {Object} Default Aladhan configuration
 */
router.get('/default-config', (req, res) => {
    res.json(DEFAULT_ALADHAN_CONFIG);
});

/**
 * Get all constants in a single request
 * @route GET /api/prayer/constants/all
 * @returns {Object} All constants
 */
router.get('/all', (req, res) => {
    res.json({
        calculationMethods: CALCULATION_METHOD_OPTIONS,
        asrJuristicMethods: ASR_JURISTIC_METHOD_OPTIONS,
        latitudeAdjustmentMethods: LATITUDE_ADJUSTMENT_METHOD_OPTIONS,
        midnightModes: MIDNIGHT_MODE_OPTIONS,
        defaultConfig: DEFAULT_ALADHAN_CONFIG
    });
});

export default router; 