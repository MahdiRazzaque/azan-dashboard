const express = require('express');
const router = express.Router();
const { 
  CALCULATION_METHODS, 
  ASR_JURISTIC_METHODS, 
  LATITUDE_ADJUSTMENT_METHODS, 
  MIDNIGHT_MODES 
} = require('../utils/constants');
const authenticateToken = require('../middleware/auth');

// Helper to convert map to array of objects object { id, label } and sort by label
const toSortedArray = (obj) => {
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

module.exports = router;
