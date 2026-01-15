const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken'); // Added
const authenticateToken = require('../middleware/auth'); // Added
// Config loaded dynamically in handlers due to reload requirements
const { getPrayerTimes, forceRefresh } = require('../services/prayerTimeService');
const { calculateIqamah, calculateNextPrayer } = require('../utils/calculations');
const { DateTime } = require('luxon');
const multer = require('multer');
const schedulerService = require('../services/schedulerService');
const sseService = require('../services/sseService');
const automationService = require('../services/automationService'); // Added
const audioAssetService = require('../services/audioAssetService'); // Added
const envManager = require('../utils/envManager'); // Added
const { hashPassword, verifyPassword } = require('../utils/auth'); // Added
const fetchers = require('../services/fetchers'); // Added
const fs = require('fs');
const path = require('path');
const configService = require('../config'); // Singleton instance

// Auth Routes
router.get('/auth/status', (req, res) => {
    res.json({ 
        configured: envManager.isConfigured(),
        requiresSetup: !process.env.ADMIN_PASSWORD
    });
});

router.post('/auth/setup', (req, res) => {
    // Only allow if NOT configured
    if (process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'System already configured. Login to change settings.' });
    }

    const { password } = req.body;
    if (!password || password.length < 5) {
        return res.status(400).json({ error: 'Password too short' });
    }

    try {
        const hashed = hashPassword(password);
        envManager.setEnvValue('ADMIN_PASSWORD', hashed);
        
        // Auto-generate JWT Secret if missing
        let jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            jwtSecret = envManager.generateSecret();
            envManager.setEnvValue('JWT_SECRET', jwtSecret);
        }

        // Auto-login logic
        const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '24h' });
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({ success: true, message: 'Structure secured and logged in.' });
    } catch (e) {
        console.error("Setup Error:", e);
        res.status(500).json({ error: 'Failed to write configuration' });
    }
});

router.post('/auth/change-password', authenticateToken, (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Missing password' });

    try {
        const hashed = hashPassword(password);
        envManager.setEnvValue('ADMIN_PASSWORD', hashed);
        res.json({ success: true, message: 'Password updated' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update password' });
    }
});

router.post('/auth/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        // If no password set, return specific code to trigger setup flow
        return res.status(500).json({ 
            error: 'Server authentication not configured', 
            code: 'SETUP_REQUIRED' 
        });
    }

    if (verifyPassword(password, adminPassword)) {
        const secret = process.env.JWT_SECRET || adminPassword;
        const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '24h' });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });
        
        return res.json({ success: true });
    }
    
    res.status(401).json({ error: 'Invalid password' });
});

