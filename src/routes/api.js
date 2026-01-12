const express = require('express');
const router = express.Router();
const config = require('../config');
const { getPrayerTimes } = require('../services/prayerTimeService');
const { calculateIqamah } = require('../utils/calculations');
const { DateTime } = require('luxon');

router.get('/prayers', async (req, res) => {
  try {
    const timezone = config.location.timezone;
    const date = DateTime.now().setZone(timezone);
    
    // Fetch Data
    const rawData = await getPrayerTimes(config, date);
    
    // Process Prayers
    const prayers = {};
    const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    prayerNames.forEach(name => {
      // Normalize key casing just in case, but fetchers return lower case keys as defined in fetchers.js
      const startISO = rawData.prayers[name]; 
      
      if (!startISO) {
          console.warn(`Missing prayer time for ${name}`);
          return;
      }

      const settings = config.prayers[name];
      const iqamahISO = calculateIqamah(startISO, settings, timezone);
      
      prayers[name] = {
        start: startISO,
        iqamah: iqamahISO,
        nextChange: null 
      };
    });
    
    res.json({
      meta: {
        date: rawData.meta.date,
        location: timezone,
        source: rawData.meta.source,
        cached: rawData.meta.cached
      },
      prayers
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to retrieve prayer times. Please check logs.' 
    });
  }
});

module.exports = router;
