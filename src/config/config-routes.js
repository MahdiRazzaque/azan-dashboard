import express from 'express';
import { getConfig, updateConfig } from './config-service.js';
import { requireAuth } from '../auth/auth.js';

const router = express.Router();

// Get full configuration
router.get('/api/config', requireAuth, async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error retrieving config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve configuration'
    });
  }
});

// Update feature flags
router.post('/api/config/features', requireAuth, async (req, res) => {
  try {
    const features = req.body;
    const updatedConfig = await updateConfig('features', features);
    
    res.json({ 
      success: true, 
      message: 'Features updated successfully',
      data: updatedConfig.features
    });
  } catch (error) {
    console.error('Error updating features:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update features'
    });
  }
});

// Update prayer settings
router.post('/api/config/prayer-settings', requireAuth, async (req, res) => {
  try {
    const prayerSettings = req.body;
    const updatedConfig = await updateConfig('prayerSettings', prayerSettings);
    
    res.json({ 
      success: true, 
      message: 'Prayer settings updated successfully',
      data: updatedConfig.prayerSettings
    });
  } catch (error) {
    console.error('Error updating prayer settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update prayer settings'
    });
  }
});

export default router;