router.post('/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});

router.get('/auth/check', authenticateToken, (req, res) => {
    res.json({ authenticated: true });
});

// System Routes
router.get('/system/audio-files', authenticateToken, (req, res) => {
    const customDir = path.join(__dirname, '../../public/audio/custom');
    const cacheDir = path.join(__dirname, '../../public/audio/cache');
    
    if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const getFiles = (dir, type) => {
        return fs.readdirSync(dir)
            .filter(f => f.endsWith('.mp3'))
            .map(f => ({ name: f, type, path: `${type}/${f}` }));
    };
    
    const custom = getFiles(customDir, 'custom').map(f => ({ ...f, url: `/public/audio/custom/${f.name}` }));
    const cache = getFiles(cacheDir, 'cache').map(f => ({ ...f, url: `/public/audio/cache/${f.name}` }));
    
    res.json([...custom, ...cache]);
});

const healthCheck = require('../services/healthCheck'); // Added

// Heatlh Routes
router.get('/system/health', (req, res) => {
    res.json(healthCheck.getHealth());
});

router.post('/system/health/refresh', authenticateToken, async (req, res) => {
    const { target } = req.body;
    try {
        const result = await healthCheck.refresh(target || 'all');
        res.json(result);
    } catch (e) {
       res.status(500).json({ error: e.message });
    }
});

const diagnosticsService = require('../services/diagnosticsService');

router.get('/system/jobs', authenticateToken, (req, res) => {
    // getJobs might not be defined if schedulerService mock or older version loaded? 
    // We updated it.
    if (schedulerService.getJobs) {
        res.json(schedulerService.getJobs());
    } else {
        res.json({ maintenance: [], automation: [] });
    }
});

router.get('/system/status/automation', authenticateToken, async (req, res) => {
    try {
        const config = configService.get();
        const status = await diagnosticsService.getAutomationStatus(config);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/system/status/tts', authenticateToken, async (req, res) => {
    try {
        const config = configService.get();
        const status = await diagnosticsService.getTTSStatus(config);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/system/regenerate-tts', authenticateToken, async (req, res) => {
    try {
        await audioAssetService.syncAudioAssets(true);
        res.json({ success: true, message: 'Audio assets cleared and synchronised.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/system/restart-scheduler', authenticateToken, async (req, res) => {
    try {
        await schedulerService.hotReload();
        res.json({ success: true, message: 'Scheduler restarted.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/system/test-audio', authenticateToken, async (req, res) => {
    const { filename, type } = req.body; 
    if (!filename || !type) return res.status(400).json({ error: 'Missing filename or type' });
    
    // Sanitize type
    if (!['custom', 'cache'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const filePath = path.join(__dirname, `../../public/audio/${type}/${filename}`);
    
    // Sanitize filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
         return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    
    try {
        if (automationService.playTestAudio) {
            automationService.playTestAudio(filePath); 
        }
        res.json({ success: true, message: 'Playing audio on server...' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/system/validate-url', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ valid: false, error: 'URL is required' });

    try {
        await axios.head(url, { timeout: 5000 });
        res.json({ valid: true });
    } catch (e) {
        // Retry with GET if HEAD fails (some servers block HEAD)
        try {
            await axios.get(url, { timeout: 5000, responseType: 'stream' }); // Stream to avoid downloading large file
            res.json({ valid: true });
        } catch (e2) {
             const msg = e2.response ? `Status ${e2.response.status}` : e2.message;
             res.json({ valid: false, error: msg });
        }
    }
});

router.delete('/settings/files', authenticateToken, (req, res) => {
     const { filename } = req.body;
     if (!filename) return res.status(400).json({ error: 'Missing filename' });
     
     const filePath = path.join(__dirname, '../../public/audio/custom', filename);
     
     if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
         return res.status(400).json({ error: 'Invalid filename' });
     }
 
     if (fs.existsSync(filePath)) {
         try {
             fs.unlinkSync(filePath);
             res.json({ success: true, message: 'File deleted' });
         } catch (e) {
             res.status(500).json({ error: 'Delete failed' });
         }
     } else {
         res.status(404).json({ error: 'File not found' });
     }
 });

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/audio/custom');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3')) {
            cb(null, true);
        } else {
            cb(new Error('Only mp3 files allowed'));
        }
    }
});

// Settings & Logs Routes

router.get('/logs', (req, res) => {
    sseService.addClient(res);
});

router.get('/settings', authenticateToken, (req, res) => {
    res.json(configService.get());
});

router.post('/settings/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ 
        message: 'File uploaded successfully', 
        filename: req.file.originalname, 
        path: `custom/${req.file.originalname}` 
    });
});

router.post('/settings/update', authenticateToken, async (req, res) => {
    try {
        const newConfig = req.body;
        // Basic validation: Check if it's an object
        if (typeof newConfig !== 'object' || newConfig === null) {
            return res.status(400).json({ error: 'Invalid configuration format' });
        }

        // --- VALIDATION LOGIC START ---
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Validating Configuration...' } });
        
        if (newConfig.sources && newConfig.sources.primary) {
            const sourceType = newConfig.sources.primary.type;
            const now = DateTime.now();
            
            // Construct a temporary config for fetchers to use
            const tempConfig = JSON.parse(JSON.stringify(newConfig));
            
            if (sourceType === 'mymasjid') {
                const masjidId = newConfig.sources.primary.masjidId;
                if (!masjidId) return res.status(400).json({ error: "Masjid ID is required for MyMasjid source" });
                
                // Validate Fetch
                console.log(`[Validation] Testing MyMasjid with ID: ${masjidId}`);
                await fetchers.fetchMyMasjidBulk(tempConfig); 
            } else if (sourceType === 'aladhan') {
                // Validate Fetch
                console.log(`[Validation] Testing Aladhan with Coordinates: ${JSON.stringify(newConfig.location.coordinates)}`);
                await fetchers.fetchAladhanAnnual(tempConfig, now.year);
            }
        }
        // --- VALIDATION LOGIC END ---

        const localPath = path.join(__dirname, '../config/local.json');
        
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Saving to Disk...' } });

        // Use ConfigService to update and save
        await configService.update(newConfig);
        
        // Force refresh cache with NEW config immediately
        console.log('[API] Settings updated, forcing cache refresh...');
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Refreshing Prayer Data...' } });
        
        const result = await forceRefresh(configService.get());
        
        // Hot reload the scheduler (it will internally load the fresh config via get())
        // Scheduler initialization includes heavy TTS generation
        console.log('[API] Hot reloading scheduler...');
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Generating Audio Assets...' } });
        
        try {
            await audioAssetService.syncAudioAssets();
        } catch (err) {
            console.error('[API] Audio asset synchronization failed:', err.message);
            // Non-fatal, proceed to restart scheduler
        }

        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Restarting Scheduler...' } });
        await schedulerService.initScheduler(); 

        // Calculate Warnings based on System Health
        const warnings = [];
        const health = healthCheck.getHealth();
        
        if (newConfig.automation && newConfig.automation.triggers) {
            Object.entries(newConfig.automation.triggers).forEach(([prayer, triggers]) => {
                Object.entries(triggers).forEach(([type, trigger]) => {
                    if (!trigger.enabled) return;
                     const niceName = `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} ${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;

                    if (trigger.type === 'tts' && !health.tts) {
                        warnings.push(`${niceName}: TTS Service is offline`);
                    }
                    if (trigger.targets && trigger.targets.includes('local') && !health.local) {
                        warnings.push(`${niceName}: Local Audio Service is offline`);
                    }
                    if ((trigger.targets?.includes('voiceMonkey') || trigger.type === 'voiceMonkey') && !health.voiceMonkey) {
                         warnings.push(`${niceName}: VoiceMonkey Service is offline`);
                    }
                });
            });
        }
        
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Configuration Saved' } });
        
        res.json({ 
            message: 'Settings validated, updated, and cache refreshed.',
            meta: result.meta,
            warnings: warnings
        });
    } catch (e) {
        console.error('Settings Update Error:', e);
        // Distinguish validation errors
        if (e.message.includes('Schema') || e.message.includes('API Error') || e.message.includes('Validation Failed')) {
            return res.status(400).json({ error: `Validation Failed: ${e.message}` });
        }
        res.status(500).json({ error: e.message });
    }
});

router.post('/settings/reset', authenticateToken, async (req, res) => {
    try {
        const localPath = path.join(__dirname, '../config/local.json');
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log('[API] local.json deleted. Reverting to default.');
        }

        // Reload Config Service
        await configService.reload();

        // Force refresh system
        console.log('[API] Settings reset, forcing cache refresh...');
        const result = await forceRefresh(configService.get());
        
        try {
            await audioAssetService.syncAudioAssets();
        } catch(e) { console.error(e); }

        await schedulerService.initScheduler(); 

        res.json({ message: 'Settings reset to defaults.', meta: result.meta });
    } catch (e) {
        console.error('Settings Reset Error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/settings/refresh-cache', authenticateToken, async (req, res) => {
    try {
        console.log('[API] Force refreshing cache...');
        await configService.reload(); // Reload from disk just in case
        const config = configService.get(); 
        // Force refresh deletes cache and fetches new data
        // Force refresh deletes cache and fetches new data
        const result = await forceRefresh(config);
        
        // Stop existing scheduler jobs using the currently loaded instance
        try {
            if (schedulerService.stopAll) {
                console.log('[API] Stopping existing scheduler jobs (Refresh Cache)...');
                await schedulerService.stopAll();
            }
        } catch (stopErr) {
            console.error('[API] Failed to stop existing scheduler:', stopErr);
        }

        // Initialize the new scheduler instance
        try {
           await audioAssetService.syncAudioAssets();
        } catch (e) {
             console.error('[API] Audio asset synchronization failed:', e);
        }
        await schedulerService.initScheduler(); 
        
        res.json({ 
            message: 'Cache refreshed and scheduler reloaded',
            meta: result.meta 
        });
    } catch (e) {
        console.error('[API] Force Refresh Error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/prayers', async (req, res) => {
  try {
    const config = configService.get();
    const timezone = config.location.timezone;
    const now = DateTime.now().setZone(timezone);
    
    // Fetch Data for Today
    const rawData = await getPrayerTimes(config, now);
    
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
      
      let iqamahISO;
      // Use explicit Iqamah from source if available (FR-05)
      // rawData.prayers has structure { fajr: '...', iqamah: { fajr: '...' }, ... }
      if (rawData.prayers.iqamah && rawData.prayers.iqamah[name]) {
          iqamahISO = rawData.prayers.iqamah[name];
      } else {
          // Fallback to calculation
          const settings = config.prayers[name];
          iqamahISO = calculateIqamah(startISO, settings, timezone);
      }
      
      prayers[name] = {
        start: startISO,
        iqamah: iqamahISO
      };
    });

    // Calculate Next Prayer
    let nextPrayer = calculateNextPrayer(prayers, now);

    // If no next prayer today (post-Isha), fetch Tomorrow's Fajr
    if (!nextPrayer) {
        try {
            const tomorrow = now.plus({ days: 1 });
            const tomorrowData = await getPrayerTimes(config, tomorrow);
            
            if (tomorrowData && tomorrowData.prayers && tomorrowData.prayers.fajr) {
                nextPrayer = {
                    name: 'fajr',
                    time: tomorrowData.prayers.fajr,
                    isTomorrow: true
                };
            }
        } catch (tomorrowError) {
            console.error(`Failed to fetch tomorrow's schedule: ${tomorrowError.message}`);
        }
    }
    
    res.json({
      meta: {
        date: rawData.meta.date,
        location: timezone,
        source: rawData.meta.source,
        cached: rawData.meta.cached
      },
      prayers,
      nextPrayer
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
