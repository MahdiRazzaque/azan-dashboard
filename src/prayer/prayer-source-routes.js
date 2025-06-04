import { requireAuth } from '../auth/auth.js';
import { getConfig, updateConfig } from '../config/config-service.js';
import { refreshPrayerData, getPrayerDataSourceInfo } from './prayer-data-provider.js';
import { validateAladhanConfig } from './aladhan-provider.js';
import { validateMyMasjidGuildId } from './mymasjid-provider.js';
import { validatePrayerSourceSettings } from './prayer-source-validator.js';
import { getValidTimezones } from '../utils/timezone-validator.js';
import { updatePrayerSourceConfig, getAllPrayerSourceSettings } from './prayer-config-manager.js';

/**
 * Setup prayer source API routes
 * @param {Express} app - Express app instance
 */
export function setupPrayerSourceRoutes(app) {
    // Get prayer source info - Public endpoint for displaying current source info
    app.get('/api/prayer-source-info', async (req, res) => {
        try {
            // Get source info from prayer data provider
            const sourceInfo = getPrayerDataSourceInfo();
            
            // Get additional configuration details from config
            const config = await getConfig();
            let response = { source: sourceInfo.sourceType };
            
            if (sourceInfo.sourceType === 'mymasjid') {
                response = {
                    ...response,
                    guildId: config.prayerData?.mymasjid?.guildId || sourceInfo.guildId,
                    masjidName: sourceInfo.masjidName
                };
            } else if (sourceInfo.sourceType === 'aladhan') {
                const aladhanConfig = config.prayerData?.aladhan || {};
                response = {
                    ...response,
                    latitude: aladhanConfig.latitude || sourceInfo.latitude,
                    longitude: aladhanConfig.longitude || sourceInfo.longitude,
                    timezone: aladhanConfig.timezone || sourceInfo.timezone,
                    calculationMethodId: aladhanConfig.calculationMethodId,
                    asrJuristicMethodId: aladhanConfig.asrJuristicMethodId,
                    latitudeAdjustmentMethodId: aladhanConfig.latitudeAdjustmentMethodId,
                    midnightModeId: aladhanConfig.midnightModeId,
                    iqamahOffsets: aladhanConfig.iqamahOffsets || {}
                };
            }
            
            res.json(response);
        } catch (error) {
            console.error('Error fetching prayer source info:', error);
            res.status(500).json({ 
                error: 'Failed to fetch prayer source info',
                details: error.message
            });
        }
    });
    
    // Get all prayer source settings (both MyMasjid and Aladhan) - Protected endpoint
    app.get('/api/prayer-source-settings', requireAuth, async (req, res) => {
        try {
            const settings = await getAllPrayerSourceSettings();
            res.json(settings);
        } catch (error) {
            console.error('Error fetching prayer source settings:', error);
            res.status(500).json({ 
                error: 'Failed to fetch prayer source settings',
                details: error.message
            });
        }
    });
    
    // Get available prayer sources - Public endpoint for UI display
    app.get('/api/prayer-sources', (req, res) => {
        try {
            // Return the available prayer sources
            const sources = [
                {
                    id: 'mymasjid',
                    name: 'MyMasjid API',
                    description: 'Fetch prayer times from a specific mosque via its MyMasjid Guild ID'
                },
                {
                    id: 'aladhan',
                    name: 'Aladhan API',
                    description: 'Calculate prayer times based on geographical coordinates and calculation parameters'
                }
            ];
            
            res.json(sources);
        } catch (error) {
            console.error('Error fetching available prayer sources:', error);
            res.status(500).json({ 
                error: 'Failed to fetch available prayer sources',
                details: error.message
            });
        }
    });
    
    // Get valid timezones - Public endpoint for form population
    app.get('/api/prayer-source/timezones', (req, res) => {
        try {
            const timezones = getValidTimezones();
            res.json(timezones);
        } catch (error) {
            console.error('Error fetching valid timezones:', error);
            res.status(500).json({ 
                error: 'Failed to fetch valid timezones',
                details: error.message
            });
        }
    });
    
    // Validate MyMasjid Guild ID - Protected endpoint for validation
    app.post('/api/prayer-source/validate/mymasjid', requireAuth, async (req, res) => {
        try {
            const { guildId } = req.body;
            
            if (!guildId) {
                return res.status(400).json({ 
                    error: 'Guild ID is required',
                    field: 'guildId'
                });
            }
            
            // Validate guild ID
            const validationResult = await validateMyMasjidGuildId(guildId, true);
            
            if (validationResult.isValid) {
                res.json({ 
                    valid: true,
                    masjidName: validationResult.masjidName || 'Unknown Masjid'
                });
            } else {
                res.status(400).json({ 
                    valid: false,
                    error: validationResult.error || 'Invalid Guild ID',
                    field: 'guildId'
                });
            }
        } catch (error) {
            console.error('Error validating MyMasjid Guild ID:', error);
            res.status(500).json({ 
                valid: false,
                error: 'Failed to validate Guild ID',
                details: error.message
            });
        }
    });
    
    // Validate Aladhan parameters - Protected endpoint for validation
    app.post('/api/prayer-source/validate/aladhan', requireAuth, (req, res) => {
        try {
            const aladhanParams = req.body;
            
            // Validate Aladhan parameters
            const validation = validateAladhanConfig(aladhanParams);
            
            if (validation.isValid) {
                res.json({ valid: true });
            } else {
                res.status(400).json({ 
                    valid: false,
                    error: validation.error,
                    field: validation.field
                });
            }
        } catch (error) {
            console.error('Error validating Aladhan parameters:', error);
            res.status(500).json({ 
                valid: false,
                error: 'Failed to validate Aladhan parameters',
                details: error.message
            });
        }
    });
    
    // Validate complete prayer source settings - Protected endpoint for validation
    app.post('/api/prayer-source/validate', requireAuth, async (req, res) => {
        try {
            const settings = req.body;
            
            // Use the comprehensive validation
            const validationResult = await validatePrayerSourceSettings(settings);
            
            if (validationResult.isValid) {
                res.json({ 
                    valid: true,
                    // Include additional info if available
                    ...(validationResult.masjidName ? { masjidName: validationResult.masjidName } : {})
                });
            } else {
                res.status(400).json({ 
                    valid: false,
                    errors: validationResult.errors
                });
            }
        } catch (error) {
            console.error('Error validating prayer source settings:', error);
            res.status(500).json({ 
                valid: false,
                error: 'Failed to validate prayer source settings',
                details: error.message
            });
        }
    });
    
    // Update prayer source settings - Protected endpoint for configuration changes
    app.post('/api/prayer-source', requireAuth, async (req, res) => {
        try {
            const sourceSettings = req.body;
            
            // Use the new prayer config manager for robust update
            const result = await updatePrayerSourceConfig(sourceSettings);
            
            if (result.success) {
                // Reschedule prayer timers with new data
                console.log('🔄 Rescheduling prayer timers with new data');
                const { scheduleNamazTimers } = await import('../scheduler/scheduler.js');
                await scheduleNamazTimers();
                
                res.json({ 
                    success: true,
                    message: result.message
                });
            } else {
                // Return error with details
                const statusCode = result.error?.type === 'validation' ? 400 : 500;
                
                res.status(statusCode).json({ 
                    success: false,
                    error: result.message,
                    details: result.error
                });
            }
        } catch (error) {
            console.error('Error updating prayer source settings:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update prayer source settings',
                details: error.message
            });
        }
    });
    
    // Test prayer source connection - Protected endpoint for testing connections
    app.post('/api/prayer-source/test', requireAuth, async (req, res) => {
        try {
            const { source, ...params } = req.body;
            
            if (!source) {
                return res.status(400).json({ 
                    error: 'Source type is required',
                    field: 'source'
                });
            }
            
            if (source === 'mymasjid') {
                if (!params.guildId) {
                    return res.status(400).json({ 
                        error: 'Guild ID is required for MyMasjid source',
                        field: 'guildId'
                    });
                }
                
                // Test MyMasjid connection
                const validationResult = await validateMyMasjidGuildId(params.guildId, true);
                if (!validationResult.isValid) {
                    return res.status(400).json({ 
                        success: false,
                        error: validationResult.error || 'Invalid MyMasjid Guild ID',
                        field: 'guildId'
                    });
                }
                
                res.json({ 
                    success: true,
                    message: `Successfully connected to MyMasjid API for ${validationResult.masjidName || 'Unknown Masjid'}`,
                    masjidName: validationResult.masjidName
                });
            } else if (source === 'aladhan') {
                // Validate Aladhan parameters
                const validation = validateAladhanConfig(params);
                
                if (!validation.isValid) {
                    return res.status(400).json({ 
                        success: false,
                        error: validation.error,
                        field: validation.field
                    });
                }
                
                // Test Aladhan connection by fetching a single day
                try {
                    const { fetchSingleDayFromAladhan } = await import('./aladhan-provider.js');
                    const testResult = await fetchSingleDayFromAladhan(params);
                    
                    if (testResult && testResult.timings) {
                        res.json({ 
                            success: true,
                            message: 'Successfully connected to Aladhan API',
                            sampleData: {
                                fajr: testResult.timings.Fajr,
                                sunrise: testResult.timings.Sunrise,
                                dhuhr: testResult.timings.Dhuhr,
                                asr: testResult.timings.Asr,
                                maghrib: testResult.timings.Maghrib,
                                isha: testResult.timings.Isha
                            }
                        });
                    } else {
                        res.status(400).json({ 
                            success: false,
                            error: 'Could not retrieve prayer times from Aladhan API'
                        });
                    }
                } catch (error) {
                    res.status(500).json({ 
                        success: false,
                        error: 'Failed to connect to Aladhan API',
                        details: error.message
                    });
                }
            } else {
                return res.status(400).json({ 
                    error: 'Invalid prayer source type',
                    details: `Source type '${source}' is not supported`
                });
            }
        } catch (error) {
            console.error('Error testing prayer source connection:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to test prayer source connection',
                details: error.message
            });
        }
    });
} 