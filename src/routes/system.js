const express = require('express');
const router = express.Router();
const { 
  CALCULATION_METHODS, 
  ASR_JURISTIC_METHODS, 
  LATITUDE_ADJUSTMENT_METHODS, 
  MID_NIGHT_MODES, // Note: PRD says MIDNIGHT_MODES, constants.js might use MIDNIGHT_MODES
  MIDNIGHT_MODES 
} = require('../utils/constants');
const authenticateToken = require('../middleware/auth');
const fetchers = require('../services/fetchers');
const healthCheck = require('../services/healthCheck');
const configService = require('../config');
const { DateTime } = require('luxon');
const { operationsLimiter } = require('../middleware/rateLimiters');

// Helper to convert map to array of objects object { id, label } and sort by label
const toSortedArray = (obj) => {
  if (!obj) return [];
  return Object.entries(obj)
    .map(([id, label]) => ({ id: parseInt(id), label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

// GET /api/system/constants
router.get('/constants', authenticateToken, (req, res) => {
  try {
    const response = {
      calculationMethods: toSortedArray(CALCULATION_METHODS),
      madhabs: toSortedArray(ASR_JURISTIC_METHODS),
      latitudeAdjustments: toSortedArray(LATITUDE_ADJUSTMENT_METHODS),
      midnightModes: toSortedArray(MIDNIGHT_MODES)
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching system constants:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/system/source/test
router.post('/source/test', operationsLimiter, authenticateToken, async (req, res) => {
  const { target } = req.body;
  if (!target || !['primary', 'backup'].includes(target)) {
    return res.status(400).json({ success: false, error: 'Invalid target. Expected "primary" or "backup".' });
  }

  try {
    await configService.reload();
    const config = configService.get();
    const targetSource = config.sources[target];

    if (!targetSource) {
      return res.status(400).json({ success: false, error: `Source "${target}" is not configured.` });
    }

    if (target === 'backup' && targetSource.enabled === false) {
      return res.status(400).json({ success: false, error: 'Backup source is currently disabled.' });
    }

    const type = targetSource.type;
    let result;

    if (type === 'aladhan') {
      const year = DateTime.now().setZone(config.location.timezone).year;
      result = await fetchers.fetchAladhanAnnual(config, year);
    } else if (type === 'mymasjid') {
      result = await fetchers.fetchMyMasjidBulk(config);
    } else {
      return res.status(400).json({ success: false, error: `Unsupported source type: ${type}` });
    }

    const daysCount = Object.keys(result).length;

    // Update Health Cache after successful manual test
    await healthCheck.refresh(target === 'primary' ? 'primarySource' : 'backupSource');

    res.json({
      success: true,
      message: `Source responded with ${daysCount} days of data.`
    });
  } catch (error) {
    console.error(`[Source Test] Error testing ${target}:`, error.message);
    
    // Update Health Cache on failure too
    try {
        await healthCheck.refresh(target === 'primary' ? 'primarySource' : 'backupSource');
    } catch(e) { /* ignore */ }

    res.status(500).json({ 
      success: false, 
      error: error.message || 'API Error' 
    });
  }
});

module.exports = router;
