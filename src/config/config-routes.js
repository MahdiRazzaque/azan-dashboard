/**
 * Config API Routes
 * 
 * Provides endpoints for configuration management and setup status
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../auth/auth.js';
import { validateAladhanConfig } from '../prayer/aladhan-provider.js';
import { validateMyMasjidGuildId } from '../prayer/mymasjid-provider.js';
import { updateConfig } from './config-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} - True if file exists, false otherwise
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Setup config API routes
 * @param {Express} app - Express app instance
 */
export function setupConfigRoutes(app) {
  // Check if setup is needed (public endpoint)
  app.get('/api/config/status', async (req, res) => {
    try {
      // Check if config.json exists
      const configExists = await fileExists(CONFIG_FILE_PATH);
      
      if (configExists) {
        try {
          // Check if config.json is valid
          const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
          const config = JSON.parse(configData);
          
          // Check if config has required fields
          const needsSetup = !config || 
                            !config.prayerData || 
                            !config.prayerData.source ||
                            (config.prayerData.source === 'mymasjid' && !config.prayerData.mymasjid?.guildId) ||
                            (config.prayerData.source === 'aladhan' && !config.prayerData.aladhan?.latitude);
          
          res.json({ 
            needsSetup,
            configExists: true,
            configValid: !needsSetup
          });
        } catch (error) {
          // Config file exists but is invalid
          res.json({ 
            needsSetup: true,
            configExists: true,
            configValid: false,
            error: 'Invalid config file format'
          });
        }
      } else {
        // Config file doesn't exist
        res.json({ 
          needsSetup: true,
          configExists: false
        });
      }
    } catch (error) {
      console.error('Error checking config status:', error);
      res.status(500).json({ 
        error: 'Failed to check config status',
        details: error.message
      });
    }
  });
  
  // Get config (protected endpoint)
  app.get('/api/config', requireAuth, async (req, res) => {
    try {
      // Check if config.json exists
      const configExists = await fileExists(CONFIG_FILE_PATH);
      
      if (configExists) {
        try {
          // Read and parse config.json
          const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
          const config = JSON.parse(configData);
          
          // Remove sensitive data before sending
          const sanitizedConfig = { ...config };
          
          // Remove any sensitive fields
          if (sanitizedConfig.auth) {
            delete sanitizedConfig.auth.adminPasswordHash;
            delete sanitizedConfig.auth.salt;
          }
          
          res.json(sanitizedConfig);
        } catch (error) {
          res.status(400).json({ 
            error: 'Invalid config file format',
            details: error.message
          });
        }
      } else {
        res.status(404).json({ error: 'Config file not found' });
      }
    } catch (error) {
      console.error('Error getting config:', error);
      res.status(500).json({ 
        error: 'Failed to get config',
        details: error.message
      });
    }
  });

  /**
   * Setup configuration
   * @route POST /api/config/setup
   * @param {Object} req.body - Configuration object
   * @returns {Object} Success status
   */
  app.post('/api/config/setup', async (req, res) => {
    try {
      const { source, mymasjid, aladhan } = req.body;
      
      if (!source) {
        return res.status(400).json({ success: false, error: 'Source is required' });
      }
      
      // Create a complete config object with all required fields
      const defaultConfig = {
        features: {
          azanEnabled: true,
          announcementEnabled: true,
          systemLogsEnabled: true
        },
        auth: {
          sessionTimeout: 3600000,
          maxSessions: 5
        },
        prayerSettings: {
          prayers: {
            fajr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
            zuhr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
            asr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
            maghrib: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
            isha: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false }
          },
          globalAzanEnabled: true,
          globalAnnouncementEnabled: true
        },
        updatedAt: new Date().toISOString()
      };
      
      if (source === 'mymasjid') {
        if (!mymasjid?.guildId) {
          return res.status(400).json({ success: false, error: 'Guild ID is required' });
        }
        
        // Validate guild ID
        try {
          const isValid = await validateMyMasjidGuildId(mymasjid.guildId);
          if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid Guild ID' });
          }
        } catch (error) {
          console.error('Error validating guild ID:', error);
          return res.status(500).json({ success: false, error: 'Failed to validate Guild ID' });
        }
        
        // Create full config with prayerData section
        defaultConfig.prayerData = {
          source: 'mymasjid',
          mymasjid: {
            guildId: mymasjid.guildId
          }
        };
        
        // Create config
        try {
          // Write the complete config file directly
          const fs = await import('fs/promises');
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');
          
          await fs.writeFile(
            CONFIG_FILE_PATH,
            JSON.stringify(defaultConfig, null, 2),
            'utf8'
          );
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Error updating config:', error);
          return res.status(500).json({ success: false, error: 'Failed to update configuration' });
        }
      } else if (source === 'aladhan') {
        // Validate Aladhan config
        const validation = validateAladhanConfig(aladhan);
        if (!validation.isValid) {
          return res.status(400).json({ success: false, error: validation.error });
        }
        
        // Create full config with prayerData section
        defaultConfig.prayerData = {
          source: 'aladhan',
          aladhan: {
            latitude: aladhan.latitude,
            longitude: aladhan.longitude,
            timezone: aladhan.timezone,
            calculationMethodId: aladhan.calculationMethodId,
            asrJuristicMethodId: aladhan.asrJuristicMethodId,
            latitudeAdjustmentMethodId: aladhan.latitudeAdjustmentMethodId,
            midnightModeId: aladhan.midnightModeId,
            iqamahOffsets: {
              fajr: aladhan.iqamahOffsets.fajr,
              zuhr: aladhan.iqamahOffsets.zuhr,
              asr: aladhan.iqamahOffsets.asr,
              maghrib: aladhan.iqamahOffsets.maghrib,
              isha: aladhan.iqamahOffsets.isha
            }
          }
        };
        
        // Create config
        try {
          // Write the complete config file directly
          const fs = await import('fs/promises');
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');
          
          await fs.writeFile(
            CONFIG_FILE_PATH,
            JSON.stringify(defaultConfig, null, 2),
            'utf8'
          );
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Error updating config:', error);
          return res.status(500).json({ success: false, error: 'Failed to update configuration' });
        }
      } else {
        return res.status(400).json({ success: false, error: 'Invalid source' });
      }
    } catch (error) {
      console.error('Error setting up configuration:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Get prayer status
   * @route GET /api/prayer/status
   * @returns {Object} Status object with ready flag
   */
  app.get('/api/prayer/status', async (req, res) => {
    try {
      const prayerTimesPath = path.join(__dirname, '../../prayer_times.json');
      const exists = await fileExists(prayerTimesPath);
      
      if (!exists) {
        return res.json({ ready: false });
      }
      
      const content = await fs.readFile(prayerTimesPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.validated) {
        return res.json({ ready: true });
      } else {
        return res.json({ ready: false });
      }
    } catch (error) {
      console.error('Error checking prayer status:', error);
      return res.json({ ready: false, error: error.message });
    }
  });

  /**
   * Validate MyMasjid Guild ID
   * @route GET /api/prayer/validate-guildid
   * @param {string} guildId - Guild ID to validate
   * @returns {Object} Validation result
   */
  app.get('/api/prayer/validate-guildid', async (req, res) => {
    try {
      const { guildId } = req.query;
      
      if (!guildId) {
        return res.status(400).json({ valid: false, error: 'Guild ID is required' });
      }
      
      try {
        const isValid = await validateMyMasjidGuildId(guildId);
        return res.json({ valid: isValid });
      } catch (error) {
        console.error('Error validating Guild ID:', error);
        return res.status(500).json({ valid: false, error: error.message });
      }
    } catch (error) {
      console.error('Error validating Guild ID:', error);
      return res.status(500).json({ valid: false, error: error.message });
    }
  });

  // Update feature flags
  app.post('/api/config/features', requireAuth, async (req, res) => {
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
  app.post('/api/config/prayer-settings', requireAuth, async (req, res) => {
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
}
